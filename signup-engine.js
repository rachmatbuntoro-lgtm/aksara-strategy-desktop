const { BrowserWindow, session } = require('electron');
const path = require('path');
const https = require('https');

const NAMES = ['Dewi','Putri','Sari','Indah','Maya','Rina','Lestari','Wati','Ayu','Citra'];
const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ---- OTP fetcher (will be injected from main) ----
let otpFetcher = null;

function setOtpFetcher(fn) { otpFetcher = fn; }

// ---- Hidden Browser Window ----
// KEY DIFFERENCE from old version: NEVER call showInactive() or show()
// The window exists in memory only, renders offscreen, user sees NOTHING.
let hiddenWin = null;
let sniffedToken = null;
let sniffAttached = false;

function signupSession() {
  return session.fromPartition('persist:webkita-signup');
}

function attachTokenSniffer() {
  if (sniffAttached) return;
  const ses = signupSession();
  ses.webRequest.onBeforeSendHeaders(
    { urls: ['https://api.leonardo.ai/*', 'https://app.leonardo.ai/api/*'] },
    (details, cb) => {
      try {
        const h = details.requestHeaders || {};
        const auth = h['authorization'] || h['authorization'] || '';
        const m = /Bearer\s+([\w-]+\.[\w-]+\.[\w-]+)/.exec(auth);
        if (m) sniffedToken = m[1];
      } catch (_) {}
      cb({ requestHeaders: details.requestHeaders });
    }
  );
  sniffAttached = true;
}

async function clearSession() {
  const ses = signupSession();
  try {
    await ses.clearStorageData({
      storages: ['cookies','localstorage','indexdb','websql','serviceworkers','cachestorage','shadercache','filesystem']
    });
  } catch (_) {}
  try { await ses.clearCache(); } catch (_) {}
  try { await ses.clearHostResolverCache(); } catch (_) {}
  try { await ses.flushStorageData(); } catch (_) {}
}

function createHidden() {
  attachTokenSniffer();
  sniffedToken = null;

  hiddenWin = new BrowserWindow({
    width: 1280,
    height: 900,
    show: false,                    // ← NEVER show
    skipTaskbar: true,              // ← NOT in taskbar/dock
    focusable: false,               // ← Can't steal focus
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    alwaysOnTop: false,
    backgroundColor: '#00000000',
    opacity: 0,                     // ← Fully transparent (just in case)
    webPreferences: {
      partition: 'persist:webkita-signup',
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      offscreen: true,              // ← Render in memory, NOT on screen
    },
  });

  // DO NOT call hiddenWin.show() or hiddenWin.showInactive()
  // The window is invisible. Period.

  return hiddenWin;
}

function destroyHidden() {
  if (hiddenWin && !hiddenWin.isDestroyed()) {
    hiddenWin.destroy();  // .destroy() not .close() — immediate cleanup
  }
  hiddenWin = null;
}

// ---- JS helpers ----
async function js(win, script) {
  try { return await win.webContents.executeJavaScript(script, true); }
  catch (e) { return null; }
}

async function elementCenter(win, labels) {
  const arr = JSON.stringify(labels);
  return await js(win, `(function(){var want=${arr};var els=document.querySelectorAll('button,[role=button],a,div,span,label');for(var i=0;i<els.length;i++){var t=(els[i].innerText||'').trim();for(var j=0;j<want.length;j++){if(t===want[j]){var r=els[i].getBoundingClientRect();if(r.width>0&&r.height>0)return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};}}}return null;})()`);
}

async function trustedClickText(win, labels) {
  const c = await elementCenter(win, labels);
  if (!c) return false;
  win.webContents.sendInputEvent({ type: 'mouseMove', x: c.x, y: c.y });
  await sleep(60);
  win.webContents.sendInputEvent({ type: 'mouseDown', x: c.x, y: c.y, button: 'left', clickCount: 1 });
  await sleep(50);
  win.webContents.sendInputEvent({ type: 'mouseUp', x: c.x, y: c.y, button: 'left', clickCount: 1 });
  return true;
}

