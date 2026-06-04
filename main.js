const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const https = require('https');
const fs = require('fs');
const { AccountManager } = require('./account-manager.js');
const { JobQueue } = require('./job-queue.js');
const { runSignup, refreshToken, setOtpFetcher } = require('./signup-engine.js');
const { GeminiEngine, getStoryboardPrompt, VIDEO_PROMPT_LOCKED } = require('./gemini-engine.js');

// Simple JSON store replacement (no external deps)
const http = require('http');

const storePath = path.join(app.getPath('userData'), 'config.json');
let _data = {};
try { _data = JSON.parse(fs.readFileSync(storePath, 'utf8')); } catch {}
const store = {
  get: (key) => _data[key],
  set: (key, val) => { _data[key] = val; fs.writeFileSync(storePath, JSON.stringify(_data, null, 2)); },
  clear: () => { _data = {}; fs.writeFileSync(storePath, '{}'); },
  path: storePath,
};
const LICENSE_API = '43.134.62.172:3100';

let mainWin = null;
let jobQueue = null;

function deviceId() {
  let id = store.get('device_id');
  if (!id) {
    id = 'desktop-' + Math.random().toString(36).slice(2, 14);
    store.set('device_id', id);
  }
  return id;
}

function apiPost(pathName, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: '43.134.62.172',
      port: 3100,
      path: pathName,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        try { resolve(JSON.parse(buf || '{}')); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function nowMinus(sec) {
  return new Date(Date.now() - sec * 1000).toISOString().replace(/\.\d+Z$/, 'Z');
}

async function fetchOtp(key, recipient, attempts = 30) {
  const since = nowMinus(90);
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await apiPost('/api/license/fetch-otp', {
        key,
        device_id: deviceId(),
        recipient_email: recipient,
        since_iso: since,
      });
      if (r.otp && r.otp !== 'null') return r.otp;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 3000));
  }
  return null;
}

function log(msg) {
  const line = `[${new Date().toTimeString().slice(0, 8)}] ${msg}`;
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('log', line);
  console.log(line);
}

// Wire OTP fetcher into signup engine
setOtpFetcher(null); // will be set per-signup with the right key/email

function createMain() {
  mainWin = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#1C1C1C',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWin.setMenuBarVisibility(false);

  const builtUI = path.join(__dirname, 'ui', 'dist', 'index.html');
  if (fs.existsSync(builtUI)) mainWin.loadFile(builtUI);
  else mainWin.loadFile('renderer/index.html');
}

// ---- Account Manager wiring ----
async function signupForSlot({ email, slot }) {
  const key = store.get('license_key');
  let url = store.get('canva_invite_url');

  if (!url) {
    const v = await apiPost('/api/validate', {
      key,
      device_id: deviceId(),
      device_label: 'WebKita Desktop',
    });
    url = v.canva_invite_url;
    if (url) store.set('canva_invite_url', url);
  }

  log(`Rotasi: menyiapkan akun cadangan (slot ${slot})...`);

  // Set OTP fetcher for this specific signup
  setOtpFetcher(() => fetchOtp(key, email));

  const name = ['Dewi','Putri','Sari','Indah','Maya','Rina','Lestari','Wati','Ayu','Citra'][Math.max(0, (slot - 1) % 10)] + ' ' + slot;
  const r = await runSignup(key, email, name, url, log);

  if (!r.ok) throw new Error(r.reason || 'signup gagal');
  return { token: r.token, user_id: r.uid || r.userId, uid: r.uid || r.userId };
}

async function refreshSession(acct) {
  return await refreshToken(acct.email, acct.user_id, log);
}

const accounts = new AccountManager(store, signupForSlot, refreshSession);

jobQueue = new JobQueue(store, accounts, log);
jobQueue.on('update', (jobs) => {
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('jobs', jobs);
  // Check deferred logout after job finishes
  if (_licenseExpired && !jobs.some(j => j.status === 'queued' || j.status === 'processing')) {
    doLogout(_licenseExpiredMsg || 'License expired.');
  }
});

// ---- IPC ----
ipcMain.handle('get-state', () => ({
  connected: !!store.get('leo_uid'),
  email: store.get('pool_email') || null,
  uid: store.get('leo_uid') || null,
  expires_at: store.get('license_expires') || null,
}));

