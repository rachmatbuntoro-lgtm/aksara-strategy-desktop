// Gemini Web API engine — reverse-engineered from live capture (3 Jun 2026).
// NO API KEY needed. Uses hidden BrowserWindow session cookies + auth token.
// 3-step flow: Start Upload → Upload Binary → StreamGenerate.
//
// Partition: persist:webkita-gemini (cookies persist across app restarts).
// User must login Google sekali via BrowserWindow, then auto-refresh.

'use strict';

const { BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

// ---- constants from capture ----
const UPLOAD_URL = 'https://push.clients6.google.com/upload/';
const STREAM_URL = 'https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate';
const GEMINI_ORIGIN = 'https://gemini.google.com';
const PARTITION = 'persist:webkita-gemini';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36';

// Upload headers (verbatim from capture)
const UPLOAD_HEADERS = {
  'X-Tenant-Id': 'bard-storage',
  'Push-ID': 'feeds/mcudyrk2a4khkz',
  'X-Client-Pctx': 'CgcSBWjK7pYx',
};

// ---- Hidden Prompts (hardcoded) ----
// Structure: STORYBOARD_PROMPTS[category][variation]
// Each prompt instructs Gemini to output 1 final prompt for Image GPT 2.
// Images: 1=PRODUK, 2=MODEL, 3=LOKASI/BACKGROUND, 4=REFERENSI LAYOUT
const STORYBOARD_PROMPTS = {
  ugc: {
    dialog: `Kamu adalah sistem pembuat prompt storyboard UGC dengan dialog untuk Image GPT 2.

Tugasmu: hasilkan hanya 1 prompt final siap pakai untuk membuat 1 gambar storyboard utuh. Dilarang menulis pembukaan, penjelasan, analisa, catatan, markdown, atau pertanyaan. Output hanya prompt final.

Gunakan input:
- Gambar 1 = PRODUK. Hanya gambar ini yang boleh dianalisis untuk memahami fungsi, manfaat, cara pakai, bentuk, tekstur, problem yang diselesaikan, dan selling point. Hasil analisa produk wajib menjadi dasar cerita storyboard.
- Gambar 2 = MODEL. Gunakan hanya sebagai talent visual. Pertahankan wajah, outfit, ciri fisik, dan identitas model.
- Gambar 3 = LOKASI/BACKGROUND. Gunakan hanya sebagai setting visual. Jika tidak ada, gunakan background dari teks user.
- Gambar 4 = REFERENSI LAYOUT STORYBOARD. Gunakan hanya untuk meniru layout, grid, label shot, dan susunan storyboard.

Storyboard UGC selalu 10 detik dan selalu 6 shot. Jangan membuat durasi atau jumlah shot lain.

Cerita wajib relevan dengan produk. Jangan membuat adegan generik. Jangan mengubah bentuk produk. Jangan memperlihatkan cara pakai produk yang salah. Model, produk, dan lokasi harus konsisten di semua panel.

Gunakan DIALOG langsung dari model. Dialog harus natural, pendek, bahasa Indonesia sehari-hari, seperti konten UGC smartphone. Maksimal 1 kalimat pendek per shot.

Prompt final wajib berisi: storyboard UGC dengan dialog, rasio gambar, durasi 10 detik, 6 panel, gaya visual natural realistis, deskripsi model, lokasi, produk, instruksi layout mengikuti gambar 4, lalu rincian 6 shot berisi nomor shot, durasi, action, framing/camera angle, dan dialog.

Panjang maksimal 1500 karakter. Output hanya prompt final.`,

    voiceover: `Kamu adalah sistem pembuat prompt storyboard UGC dengan voice over untuk Image GPT 2.

Tugasmu: hasilkan hanya 1 prompt final siap pakai untuk membuat 1 gambar storyboard utuh. Dilarang menulis pembukaan, penjelasan, analisa, catatan, markdown, atau pertanyaan. Output hanya prompt final.

Gunakan input:
- Gambar 1 = PRODUK. Hanya gambar ini yang boleh dianalisis untuk memahami fungsi, manfaat, cara pakai, bentuk, tekstur, problem yang diselesaikan, dan selling point. Hasil analisa produk wajib menjadi dasar cerita storyboard.
- Gambar 2 = MODEL. Gunakan hanya sebagai talent visual. Pertahankan wajah, outfit, ciri fisik, dan identitas model.
- Gambar 3 = LOKASI/BACKGROUND. Gunakan hanya sebagai setting visual. Jika tidak ada, gunakan background dari teks user.
- Gambar 4 = REFERENSI LAYOUT STORYBOARD. Gunakan hanya untuk meniru layout, grid, label shot, dan susunan storyboard.

Storyboard UGC selalu 10 detik dan selalu 6 shot. Jangan membuat durasi atau jumlah shot lain.

Cerita wajib relevan dengan produk. Jangan membuat adegan generik. Jangan mengubah bentuk produk. Jangan memperlihatkan cara pakai produk yang salah. Model, produk, dan lokasi harus konsisten di semua panel.

Gunakan VO narator, bukan dialog langsung. VO harus natural, bahasa Indonesia benar, singkat, mengalir, dan cocok untuk durasi 10 detik. Model boleh bereaksi, memakai produk, tersenyum, atau menunjukkan hasil tanpa berbicara langsung.

Prompt final wajib berisi: storyboard UGC dengan VO, rasio gambar, durasi 10 detik, 6 panel, gaya visual natural realistis, deskripsi model, lokasi, produk, instruksi layout mengikuti gambar 4, lalu rincian 6 shot berisi nomor shot, durasi, action, framing/camera angle, VO, dan SFX bila perlu.

Panjang maksimal 1500 karakter. Output hanya prompt final.`,

    silent: `Kamu adalah sistem pembuat prompt storyboard UGC tanpa VO dan tanpa dialog untuk Image GPT 2.

Tugasmu: hasilkan hanya 1 prompt final siap pakai untuk membuat 1 gambar storyboard utuh. Dilarang menulis pembukaan, penjelasan, analisa, catatan, markdown, atau pertanyaan. Output hanya prompt final.
Gunakan input:
- Gambar 1 = PRODUK. Hanya gambar ini yang boleh dianalisis untuk memahami fungsi, manfaat, cara pakai, bentuk, tekstur, problem yang diselesaikan, dan selling point. Hasil analisa produk wajib menjadi dasar cerita storyboard.
- Gambar 2 = MODEL. Gunakan hanya sebagai talent visual. Pertahankan wajah, outfit, ciri fisik, dan identitas model.
- Gambar 3 = LOKASI/BACKGROUND. Gunakan hanya sebagai setting visual. Jika tidak ada, gunakan background dari teks user.
- Gambar 4 = REFERENSI LAYOUT STORYBOARD. Gunakan hanya untuk meniru layout, grid, label shot, dan susunan storyboard.

Storyboard UGC selalu 10 detik dan selalu 6 shot. Jangan membuat durasi atau jumlah shot lain.

Cerita wajib relevan dengan produk. Jangan membuat adegan generik. Jangan mengubah bentuk produk. Jangan memperlihatkan cara pakai produk yang salah. Model, produk, dan lokasi harus konsisten di semua panel.

Jangan tulis dialog dan jangan tulis VO. Cerita harus disampaikan lewat visual action, ekspresi model, gesture, penggunaan produk, reaction shot, SFX, ambience, dan camera movement. Jangan ada subtitle, caption, atau teks dialog.

Prompt final wajib berisi: storyboard UGC tanpa VO dan tanpa dialog, rasio gambar, durasi 10 detik, 6 panel, gaya visual natural realistis, deskripsi model, lokasi, produk, instruksi layout mengikuti gambar 4, lalu rincian 6 shot berisi nomor shot, durasi, action, framing/camera angle, visual cue, dan SFX/ambience bila perlu.

Panjang maksimal 1500 karakter. Output hanya prompt final.`,
  },

  commercial: {
    dialog: `Kamu adalah sistem pembuat prompt storyboard commercial dengan dialog untuk Image GPT 2.

Tugasmu: hasilkan hanya 1 prompt final siap pakai untuk membuat 1 gambar storyboard utuh. Dilarang menulis pembukaan, penjelasan, analisa, catatan, markdown, atau pertanyaan. Output hanya prompt final.

Gunakan input:
- Gambar 1 = PRODUK. Hanya gambar ini yang boleh dianalisis untuk memahami fungsi, manfaat utama, cara pakai, bentuk, tekstur, problem yang diselesaikan, dan selling point. Hasil analisa produk wajib menjadi dasar cerita storyboard.
- Gambar 2 = MODEL. Gunakan hanya sebagai talent visual. Pertahankan wajah, outfit, ciri fisik, dan identitas model.
- Gambar 3 = LOKASI/BACKGROUND. Gunakan hanya sebagai setting visual. Jika tidak ada, gunakan background dari teks user.
- Gambar 4 = REFERENSI LAYOUT STORYBOARD. Gunakan hanya untuk meniru layout, grid, label shot, dan susunan storyboard.

Storyboard commercial selalu 10 detik dan selalu 6 shot. Jangan membuat durasi atau jumlah shot lain.

Cerita wajib relevan dengan produk, benefit, selling point, dan cara pakai. Jangan membuat adegan generik. Jangan mengubah bentuk produk. Jangan memperlihatkan cara pakai produk yang salah. Model, produk, dan lokasi harus konsisten di semua panel.

Gunakan DIALOG langsung dari model. Dialog harus sangat singkat, jelas, premium, dan tidak terasa UGC murahan. Maksimal 1 kalimat pendek hanya pada shot yang membutuhkan. Tidak semua shot harus ada dialog.

Prompt final wajib berisi: storyboard commercial dengan dialog, rasio gambar, durasi 10 detik, 6 panel, gaya visual premium sinematik, deskripsi model, lokasi, produk, instruksi layout mengikuti gambar 4, lalu rincian 6 shot berisi nomor shot, durasi, action, framing/camera angle, dialog, dan SFX/music bila perlu.

Panjang maksimal 1500 karakter. Output hanya prompt final.`,

    voiceover: `Kamu adalah sistem pembuat prompt storyboard commercial dengan voice over untuk Image GPT 2.

Tugasmu: hasilkan hanya 1 prompt final siap pakai untuk membuat 1 gambar storyboard utuh. Dilarang menulis pembukaan, penjelasan, analisa, catatan, markdown, atau pertanyaan. Output hanya prompt final.
Gunakan input:
- Gambar 1 = PRODUK. Hanya gambar ini yang boleh dianalisis untuk memahami fungsi, manfaat utama, cara pakai, bentuk, tekstur, problem yang diselesaikan, dan selling point. Hasil analisa produk wajib menjadi dasar cerita storyboard.
- Gambar 2 = MODEL. Gunakan hanya sebagai talent visual. Pertahankan wajah, outfit, ciri fisik, dan identitas model.
- Gambar 3 = LOKASI/BACKGROUND. Gunakan hanya sebagai setting visual. Jika tidak ada, gunakan background dari teks user.
- Gambar 4 = REFERENSI LAYOUT STORYBOARD. Gunakan hanya untuk meniru layout, grid, label shot, dan susunan storyboard.

Storyboard commercial selalu 10 detik dan selalu 6 shot. Jangan membuat durasi atau jumlah shot lain.

Cerita wajib relevan dengan produk, benefit, selling point, dan cara pakai. Jangan membuat adegan generik. Jangan mengubah bentuk produk. Jangan memperlihatkan cara pakai produk yang salah. Model, produk, dan lokasi harus konsisten di semua panel.

Gunakan VO narator bahasa Indonesia yang benar, singkat, tajam, dan terasa seperti iklan profesional. VO tidak harus muncul di semua shot. Sisakan ruang untuk product shot, SFX, dan music.

Prompt final wajib berisi: storyboard commercial dengan VO, rasio gambar, durasi 10 detik, 6 panel, gaya visual premium sinematik, deskripsi model, lokasi, produk, instruksi layout mengikuti gambar 4, lalu rincian 6 shot berisi nomor shot, durasi, action, framing/camera angle, VO, SFX, dan music direction bila perlu.

Panjang maksimal 1500 karakter. Output hanya prompt final.`,

    silent: `Kamu adalah sistem pembuat prompt storyboard commercial tanpa VO dan tanpa dialog untuk Image GPT 2.

Tugasmu: hasilkan hanya 1 prompt final siap pakai untuk membuat 1 gambar storyboard utuh. Dilarang menulis pembukaan, penjelasan, analisa, catatan, markdown, atau pertanyaan. Output hanya prompt final.

Gunakan input:
- Gambar 1 = PRODUK. Hanya gambar ini yang boleh dianalisis untuk memahami fungsi, manfaat utama, cara pakai, bentuk, tekstur, problem yang diselesaikan, dan selling point. Hasil analisa produk wajib menjadi dasar cerita storyboard.
- Gambar 2 = MODEL. Gunakan hanya sebagai talent visual. Pertahankan wajah, outfit, ciri fisik, dan identitas model.
- Gambar 3 = LOKASI/BACKGROUND. Gunakan hanya sebagai setting visual. Jika tidak ada, gunakan background dari teks user.
- Gambar 4 = REFERENSI LAYOUT STORYBOARD. Gunakan hanya untuk meniru layout, grid, label shot, dan susunan storyboard.

Storyboard commercial selalu 10 detik dan selalu 6 shot. Jangan membuat durasi atau jumlah shot lain.

Cerita wajib relevan dengan produk, benefit, selling point, dan cara pakai. Jangan membuat adegan generik. Jangan mengubah bentuk produk. Jangan memperlihatkan cara pakai produk yang salah. Model, produk, dan lokasi harus konsisten di semua panel.

Jangan tulis VO dan jangan tulis dialog. Cerita harus disampaikan lewat visual storytelling, product movement, model expression, camera motion, SFX, music, product macro, usage/detail, result, dan final hero shot. Jangan ada subtitle, caption, atau teks dialog. Teks produk hanya boleh ada jika dibutuhkan untuk product info visual.

Prompt final wajib berisi: storyboard commercial tanpa VO dan tanpa dialog, rasio gambar, durasi 10 detik, 6 panel, gaya visual premium sinematik, deskripsi model, lokasi, produk, instruksi layout mengikuti gambar 4, lalu rincian 6 shot berisi nomor shot, durasi, action, framing/camera angle, visual cue, SFX, dan music direction.

Panjang maksimal 1500 karakter. Output hanya prompt final.`,
  },
};

// Backward compat: old generic prompts (kept for non-storyboard flows)
const PROMPTS = {
  storyboard: `Analisa produk ini dan buatkan 3 prompt untuk generate gambar storyboard.
Output harus JSON array dengan 3 string prompt, format:
["prompt 1", "prompt 2", "prompt 3"]
Setiap prompt harus detail, deskriptif, dan siap pakai untuk AI image generation.
Fokus pada: angle produk, lighting, background, mood, style.
Bahasa Inggris. Jangan tambahkan penjelasan lain, output JSON array saja.`,
  video: `Analisa gambar ini dan buatkan prompt untuk generate video.
Prompt harus detail, deskriptif, dan siap pakai untuk AI video generation.
Fokus pada: gerakan kamera, transisi, efek visual, mood, durasi.
Bahasa Inggris. Output prompt saja, tanpa penjelasan lain.`,
};

// Helper: get prompt by category + variation
function getStoryboardPrompt(category, variation) {
  const cat = STORYBOARD_PROMPTS[category];
  if (!cat) throw new Error(`Kategori tidak dikenal: ${category}. Pilih: ugc, commercial`);
  const prompt = cat[variation];
  if (!prompt) throw new Error(`Variasi tidak dikenal: ${variation}. Pilih: dialog, voiceover, silent`);
  return prompt;
}

// LOCKED PROMPT: Always used for storyboard→video prompt conversion.
// This prompt is sent to Gemini with the generated storyboard image.
const VIDEO_PROMPT_LOCKED = `Kamu adalah sistem pembuat prompt video Seedance 2 dari gambar storyboard.

Tugasmu: analisis gambar storyboard yang saya berikan, lalu hasilkan hanya 1 prompt final siap pakai untuk Seedance 2. Jangan gunakan JSON. Jangan menulis pembukaan, analisa, catatan, markdown, opsi, atau penjelasan. Output hanya prompt final berupa teks prompt biasa.

Aturan utama:
Video selalu berdurasi 10 detik. Format video/aspect ratio mengikuti pengaturan yang dipilih user di video generator, jangan menulis rasio spesifik kecuali memang tertulis di storyboard. Prompt final maksimal 1500 karakter. Ikuti storyboard shot-by-shot sesuai gambar. Jangan membuat cerita baru. Jangan menambah shot baru. Jangan mengubah urutan shot. Pertahankan model, produk, lokasi, outfit, mood visual, lighting, dan continuity dari storyboard. Jika storyboard berisi 6 panel, hasil prompt harus 6 shot. Jika ada teks kecil yang tidak terbaca, tafsirkan dari visual shot secara logis tanpa mengubah cerita. Jika storyboard berisi dialog/VO, masukkan dialog/VO secara ringkas dan natural. Jika storyboard tidak berisi dialog/VO, buat prompt tanpa dialog dan tanpa VO. Jangan tampilkan subtitle, caption, watermark, teks dialog, atau overlay yang tidak diminta. Product info visual hanya boleh muncul jika memang ada di storyboard. Gerakan kamera harus natural dan sesuai tiap shot. Jangan tambahkan backsound atau musik. Gunakan hanya suara natural ambience sesuai lokasi, seperti suara ruangan, langkah kaki, produk digunakan, napas halus, atau ambience lingkungan. Prompt harus cocok untuk generate video realistis di Seedance 2.

Prompt final wajib berisi:
format mengikuti setting video generator, durasi 10 detik, gaya visual, deskripsi model, deskripsi produk, deskripsi lokasi, instruksi continuity, lalu rincian shot berurutan dengan timestamp, action, camera movement, dan audio/VO/dialog/SFX natural jika ada.

Gunakan bahasa Indonesia yang jelas, padat, dan generation-friendly. Output hanya prompt final.`;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

class GeminiEngine {
  constructor(log) {
    this.log = log || (() => {});
    this.win = null;           // hidden BrowserWindow
    this.cookies = {};         // extracted cookie string
    this.authToken = null;     // at= param from page
    this.ready = false;
  }

  // ---- Session Management ----

  // Open hidden window to gemini.google.com, wait for login, extract cookies + auth token.
  // If user already logged in (partition cookies persist), this is fast.
  async init() {
    if (this.ready) return true;

    this.log('[gemini] Menyiapkan session...');

    this.win = new BrowserWindow({
      show: false,
      width: 800,
      height: 600,
      alwaysOnTop: true,
      title: 'Login Google — Aksara Strategy',
      webPreferences: {
        partition: PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });

    // Navigate to Gemini
    await this.win.loadURL(GEMINI_ORIGIN, { userAgent: UA });

    // Wait for page to fully load (check for chat input or login page)
    await sleep(3000);

    // Check if user is logged in by looking for the chat interface
    const isLoggedIn = await this._checkLogin();
    if (!isLoggedIn) {
      this.log('[gemini] PERLU LOGIN! Window terbuka — silakan login Google.');
      this.win.show();
      // Wait for user to login (max 5 minutes)
      const loginOk = await this._waitForLogin(300000);
      if (!loginOk) {
        throw new Error('Login timeout — silakan coba lagi');
      }
      this.win.hide();
    }

    // Extract cookies and auth token
    await this._extractSession();
    this.ready = true;
    this.log('[gemini] Session siap.');
    return true;
  }

  async _checkLogin() {
    try {
      const url = this.win.webContents.getURL();
      if (url.includes('accounts.google.com') || url.includes('Signin')) return false;
      // Check for actual Gemini chat interface — need BOTH the text area AND no login overlay
      const result = await this.win.webContents.executeJavaScript(
        `(function() {
          // Must have the actual Gemini chat input
          var ta = document.querySelector('rich-textarea .ql-editor');
          if (!ta) return false;
          // Must NOT have any "Sign in" button visible
          var signIn = document.querySelector('a[href*="accounts.google.com"]');
          if (signIn && signIn.offsetParent !== null) return false;
          // Check for user avatar (indicates logged in)
          var avatar = document.querySelector('img[data-src*="googleusercontent"], a[aria-label*="Account"], img[alt*="Profile"]');
          return !!avatar || !!ta;
        })()`
      );
      return !!result;
    } catch { return false; }
  }

  async _waitForLogin(timeout) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      await sleep(3000);
      if (await this._checkLogin()) return true;
    }
    return false;
  }

  async _extractSession() {
    const session = this.win.webContents.session;
    const cookieList = await session.cookies.get({ url: GEMINI_ORIGIN });
    this.cookies = {};
    for (const c of cookieList) {
      this.cookies[c.name] = c.value;
    }
    // Extract auth token from page JS
    try {
      this.authToken = await this.win.webContents.executeJavaScript(
        `(function() {
          try {
            const scripts = document.querySelectorAll('script');
            for (const s of scripts) {
              const m = s.textContent.match(/"SNlM0e":"([^"]+)"/);
              if (m) return m[1];
            }
          } catch {}
          return null;
        })()`
      );
    } catch {}
    if (!this.authToken) {
      this.log('[gemini] Warning: auth token tidak ditemukan, akan coba refresh');
    }
  }

  _cookieString() {
    return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  // Refresh auth token (call before each API request if needed)
  async _refreshAuthToken() {
    try {
      this.authToken = await this.win.webContents.executeJavaScript(
        `(function() {
          try {
            const scripts = document.querySelectorAll('script');
            for (const s of scripts) {
              const m = s.textContent.match(/"SNlM0e":"([^"]+)"/);
              if (m) return m[1];
            }
          } catch {}
          return null;
        })()`
      );
    } catch {}
    return this.authToken;
  }

  // ---- API Calls (from main process using extracted cookies) ----

  // Step 1: Start resumable upload → get upload URL
  async _startUpload(filename, fileSize) {
    const body = `File name: ${filename}`;
    const r = await fetch(UPLOAD_URL, {
      method: 'POST',
      headers: {
        ...UPLOAD_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Header-Content-Length': String(fileSize),
        'Cookie': this._cookieString(),
        'Origin': GEMINI_ORIGIN,
        'Referer': GEMINI_ORIGIN + '/',
        'User-Agent': UA,
      },
      body,
    });
    if (!r.ok) throw new Error(`Start upload failed: ${r.status}`);
    const uploadUrl = r.headers.get('x-goog-upload-url');
    if (!uploadUrl) throw new Error('No upload URL in response');
    return uploadUrl;
  }

  // Step 2: Upload file bytes → get file reference path
  async _uploadBinary(uploadUrl, fileBytes, mimeType = 'image/jpeg') {
    const r = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Command': 'upload, finalize',
        'X-Goog-Upload-Offset': '0',
        'Content-Type': mimeType,
        'Cookie': this._cookieString(),
        'Origin': GEMINI_ORIGIN,
        'Referer': GEMINI_ORIGIN + '/',
        'User-Agent': UA,
      },
      body: fileBytes,
    });
    if (!r.ok) throw new Error(`Upload binary failed: ${r.status}`);
    const text = await r.text();
    // Response is the file reference path like /contrib_service/ttl_1d/...
    if (!text.includes('/contrib_service/')) throw new Error('Unexpected upload response: ' + text.slice(0, 200));
    // Extract the path
    const match = text.match(/\/contrib_service\/[^\s"]+/);
    if (!match) throw new Error('Could not parse file reference from response');
    return match[0];
  }

  // Step 3: Send prompt with file references → get AI response
  async _sendPrompt(prompt, fileRefs = []) {
    if (!this.authToken) await this._refreshAuthToken();
    if (!this.authToken) throw new Error('No auth token — user perlu login ulang');

    // Build the f.req payload (matches capture format)
    // The payload is a nested array structure matching BardFrontendService/StreamGenerate
    const inner = [
      [prompt, 0, null, null, null, null, 0],
      null,
      fileRefs.map(ref => [
        null, null, null, null, null, null, null, null, null,
        [ref],    // file reference array
        null, null, null, null, null, null, null, null, null, null,
      ]),
      null, null, null, null, null, null, null, null, null, null, null,
      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
      null, null, null, null, null, null, null, null,
    ];

    const payload = `f.req=${encodeURIComponent(JSON.stringify([null, JSON.stringify(inner)]))}&at=${encodeURIComponent(this.authToken)}&`;

    const r = await fetch(STREAM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Cookie': this._cookieString(),
        'Origin': GEMINI_ORIGIN,
        'Referer': GEMINI_ORIGIN + '/',
        'User-Agent': UA,
      },
      body: payload,
    });

    if (!r.ok) throw new Error(`StreamGenerate failed: ${r.status}`);

    const text = await r.text();
    return this._parseResponse(text);
  }

  // Parse the streaming JSON response (newline-delimited chunks)
  _parseResponse(raw) {
    const lines = raw.split('\n').filter(l => l.trim());
    let fullText = '';

    for (const line of lines) {
      try {
        // Each line is: number\nJSON_ARRAY
        const jsonMatch = line.match(/^\d+\n(.+)$/s);
        if (!jsonMatch) continue;
        const parsed = JSON.parse(jsonMatch[1]);
        // Response structure: [[["response_text",...]], ...]
        if (Array.isArray(parsed) && parsed[0] && Array.isArray(parsed[0])) {
          for (const chunk of parsed[0]) {
            if (Array.isArray(chunk) && chunk[0] && typeof chunk[0] === 'string') {
              // Filter out metadata chunks
              if (chunk[0].length > 5) fullText += chunk[0];
            }
          }
        }
      } catch {}
    }

    return fullText.trim();
  }

  // ---- High-Level Methods ----

  // Upload a file (path or Buffer) and return file reference
  async uploadFile(fileInput, filename) {
    let bytes, name;
    if (typeof fileInput === 'string') {
      bytes = fs.readFileSync(fileInput);
      name = filename || path.basename(fileInput);
    } else {
      bytes = fileInput;
      name = filename || 'upload.jpg';
    }

    // Detect MIME type from extension
    const ext = path.extname(name).toLowerCase();
    const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
    const mimeType = mimeMap[ext] || 'image/jpeg';

    this.log(`[gemini] Upload ${name} (${(bytes.length / 1024).toFixed(1)} KB, ${mimeType})...`);
    const uploadUrl = await this._startUpload(name, bytes.length);
    const fileRef = await this._uploadBinary(uploadUrl, bytes, mimeType);
    this.log(`[gemini] Upload OK: ${fileRef.slice(0, 50)}...`);
    return fileRef;
  }

  // Analyze product images → get storyboard image prompt using selected category/variation.
  // category: 'ugc' | 'commercial'
  // variation: 'dialog' | 'voiceover' | 'silent'
  // imagePaths: [produk, model, lokasi, referensiLayout] (1-4 images)
  async generateStoryboardPrompt(imagePaths, category, variation) {
    await this.init();

    const systemPrompt = getStoryboardPrompt(category, variation);
    this.log(`[gemini] Storyboard: ${category}/${variation} — ${imagePaths.length} gambar...`);

    // Upload all images
    const fileRefs = [];
    for (let i = 0; i < imagePaths.length; i++) {
      const p = imagePaths[i];
      if (!p) continue;
      const ref = await this.uploadFile(p);
      fileRefs.push(ref);
    }

    if (!fileRefs.length) throw new Error('Tidak ada gambar yang berhasil di-upload');

    // Send storyboard prompt with file references
    const raw = await this._sendPrompt(systemPrompt, fileRefs);

    if (!raw || raw.length < 20) {
      throw new Error('Prompt terlalu pendek atau kosong. Response: ' + (raw || '').slice(0, 300));
    }

    this.log(`[gemini] Storyboard prompt siap (${raw.length} chars).`);
    return raw;
  }

  // Analyze generated image → get video prompt (plain text)
  async generateVideoPrompt(imagePath) {
    await this.init();

    this.log('[gemini] Analisa gambar → video prompt...');

    // Upload the generated image
    const fileRef = await this.uploadFile(imagePath);

    // Send video prompt with file reference
    const raw = await this._sendPrompt(PROMPTS.video, [fileRef]);

    if (!raw || raw.length < 10) {
      throw new Error('Video prompt terlalu pendek atau kosong. Response: ' + (raw || '').slice(0, 300));
    }

    this.log(`[gemini] Video prompt siap (${raw.length} chars).`);
    return raw;
  }

  // ---- Lifecycle ----

  // Refresh session (call periodically or before long operations)
  async refresh() {
    if (!this.win || this.win.isDestroyed()) {
      this.ready = false;
      return this.init();
    }
    await this._extractSession();
    return true;
  }

  // Check if session is still valid
  isValid() {
    return this.ready && this.cookies && Object.keys(this.cookies).length > 0;
  }

  // Close hidden window (but keep partition cookies)
  close() {
    if (this.win && !this.win.isDestroyed()) {
      this.win.destroy();
    }
    this.win = null;
    this.ready = false;
  }

  // Destroy everything including partition data
  async destroy() {
    this.close();
    try {
      const session = require('electron').session;
      const ses = session.fromPartition(PARTITION);
      await ses.clearStorageData();
      await ses.clearCache();
    } catch {}
    this.cookies = {};
    this.authToken = null;
  }
}

module.exports = {
  GeminiEngine,
  PROMPTS,
  STORYBOARD_PROMPTS,
  getStoryboardPrompt,
  VIDEO_PROMPT_LOCKED,
  PARTITION,
  UPLOAD_URL,
  STREAM_URL,
};