async function smartClick(win, labels) {
  if (await trustedClickText(win, labels)) return true;
  return (await js(win, clickTextScript(labels))) === 'ok';
}

async function pressEnter(win) {
  win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
  win.webContents.sendInputEvent({ type: 'char', keyCode: '\r' });
  win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' });
}

function clickTextScript(labels) {
  const arr = JSON.stringify(labels);
  return `(function(){var want=${arr};var els=document.querySelectorAll('button,[role=button],a,div,span,label');for(var i=0;i<els.length;i++){var t=(els[i].innerText||'').trim();for(var j=0;j<want.length;j++){if(t===want[j]){els[i].click();return 'ok';}}}return 'no';})()`;
}

function fillInputScript(value) {
  const v = JSON.stringify(value);
  return `(function(){function setv(el){el.focus();var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(el,${v});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));el.dispatchEvent(new Event('blur',{bubbles:true}));el.focus();}var ins=[].slice.call(document.querySelectorAll('input')).filter(function(e){var st=getComputedStyle(e);if(st.display==='none'||st.visibility==='hidden')return false;if(e.disabled)return false;var t=(e.type||'').toLowerCase();if(t!=='email'&&t!=='text'&&t!=='')return false;var m=parseInt(e.getAttribute('maxlength')||'0',10);if(m>0&&m<=8)return false;return true;});if(!ins.length)return 'no';var pick=ins.find(function(e){var h=((e.type||'')+' '+(e.id||'')+' '+(e.name||'')+' '+(e.placeholder||'')+' '+(e.getAttribute('aria-label')||'')+' '+(e.getAttribute('autocomplete')||'')).toLowerCase();return /email|e-mail|mail|surel/.test(h);})||ins[0];setv(pick);return 'ok';})()`;
}

function fillOtpScript(otp) {
  const o = JSON.stringify(otp);
  return `(function(){var otp=${o};var single=document.querySelectorAll("input[maxlength='1']");if(single.length>=otp.length){for(var i=0;i<otp.length;i++){var el=single[i];el.focus();var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(el,otp[i]);el.dispatchEvent(new Event('input',{bubbles:true}));}return 'multi';}var one=document.querySelector("input[maxlength='6'],input[type=tel],input[type=text],input");if(one){one.focus();var s2=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s2.call(one,otp);one.dispatchEvent(new Event('input',{bubbles:true}));one.dispatchEvent(new Event('change',{bubbles:true}));return 'one';}return 'no';})()`;
}

const bodyTextScript = `(function(){return document.body?document.body.innerText:''})()`;
const hasOtpScript = `(function(){if(document.querySelector("input[maxlength='6']"))return true;if(document.querySelectorAll("input[maxlength='1']").length>=4)return true;var b=document.body?document.body.innerText:'';if(/kode|code|OTP|verifikasi|verify/i.test(b)&&document.querySelector('input'))return true;return false;})()`;
const leoUidScript = `(function(){try{var u=JSON.parse(localStorage.getItem('persist:user')||'{}');return (u.id||'').replace(/"/g,'');}catch(e){return '';}})()`;
const hasCanvaBtnScript = `(function(){var els=document.querySelectorAll('button,[role=button],a');for(var i=0;i<els.length;i++){var e=els[i];var r=e.getBoundingClientRect();if(r.width<=0||r.height<=0)continue;var t=(e.innerText||e.textContent||'').replace(/\\\\s+/g,' ').trim();if(/sign\\\\s*in\\\\s*with\\\\s*canva|continue\\\\s*with\\\\s*canva|log\\\\s*in\\\\s*with\\\\s*canva/i.test(t))return true;if(/^canva$/i.test(t))return true;}return false;})()`;
const hasBenefitToastScript = `(function(){var b=document.body?document.body.innerText:'';return /Canva Benefit Activated/i.test(b);})()`;

