// Gemini API engine — uses official Google AI Studio API key.
// NO browser, NO cookies, NO web scraping. Simple fetch calls.
// Supports multi-key rotation with automatic failover on 429/error.
//
// Get free API key: https://aistudio.google.com/apikey
// Free tier: 15 RPM, 1500 RPD — enough for ~750 storyboards/day.

'use strict';

const fs = require('fs');
const path = require('path');

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-2.0-flash';

// ---- Hidden Prompts (hardcoded) ----
const STORYBOARD_PROMPTS = {
  ugc: {
    dialog: `You are a professional storyboard prompt generator for AI image generation.

Analyze the product images provided and create a detailed image generation prompt for a UGC-style storyboard with DIALOG format.

The storyboard should show:
- Frame 1: A person discovering/holding the product with a surprised expression
- Frame 2: The person using/applying the product
- Frame 3: Before/after result showing the product's effect

Output ONLY the image generation prompt in English. Be specific about lighting, camera angle, composition, expressions, and product placement. The prompt should be ready to use with Leonardo AI's Image GPT 2 model.`,

    voiceover: `You are a professional storyboard prompt generator for AI image generation.

Analyze the product images provided and create a detailed image generation prompt for a UGC-style storyboard with VOICEOVER format.

The storyboard should show cinematic shots of the product in use with dramatic lighting and composition.

Output ONLY the image generation prompt in English. Be specific about lighting, camera angle, composition, and product styling. The prompt should be ready to use with Leonardo AI's Image GPT 2 model.`,

    silent: `You are a professional storyboard prompt generator for AI image generation.

Analyze the product images provided and create a detailed image generation prompt for a UGC-style storyboard with SILENT format (text overlay style).

The storyboard should show the product in aesthetic, Instagram-worthy compositions with clean backgrounds.

Output ONLY the image generation prompt in English. Be specific about lighting, camera angle, composition, colors, and product placement. The prompt should be ready to use with Leonardo AI's Image GPT 2 model.`,
  },
  commercial: {
    dialog: `You are a professional storyboard prompt generator for AI image generation.

Analyze the product images provided and create a detailed image generation prompt for a COMMERCIAL-style storyboard with DIALOG format.

The storyboard should show professional, polished shots with studio lighting.

Output ONLY the image generation prompt in English. Be specific about lighting, camera angle, composition, and product styling. The prompt should be ready to use with Leonardo AI's Image GPT 2 model.`,

    voiceover: `You are a professional storyboard prompt generator for AI image generation.

Analyze the product images provided and create a detailed image generation prompt for a COMMERCIAL-style storyboard with VOICEOVER format.

Output ONLY the image generation prompt in English. Be specific about lighting, camera angle, composition, and product styling. The prompt should be ready to use with Leonardo AI's Image GPT 2 model.`,

    silent: `You are a professional storyboard prompt generator for AI image generation.

Analyze the product images provided and create a detailed image generation prompt for a COMMERCIAL-style storyboard with SILENT format.

Output ONLY the image generation prompt in English. Be specific about lighting, camera angle, composition, and product styling. The prompt should be ready to use with Leonardo AI's Image GPT 2 model.`,
  },
};

const VIDEO_PROMPT_LOCKED = `You are a professional video prompt generator for AI video generation (Seedance 2.0).

Analyze this storyboard image and create a detailed video generation prompt.

The prompt should describe:
- Camera movement (slow pan, zoom in, tracking shot, etc.)
- Subject actions and expressions
- Lighting changes or effects
- Duration and pacing
- Mood and atmosphere

Output ONLY the video generation prompt in English. Be specific and cinematic. Max 200 words.`;

function getStoryboardPrompt(category, variation) {
  return STORYBOARD_PROMPTS[category]?.[variation] || STORYBOARD_PROMPTS.ugc.silent;
}

// ---- Gemini API Class (multi-key rotation) ----
class GeminiAPI {
  /**
   * @param {Function} logFn  - logging function
   * @param {Object}   opts
   * @param {string}   [opts.apiKey]         - single key (legacy fallback)
   * @param {Array}    [opts.geminiApiKeys]  - array of {id, api_key, label} from server
   * @param {string}   [opts.licenseKey]     - license key for error reporting
   * @param {string}   [opts.adminUrl]       - base URL for report endpoint
   */
  constructor(logFn, opts = {}) {
    this.log = logFn || (() => {});
    // Support legacy single-key constructor: (logFn, apiKey)
    if (typeof opts === 'string') {
      opts = { apiKey: opts };
    }
    this.licenseKey = opts.licenseKey || '';
    this.adminUrl = opts.adminUrl || '';

    // Build key pool from server-provided keys, fallback to single key
    this._keys = [];
    if (Array.isArray(opts.geminiApiKeys) && opts.geminiApiKeys.length > 0) {
      this._keys = opts.geminiApiKeys.map(k => ({
        id: k.id,
        apiKey: k.api_key,
        label: k.label || '',
      }));
    } else if (opts.apiKey) {
      // Legacy: single key, no server id
      this._keys = [{ id: 0, apiKey: opts.apiKey, label: 'local' }];
    }

    this._cursor = 0; // round-robin cursor
    this.log(`[gemini-api] Initialized with ${this._keys.length} API key(s)`);
  }