ipcMain.handle('activate', async (_e, key) => {
  log('Validasi license...');

  let v;
  try {
    v = await apiPost('/api/validate', {
      key,
      device_id: deviceId(),
      device_label: 'WebKita Desktop',
    });
  } catch (e) {
    return { ok: false, reason: 'Koneksi gagal: ' + e.message };
  }

  if (!v.ok) return { ok: false, reason: v.error || 'License tidak valid' };

  const pool = v.signup_pool || [];
  if (!pool.length || !v.canva_invite_url) {
    return { ok: false, reason: 'Pool/undangan kosong dari server' };
  }

  log('License OK (' + v.tag + '). Menyiapkan akun...');

  store.set('license_key', key);
  store.set('canva_invite_url', v.canva_invite_url);
  store.set('license_expires', v.expires_at || null);
  store.set('gemini_email', v.gemini_email || null);
  store.set('gemini_password', v.gemini_password || null);
  accounts.setLicense(key, pool);

  const entry = pool[0];
  const name = ['Dewi','Putri','Sari','Indah','Maya','Rina','Lestari','Wati','Ayu','Citra'][Math.max(0, (entry.slot - 1) % 10)] + ' ' + entry.slot;

  log('Membuat akun (proses invisible)...');

  setOtpFetcher(() => fetchOtp(key, entry.email));
  const r = await runSignup(key, entry.email, name, v.canva_invite_url, log);

  if (r.ok) {
    store.set('leo_uid', r.uid || r.userId);
    store.set('pool_email', r.email);

    const s = accounts._state();
    s.accounts[String(entry.slot)] = {
      slot: String(entry.slot),
      email: r.email,
      token: r.token || null,
      user_id: r.uid || r.userId,
      created_at: Date.now(),
    };
    s.active = String(entry.slot);
    accounts._save(s);

    log('Akun berhasil dibuat!');
  }

  r.expires_at = v.expires_at || null;
  return r;
});

ipcMain.handle('reset', () => { store.clear(); return true; });

function parseDuration(d) {
  return typeof d === 'number' ? d : parseInt(String(d).replace(/[^\d]/g, ''), 10);
}

ipcMain.handle('generate', async (_e, job) => {
  if (!store.get('leo_uid')) return { ok: false, reason: 'Belum ada akun aktif.' };
  const prompt = (job.prompt || '').trim();
  if (!prompt) return { ok: false, reason: 'Prompt kosong' };

  const id = jobQueue.enqueue({
    model: job.model,
    prompt,
    duration: parseDuration(job.duration),
    ratio: job.ratio || '9:16',
    startFrame: job.startFrame || null,
    endFrame: job.endFrame || null,
    omni: job.omni || [],
  });

  return { ok: true, id };
});

ipcMain.handle('jobs-list', () => jobQueue.list());
ipcMain.handle('job-retry', (_e, id) => { jobQueue.retry(id); return true; });
ipcMain.handle('job-remove', (_e, id) => { jobQueue.remove(id); return true; });

// ---- Storyboard Generation ----
let geminiEngine = null;

function getGemini() {
  if (!geminiEngine) geminiEngine = new GeminiEngine(log, {
    email: store.get('gemini_email'),
    password: store.get('gemini_password'),
  });
  return geminiEngine;
}