function isJwt(t) { return typeof t === 'string' && t.split('.').length === 3 && t.length > 40; }

async function grabToken(win) {
  attachTokenSniffer();
  let uid = '';
  try { uid = await js(win, leoUidScript); } catch (_) {}

  if (isJwt(sniffedToken)) return { accessToken: sniffedToken, user_id: uid };

  try { await win.webContents.reload(); } catch (_) {}
  for (let i = 0; i < 12; i++) {
    await sleep(1000);
    if (isJwt(sniffedToken)) {
      if (!uid) { try { uid = await js(win, leoUidScript); } catch (_) {} }
      return { accessToken: sniffedToken, user_id: uid };
    }
  }

  const dig = `(function(){function jwt(s){return typeof s==='string'&&s.split('.').length===3&&s.length>40?s:null;}try{var keys=Object.keys(localStorage);for(var i=0;i<keys.length;i++){var v=localStorage.getItem(keys[i]);if(!v)continue;var d=jwt(v);if(d)return d;try{var o=JSON.parse(v);for(var k in o){var dd=jwt(o[k]);if(dd)return dd;if(o[k]&&typeof o[k]==='object'){for(var k2 in o[k]){var d3=jwt(o[k][k2]);if(d3)return d3;}}}}catch(e){}}}catch(e){}return '';})()`;
  let tok = '';
  try { tok = await js(win, dig); } catch (_) {}
  if (isJwt(tok)) return { accessToken: tok, user_id: uid };
  return null;
}

async function loadUrl(win, url) {
  await win.loadURL(url).catch(() => {});
  await sleep(500);
}