  /** Update key pool (called after license validate returns new keys) */
  updateKeys(geminiApiKeys) {
    if (!Array.isArray(geminiApiKeys) || geminiApiKeys.length === 0) return;
    this._keys = geminiApiKeys.map(k => ({
      id: k.id,
      apiKey: k.api_key,
      label: k.label || '',
    }));
    this._cursor = 0;
    this.log(`[gemini-api] Key pool updated: ${this._keys.length} key(s)`);
  }

  /** Total keys available */
  get keyCount() { return this._keys.length; }

  /** Get current key info (for UI display) */
  get currentKeyInfo() {
    if (!this._keys.length) return null;
    const k = this._keys[this._cursor % this._keys.length];
    return { id: k.id, label: k.label, masked: k.apiKey.slice(0, 8) + '…' + k.apiKey.slice(-4) };
  }

  /** Select next key (round-robin, skip errored) */
  _nextKey() {
    if (!this._keys.length) throw new Error('Tidak ada Gemini API key tersedia');
    const start = this._cursor;
    for (let i = 0; i < this._keys.length; i++) {
      const idx = (start + i) % this._keys.length;
      this._cursor = (idx + 1) % this._keys.length; // advance for next call
      return this._keys[idx];
    }
    // All keys tried — just use the next one anyway
    const idx = start % this._keys.length;
    this._cursor = (idx + 1) % this._keys.length;
    return this._keys[idx];
  }

  /** Report usage/error back to server (fire-and-forget) */
  _report(keyId, success, errorMessage) {
    if (!this.licenseKey || !this.adminUrl || keyId === 0) return;
    const url = `${this.adminUrl}/api/admin/keys/${encodeURIComponent(this.licenseKey)}/gemini-keys/${keyId}/report`;
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success, error_message: errorMessage || null }),
    }).catch(() => {}); // fire-and-forget
  }

  // Send prompt with images -> get text response (with rotation)
  async generate(prompt, imagePaths = []) {
    if (!this._keys.length) throw new Error('Gemini API key belum di-set');

    // Build parts array (same for all attempts)
    const parts = [{ text: prompt }];
    for (const imgPath of imagePaths) {
      if (!imgPath || !fs.existsSync(imgPath)) continue;
      const bytes = fs.readFileSync(imgPath);
      const ext = path.extname(imgPath).toLowerCase().replace('.', '');
      const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
      const mimeType = mimeMap[ext] || 'image/jpeg';
      parts.push({
        inlineData: {
          mimeType,
          data: bytes.toString('base64'),
        },
      });
      this.log(`[gemini-api] Added image: ${path.basename(imgPath)} (${(bytes.length / 1024).toFixed(0)}KB)`);
    }

    // Try each key up to once
    const maxAttempts = this._keys.length;
    let lastError = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const keyObj = this._nextKey();
      this.log(`[gemini-api] Attempt ${attempt + 1}/${maxAttempts} — key: ${keyObj.label || keyObj.apiKey.slice(0, 8) + '…'} (${parts.length} parts)`);

      const url = `${API_BASE}/${MODEL}:generateContent?key=${keyObj.apiKey}`;
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048,
            },
          }),
        });

        if (r.ok) {
          const data = await r.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          this.log(`[gemini-api] Success via ${keyObj.label || 'key'}: ${text.length} chars`);
          this._report(keyObj.id, true);
          return text.trim();
        }

        // 429 = rate limit, 503 = overload — try next key
        const errBody = await r.text().catch(() => '');
        const errMsg = `HTTP ${r.status}: ${errBody.slice(0, 200)}`;
        this.log(`[gemini-api] Error ${r.status} on key ${keyObj.label || '…'}: ${errBody.slice(0, 300)}`);
        lastError = new Error(`Gemini API error: ${r.status}`);

        // Report failure for this key
        this._report(keyObj.id, false, errMsg);

        if (r.status === 429 || r.status === 503 || r.status === 500) {
          // Rate limit or server error — rotate to next key
          this.log(`[gemini-api] Rotating to next key...`);
          continue;
        }

        // Other errors (400, 403, etc.) — likely bad key, but try next
        if (r.status === 403 || r.status === 401) {
          this.log(`[gemini-api] Key invalid/forbidden, rotating...`);
          continue;
        }

        // Non-retryable error
        throw lastError;
      } catch (fetchErr) {
        if (fetchErr.message?.startsWith('Gemini API error')) throw fetchErr;
        lastError = fetchErr;
        this.log(`[gemini-api] Fetch error: ${fetchErr.message}`);
        this._report(keyObj.id, false, fetchErr.message);
        continue;
      }
    }

    // All keys exhausted
    throw lastError || new Error('Semua Gemini API key gagal');
  }

  // Convenience: analyze images with a prompt
  async analyze(prompt, imagePaths = []) {
    return this.generate(prompt, imagePaths);
  }
}

module.exports = { GeminiAPI, getStoryboardPrompt, VIDEO_PROMPT_LOCKED };