ipcMain.handle('storyboard-generate', async (_e, data) => {
  // data: { productImg, modelImg, lokasiImg, bgText, category, variation }
  if (!data.productImg) return { ok: false, reason: 'Gambar produk wajib diisi' };
  if (!data.lokasiImg && !data.bgText) return { ok: false, reason: 'Lokasi/background wajib diisi (upload atau text)' };

  const tmpFiles = [];
  try {
    const gemini = getGemini();
    const path = require('path');
    const os = require('os');

    // Decode data: URLs to temp files
    const toTmpFile = (img, name) => {
      if (!img) return null;
      const val = typeof img === 'string' ? img : img.url;
      if (!val || !val.startsWith('data:')) return val;
      const m = /^data:([^;]+);base64,(.*)$/s.exec(val);
      if (!m) return null;
      const ext = (m[1].split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const p = path.join(os.tmpdir(), `sb_${name}_${Date.now()}.${ext}`);
      fs.writeFileSync(p, Buffer.from(m[2], 'base64'));
      return p;
    };

    const productPath = toTmpFile(data.productImg, 'product');
    const modelPath = toTmpFile(data.modelImg, 'model');
    const lokasiPath = toTmpFile(data.lokasiImg, 'lokasi');
    if (productPath) tmpFiles.push(productPath);
    if (modelPath) tmpFiles.push(modelPath);
    if (lokasiPath) tmpFiles.push(lokasiPath);

    // Build image paths array: [produk, model, lokasi, layout_ref]
    const imagePaths = [productPath, modelPath, lokasiPath].filter(Boolean);

    // Always include the storyboard layout reference as Gambar 4
    const layoutRefPath = path.join(__dirname, 'assets', 'storyboard-layout-ref.png');
    if (fs.existsSync(layoutRefPath)) imagePaths.push(layoutRefPath);

    // ===== STEP 1: Gemini → storyboard image prompt =====
    const systemPrompt = getStoryboardPrompt(data.category, data.variation);
    let finalPrompt = systemPrompt;
    if (data.bgText) {
      finalPrompt += `\n\nBackground/Lokasi : ${data.bgText}`;
    }

    log(`[storyboard] Step 1: Gemini → image prompt (${data.category}/${data.variation})...`);
    await gemini.init();

    const fileRefs = [];
    for (const p of imagePaths) {
      if (!p) continue;
      const ref = await gemini.uploadFile(p);
      fileRefs.push(ref);
    }
    if (!fileRefs.length) throw new Error('Tidak ada gambar yang berhasil di-upload');

    const storyboardPrompt = await gemini._sendPrompt(finalPrompt, fileRefs);
    if (!storyboardPrompt || storyboardPrompt.length < 20) {
      throw new Error('Storyboard prompt terlalu pendek atau kosong');
    }
    log(`[storyboard] Step 1 OK: prompt ${storyboardPrompt.length} chars`);

    // ===== STEP 2: Leonardo → generate storyboard image =====
    log(`[storyboard] Step 2: Leonardo → generate image...`);
    const imageResult = await accounts.makeImage(
      { prompt: storyboardPrompt, ratio: '9:16', quality: 'HIGH', promptEnhance: false },
      (s, i) => {
        if (s === 'rotate') log(`[storyboard] ${i.reason} — rotasi akun...`);
        else if (s === 'generating') log(`[storyboard] Generating image slot ${i.slot}...`);
      }
    );

    if (!imageResult || !imageResult.url) throw new Error('Leonardo tidak menghasilkan gambar');
    log(`[storyboard] Step 2 OK: image generated`);

    // Download image to temp file for Gemini analysis
    const imgResp = await fetch(imageResult.url);
    const imgBuf = Buffer.from(await imgResp.arrayBuffer());
    const storyboardImgPath = path.join(os.tmpdir(), `sb_result_${Date.now()}.png`);
    fs.writeFileSync(storyboardImgPath, imgBuf);
    tmpFiles.push(storyboardImgPath);

    // ===== STEP 3: Gemini → video prompt (LOCKED) =====
    log(`[storyboard] Step 3: Gemini → video prompt (locked)...`);
    const videoFileRef = await gemini.uploadFile(storyboardImgPath);
    const videoPrompt = await gemini._sendPrompt(VIDEO_PROMPT_LOCKED, [videoFileRef]);

    if (!videoPrompt || videoPrompt.length < 20) {
      throw new Error('Video prompt terlalu pendek atau kosong');
    }
    log(`[storyboard] Step 3 OK: video prompt ${videoPrompt.length} chars`);

    // Cleanup temp files
    tmpFiles.forEach(p => { try { fs.unlinkSync(p); } catch {} });

    // Add to queue for history tracking
    jobQueue.addCompleted({
      model: 'storyboard',
      engine: 'Storyboard AI',
      title: (storyboardPrompt || 'Storyboard').trim().split(/\s+/).slice(0, 4).join(' '),
      prompt: videoPrompt,
      ratio: '1:1',
      imageUrl: imageResult.url,
      storyboardData: { storyboardPrompt, videoPrompt, category: data.category, variation: data.variation },
    });

    return {
      ok: true,
      storyboardPrompt,     // image prompt (for reference)
      videoPrompt,          // seedance 2 prompt (main output)
      storyboardImageUrl: imageResult.url,  // the generated storyboard image
    };
  } catch (e) {
    log('[storyboard] FAILED: ' + e.message);
    // Cleanup temp files on error too
    tmpFiles.forEach(p => { try { fs.unlinkSync(p); } catch {} });
    return { ok: false, reason: e.message };
  }
});

// ---- CAPTURE MODE ----
let captureWin = null;
let captureView = null;
const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const captureToolbarHTML = `data:text/html,` + encodeURIComponent(`<!doctype html><html><head><meta charset=utf-8>
<style>html,body{margin:0;font-family:-apple-system,sans-serif;background:#14101f;color:#eee}#bar{display:flex;gap:6px;align-items:center;padding:8px;border-bottom:1px solid #2a2440;background:#1b1530}button{background:#2a2440;color:#cdbcff;border:1px solid #3a2f5c;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:13px}#url{flex:1;background:#0e0b16;color:#fff;border:1px solid #3a2f5c;border-radius:6px;padding:6px 10px;font-size:13px}#note{padding:6px 10px;font-size:12px;color:#b9a6ff;background:#1b1530}</style></head><body><div id=bar><button id=back>◀</button><button id=reload>⟳</button><input id=url value="https://app.leonardo.ai/"/><button id=go>Go</button></div><div id=note>🔴 MEREKAM. Generate 1 video → TUTUP jendela ini.</div><script>const{ipcRenderer}=require('electron');const u=document.getElementById('url');document.getElementById('go').onclick=()=>ipcRenderer.send('cap-nav',u.value.trim());u.addEventListener('keydown',e=>{if(e.key==='Enter')ipcRenderer.send('cap-nav',u.value.trim())});document.getElementById('back').onclick=()=>ipcRenderer.send('cap-back');document.getElementById('reload').onclick=()=>ipcRenderer.send('cap-reload');ipcRenderer.on('cap-url',(_e,v)=>{u.value=v});</script></body></html>`);

const TOOLBAR_H = 76;

ipcMain.on('cap-nav', (_e, url) => {
  if (!captureView) return;
  let u = url;
  if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
  captureView.webContents.loadURL(u, { userAgent: CHROME_UA }).catch(() => {});
});
ipcMain.on('cap-back', () => { if (captureView && captureView.webContents.canGoBack()) captureView.webContents.goBack(); });
ipcMain.on('cap-reload', () => { if (captureView) captureView.webContents.reload(); });

ipcMain.handle('capture', async () => {
  if (!store.get('leo_uid')) return { ok: false, reason: 'Belum ada akun aktif.' };
  if (captureWin && !captureWin.isDestroyed()) { captureWin.focus(); return { ok: false, reason: 'Jendela rekam sudah terbuka.' }; }

  const events = [];
  const bodies = {};

  captureWin = new BrowserWindow({
    width: 1280, height: 900, show: true,
    title: 'WebKita — REKAM API',
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  await captureWin.loadURL(captureToolbarHTML);

  const { BrowserView } = require('electron');
  captureView = new BrowserView({
    webPreferences: { partition: 'persist:webkita', contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });
  captureWin.setBrowserView(captureView);

  const fit = () => {
    if (!captureWin || captureWin.isDestroyed()) return;
    const [w, h] = captureWin.getContentSize();
    captureView.setBounds({ x: 0, y: TOOLBAR_H, width: w, height: Math.max(100, h - TOOLBAR_H) });
  };
  fit();
  captureWin.on('resize', fit);
  captureView.webContents.setUserAgent(CHROME_UA);

  const dbg = captureView.webContents.debugger;
  try { dbg.attach('1.3'); } catch (e) { log('debugger gagal: ' + e.message); }

  dbg.on('message', async (_e, method, params) => {
    try {
      if (method === 'Network.requestWillBeSent') {
        const u = params.request.url || '';
        if (/graphql|leonardo\.ai\/api|amazonaws|upload|presigned|generation|variation|motion/i.test(u)) {
          events.push({ kind: 'request', t: Date.now(), requestId: params.requestId, url: u, method: params.request.method, headers: params.request.headers, postData: params.request.postData || null });
          bodies[params.requestId] = u;
        }
      } else if (method === 'Network.responseReceived') {
        const u = params.response.url || '';
        if (bodies[params.requestId] || /graphql|leonardo\.ai\/api|generation|motion/i.test(u)) {
          events.push({ kind: 'response-meta', t: Date.now(), requestId: params.requestId, url: u, status: params.response.status, mimeType: params.response.mimeType, headers: params.response.headers });
        }
      } else if (method === 'Network.loadingFinished') {
        if (bodies[params.requestId]) {
          try {
            const body = await dbg.sendCommand('Network.getResponseBody', { requestId: params.requestId });
            events.push({ kind: 'response-body', requestId: params.requestId, url: bodies[params.requestId], base64Encoded: !!body.base64Encoded, body: (body.body || '').slice(0, 200000) });
          } catch (_) {}
        }
      }
    } catch (_) {}
  });

  try { await dbg.sendCommand('Network.enable'); } catch {}

  captureView.webContents.on('did-navigate', (_e, url) => { if (captureWin && !captureWin.isDestroyed()) captureWin.webContents.send('cap-url', url); });
  captureView.webContents.on('did-fail-load', (_e, code) => {
    if (code === -3) return;
    setTimeout(() => { if (captureView) captureView.webContents.reload(); }, 1500);
  });

  await captureView.webContents.loadURL('https://app.leonardo.ai/', { userAgent: CHROME_UA }).catch(() => {});
  log('REKAM aktif.');

  return await new Promise((resolve) => {
    captureWin.on('closed', () => {
      const dir = app.getPath('downloads');
      const file = path.join(dir, 'webkita-capture-' + Date.now() + '.json');
      try {
        fs.writeFileSync(file, JSON.stringify({ savedAt: new Date().toISOString(), count: events.length, events }, null, 2));
        log('Rekaman: ' + file);
        resolve({ ok: true, file, count: events.length });
      } catch (e) {
        resolve({ ok: false, reason: e.message });
      }
      captureView = null;
      captureWin = null;
    });
  });
});

// ---- License auto-check ----
let _licenseExpired = false;

function hasActiveJobs() {
  if (!jobQueue) return false;
  return jobQueue.list().some(j => j.status === 'queued' || j.status === 'processing');
}

function deferredLogout(msg) {
  if (hasActiveJobs()) {
    log('[license] Expired tapi ada job aktif — logout setelah selesai.');
    _licenseExpired = true;
    _licenseExpiredMsg = msg;
    return;
  }
  doLogout(msg);
}

let _licenseExpiredMsg = '';

function doLogout(msg) {
  _licenseExpired = false;
  log('[license] Force logout: ' + msg);
  store.clear();
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('session-expired', msg);
  }
}

// Called after every job finishes — check if we deferred a logout
function checkDeferredLogout() {
  if (_licenseExpired && !hasActiveJobs()) {
    doLogout(_licenseExpiredMsg || 'License expired.');
  }
}

// Hook into job queue updates to catch job completion
function hookJobQueueForLogout() {
  if (!jobQueue) return;
  jobQueue.on('update', () => {
    if (_licenseExpired) checkDeferredLogout();
  });
}

function checkLicenseExpiry() {
  const expiresAt = store.get('license_expires');
  if (!expiresAt) return true; // no expiry set = unlimited
  const now = new Date();
  const exp = new Date(expiresAt);
  if (now > exp) {
    deferredLogout('License telah expired. Silakan perpanjang.');
    return false;
  }
  // Warn if expiring within 3 days
  const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 3) {
    log(`[license] Warning: ${daysLeft} hari lagi expired!`);
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('license-warning', `License akan expired dalam ${daysLeft} hari.`);
    }
  }
  return true;
}

async function revalidateLicense() {
  const key = store.get('license_key');
  if (!key) return;
  try {
    const v = await apiPost('/api/validate', {
      key,
      device_id: deviceId(),
      device_label: 'WebKita Desktop',
    });
    if (!v.ok) {
      deferredLogout(v.error || 'License tidak valid.');
      return;
    }
    // Update expiry if server gives new one
    if (v.expires_at) store.set('license_expires', v.expires_at);
  } catch (e) {
    log('[license] Revalidate network error (ignored): ' + e.message);
    // Network error — rely on local check
  }
}

// ---- Lifecycle ----
app.whenReady().then(() => {
  createMain();

  // Check on startup (after short delay to let UI load)
  setTimeout(() => {
    if (!checkLicenseExpiry()) return;
    revalidateLicense(); // async server check
  }, 5000);

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMain(); });
});

app.on('window-all-closed', () => { app.quit(); });
