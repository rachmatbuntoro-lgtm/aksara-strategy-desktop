const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const https = require('https');
const fs = require('fs');
const Store = require('electron-store');
const { AccountManager } = require('./account-manager.js');
const { JobQueue } = require('./job-queue.js');
const { runSignup, refreshToken, setOtpFetcher } = require('./signup-engine.js');

const store = new Store();
const LICENSE_API = 'aksara-license.fly.dev';

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
    const req = https.request({
      hostname: LICENSE_API,
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
});

// ---- IPC ----
ipcMain.handle('get-state', () => ({
  connected: !!store.get('leo_uid'),
  email: store.get('pool_email') || null,
  uid: store.get('leo_uid') || null,
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

// ---- Lifecycle ----
app.whenReady().then(() => {
  createMain();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMain(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