// =====================================================
// MAIN SIGNUP FUNCTION
// =====================================================
async function runSignup(key, email, name, canvaUrl, log) {
  log = log || (() => {});
  await clearSession();
  sniffedToken = null;

  const win = createHidden();
  try {
    log('Membuka undangan Canva...');
    await loadUrl(win, canvaUrl);
    await sleep(5000);
    await js(win, clickTextScript(['Terima semua kuki','Accept all cookies']));
    await sleep(1500);

    log('Pilih Akun belajar.id...');
    const belajarLabels = ['Continue with Akun belajar.id','Lanjutkan dengan Akun belajar.id','Akun belajar.id','belajar.id'];
    let picked = await smartClick(win, belajarLabels);
    if (!picked) {
      await smartClick(win, ['Lanjutkan dengan cara lain','Continue another way']);
      await sleep(2000);
      picked = await smartClick(win, belajarLabels);
    }
    if (!picked) {
      await smartClick(win, ['Email','Continue with email','Lanjutkan dengan email']);
    }
    await sleep(3500);

    log('Mengisi email...');
    await js(win, fillInputScript(email));
    await sleep(800);
    if (!(await smartClick(win, ['Lanjutkan','Continue','Next']))) await pressEnter(win);
    else await pressEnter(win);
    await sleep(4000);

    if (!(await js(win, hasOtpScript))) {
      log('Mengisi nama...');
      await js(win, fillInputScript(name));
      await sleep(800);
      if (!(await smartClick(win, ['Lanjutkan','Continue']))) await pressEnter(win);
      await sleep(4000);
    }

    log('Menunggu OTP...');
    const otp = otpFetcher ? await otpFetcher() : null;
    if (!otp) return { ok: false, reason: 'OTP timeout.' };
    log('OTP diterima: ' + otp);

    log('Mengisi OTP...');
    await js(win, fillOtpScript(otp));
    await sleep(1000);
    if (!(await smartClick(win, ['Lanjutkan','Continue','Verifikasi','Verify']))) await pressEnter(win);
    await sleep(6000);

    const bt = (await js(win, bodyTextScript)) || '';
    if (bt.includes('alasan keamanan') || bt.includes('tidak dapat diproses'))
      return { ok: false, reason: 'Canva blokir koneksi ini.' };

    log('Bergabung ke team...');
    await smartClick(win, ['Opt me in','Terima undangan','Accept invite','Gabung','Join','Bergabung']);
    await sleep(5000);

    log('Menghubungkan ke Leonardo...');
    await loadUrl(win, 'https://app.leonardo.ai/');
    await sleep(5000);

    for (let i = 0; i < 24; i++) {
      if (await js(win, leoUidScript)) break;

      const pageText = (await js(win, bodyTextScript)) || '';
      const url = win.webContents.getURL();

      if (pageText.includes('Application error') || /404\s*[-–—]\s*This page/i.test(pageText) || url.includes('/404')) {
        await smartClick(win, ['Back to homepage','Back to home']);
        await loadUrl(win, 'https://app.leonardo.ai/');
        await sleep(4000);
        continue;
      }

      if (await js(win, hasBenefitToastScript)) {
        await smartClick(win, ['Okay','OK']);
        await sleep(2000);
        continue;
      }

      if (url.includes('canva.com')) {
        log('OAuth consent...');
        if (await smartClick(win, belajarLabels) || await smartClick(win, ['Email','Lanjutkan dengan cara lain'])) {
          await sleep(2500);
          await js(win, fillInputScript(email));
          await sleep(800);
          if (!(await smartClick(win, ['Lanjutkan','Continue']))) await pressEnter(win);
          await sleep(4000);
          if (!(await js(win, hasOtpScript))) {
            await js(win, fillInputScript(name));
            await sleep(600);
            if (!(await smartClick(win, ['Lanjutkan','Continue']))) await pressEnter(win);
            await sleep(3500);
          }
          if (otpFetcher) {
            const otp2 = await otpFetcher();
            if (otp2) {
              await js(win, fillOtpScript(otp2));
              await sleep(800);
              if (!(await smartClick(win, ['Lanjutkan','Verifikasi','Continue']))) await pressEnter(win);
              await sleep(5000);
            }
          }
        }
        await smartClick(win, ['Izinkan','Allow','Setuju','Authorize','Lanjutkan','Continue']);
        await sleep(4000);
        continue;
      }

      if (await js(win, hasCanvaBtnScript)) {
        log('Sign in with Canva...');
        await smartClick(win, ['Sign in with Canva','Continue with Canva','Log in with Canva','Canva']);
        await sleep(4000);
      } else {
        log('Membuka panel auth...');
        await smartClick(win, ['Sign Up','Sign up','Daftar','Sign In','Sign in','Masuk']);
        await sleep(3000);
      }
    }

    log('Verifikasi login...');
    let uid = '';
    for (let i = 0; i < 20; i++) {
      uid = (await js(win, leoUidScript)) || '';
      if (uid) break;
      const tt = (await js(win, bodyTextScript)) || '';
      if (win.webContents.getURL().includes('404') || tt.includes('Application error'))
        await loadUrl(win, 'https://app.leonardo.ai/');
      await sleep(3000);
    }

    if (!uid) return { ok: false, reason: 'Leonardo belum login.' };

    log('Berhasil! UID: ' + uid);

    let token = null;
    const tk = await grabToken(win);
    if (tk && tk.accessToken) {
      token = tk.accessToken;
      if (tk.user_id) uid = tk.user_id;
      log('Token tersimpan.');
    }

    return { ok: true, uid, userId: uid, email, token };
  } catch (e) {
    return { ok: false, reason: 'Error: ' + e.message };
  } finally {
    destroyHidden();
  }
}

// Refresh token (re-open Leonardo, cookies may persist in partition)
async function refreshToken(email, userId, log) {
  log = log || (() => {});
  const win = createHidden();
  try {
    await loadUrl(win, 'https://app.leonardo.ai/');
    await sleep(3500);
    const tk = await grabToken(win);
    return tk || null;
  } catch (e) {
    log('Refresh gagal: ' + e.message);
    return null;
  } finally {
    destroyHidden();
  }
}

module.exports = { runSignup, refreshToken, setOtpFetcher };
