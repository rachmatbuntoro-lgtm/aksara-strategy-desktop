// AI API engine — MiMo v2.5 primary, Gemini fallback.
// OpenAI-compatible API format for MiMo, native Gemini format for fallback.
// Supports multi-key rotation with automatic failover on error.
//
// MiMo API: https://platform.xiaomimimo.com
// Gemini API: https://aistudio.google.com/apikey

'use strict';

const fs = require('fs');
const path = require('path');

// ---- Provider Config ----
const PROVIDERS = {
  mimo: {
    apiBase: 'https://api.xiaomimimo.com/v1',
    model: 'mimo-v2.5',  // omnimodal — image+video+audio+text (NOT mimo-v2.5-pro which is text-only!)
    format: 'openai',    // OpenAI-compatible
  },
  gemini: {
    apiBase: 'https://generativelanguage.googleapis.com/v1beta/models',
    model: 'gemini-2.5-flash-lite',
    format: 'gemini',    // native Gemini format
  },
};

// ---- Hidden Prompts (hardcoded) ----
const STORYBOARD_PROMPTS = {
  ugc: {
    dialog: `You are a storyboard prompt expert for Leonardo AI's Image GPT 2 model.

Analyze the product images and generate TWO prompts.

IMAGES PROVIDED:
- Image 1: Product photo
- Image 2: Model/person reference
- Image 3: Background/location reference (MUST be used as setting)
- Image 4: Layout reference (composition guide)

STYLE: UGC Dialog
BRIEF: {brief}

RULES:
- Image 3 = LOCATION/BACKGROUND. Describe it in extreme detail: wall color, furniture, lighting direction, materials, decorations, window placement. This background MUST be the primary setting.
- Match the product appearance from Image 1 exactly (color, shape, label)
- Match the model appearance from Image 2 (clothing, hair, skin tone)
- 16:9 horizontal composition
- UGC style: casual, relatable, phone-camera feel, natural lighting

OUTPUT FORMAT (strict):
---IMAGE_PROMPT---
[150-250 word image prompt. Start with background description from Image 3, then describe subject, action, expression, lighting, camera angle. In English only.]

---VIDEO_PROMPT---
[10-second video prompt, max 1500 characters. Opening (0-2s), main action (2-7s), closing (7-10s). Camera movements, subject actions, lighting, mood. In English only.]

Output ONLY the two prompts, nothing else.`,

    voiceover: `You are a storyboard prompt expert for Leonardo AI's Image GPT 2 model.

Analyze the product images and generate TWO prompts.

IMAGES PROVIDED:
- Image 1: Product photo
- Image 2: Model/person reference
- Image 3: Background/location reference (MUST be used as setting)
- Image 4: Layout reference (composition guide)

STYLE: UGC Voiceover
BRIEF: {brief}

RULES:
- Image 3 = LOCATION/BACKGROUND. Describe it in extreme detail: wall color, furniture, lighting direction, materials, decorations. This background MUST be the primary setting.
- Match the product appearance from Image 1 exactly
- Match the model appearance from Image 2
- 16:9 horizontal composition
- UGC style: lifestyle, influencer aesthetic, warm tones, cinematic feel

OUTPUT FORMAT (strict):
---IMAGE_PROMPT---
[150-250 word image prompt. Start with background description from Image 3, then describe subject, action, product placement, lighting, camera angle. In English only.]

---VIDEO_PROMPT---
[10-second video prompt, max 1500 characters. Opening (0-2s), main action (2-7s), closing (7-10s). Camera movements, subject actions, lighting, mood. In English only.]

Output ONLY the two prompts, nothing else.`,

    silent: `You are a storyboard prompt expert for Leonardo AI's Image GPT 2 model.

Analyze the product images and generate TWO prompts.

IMAGES PROVIDED:
- Image 1: Product photo
- Image 2: Model/person reference
- Image 3: Background/location reference (MUST be used as setting)
- Image 4: Layout reference (composition guide)

STYLE: UGC Silent (text overlay friendly)
BRIEF: {brief}

RULES:
- Image 3 = LOCATION/BACKGROUND. Describe it in extreme detail. This background MUST be the primary setting.
- Match the product appearance from Image 1 exactly
- Match the model appearance from Image 2
- 16:9 horizontal composition
- UGC style: aesthetic, Instagram-worthy, clean, minimal, text-overlay friendly

OUTPUT FORMAT (strict):
---IMAGE_PROMPT---
[150-250 word image prompt. Start with background description from Image 3, then describe subject, product, composition, colors, lighting. Leave negative space for text overlay. In English only.]

---VIDEO_PROMPT---
[10-second video prompt, max 1500 characters. Opening (0-2s), main action (2-7s), closing (7-10s). Gentle camera movements, product focus, clean aesthetic. In English only.]

Output ONLY the two prompts, nothing else.`,
  },
  commercial: {
    dialog: `You are a storyboard prompt expert for Leonardo AI's Image GPT 2 model.

Analyze the product images and generate TWO prompts.

IMAGES PROVIDED:
- Image 1: Product photo
- Image 2: Model/person reference
- Image 3: Background/location reference (MUST be used as setting)
- Image 4: Layout reference (composition guide)

STYLE: Commercial Dialog
BRIEF: {brief}

RULES:
- Image 3 = LOCATION/BACKGROUND. Describe it in extreme detail. This background MUST be the primary setting.
- Match the product appearance from Image 1 exactly
- Match the model appearance from Image 2
- 16:9 horizontal composition
- Commercial style: professional, polished, studio-quality, brand-focused

OUTPUT FORMAT (strict):
---IMAGE_PROMPT---
[150-250 word image prompt. Start with background description from Image 3, then describe subject, action, expression, lighting, camera angle, product placement. In English only.]

---VIDEO_PROMPT---
[10-second video prompt, max 1500 characters. Opening (0-2s), main action (2-7s), closing (7-10s). Cinematic camera movements, professional lighting, brand storytelling. In English only.]

Output ONLY the two prompts, nothing else.`,

    voiceover: `You are a storyboard prompt expert for Leonardo AI's Image GPT 2 model.

Analyze the product images and generate TWO prompts.

IMAGES PROVIDED:
- Image 1: Product photo
- Image 2: Model/person reference
- Image 3: Background/location reference (MUST be used as setting)
- Image 4: Layout reference (composition guide)

STYLE: Commercial Voiceover
BRIEF: {brief}

RULES:
- Image 3 = LOCATION/BACKGROUND. Describe it in extreme detail. This background MUST be the primary setting.
- Match the product appearance from Image 1 exactly
- Match the model appearance from Image 2
- 16:9 horizontal composition
- Commercial style: cinematic, high-end, dramatic lighting, aspirational

OUTPUT FORMAT (strict):
---IMAGE_PROMPT---
[150-250 word image prompt. Start with background description from Image 3, then describe subject, product hero shot, lighting, camera angle, mood. In English only.]

---VIDEO_PROMPT---
[10-second video prompt, max 1500 characters. Opening (0-2s), main action (2-7s), closing (7-10s). Dramatic camera movements, cinematic lighting, premium feel. In English only.]

Output ONLY the two prompts, nothing else.`,

    silent: `You are a storyboard prompt expert for Leonardo AI's Image GPT 2 model.

Analyze the product images and generate TWO prompts.

IMAGES PROVIDED:
- Image 1: Product photo
- Image 2: Model/person reference
- Image 3: Background/location reference (MUST be used as setting)
- Image 4: Layout reference (composition guide)

STYLE: Commercial Silent
BRIEF: {brief}

RULES:
- Image 3 = LOCATION/BACKGROUND. Describe it in extreme detail. This background MUST be the primary setting.
- Match the product appearance from Image 1 exactly
- Match the model appearance from Image 2
- 16:9 horizontal composition
- Commercial style: clean, minimal, product-focused, magazine quality

OUTPUT FORMAT (strict):
---IMAGE_PROMPT---
[150-250 word image prompt. Start with background description from Image 3, then describe product hero shot, lighting, composition, colors. In English only.]

---VIDEO_PROMPT---
[10-second video prompt, max 1500 characters. Opening (0-2s), main action (2-7s), closing (7-10s). Slow elegant camera movements, product showcase, premium aesthetic. In English only.]

Output ONLY the two prompts, nothing else.`,
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

// ---- AI API Class (multi-provider, multi-key rotation) ----
class GeminiAPI {
  /**
   * @param {Function} logFn  - logging function
   * @param {Object}   opts
   * @param {string}   [opts.apiKey]         - single key (legacy fallback)
   * @param {Array}    [opts.geminiApiKeys]  - array of {id, api_key, label} from server
   * @param {string}   [opts.licenseKey]     - license key for error reporting
   * @param {string}   [opts.adminUrl]       - base URL for report endpoint
   * @param {string}   [opts.provider]       - 'mimo' or 'gemini' (default: 'mimo')
   */
  constructor(logFn, opts = {}) {
    this.log = logFn || (() => {});
    if (typeof opts === 'string') {
      opts = { apiKey: opts };
    }
    this.licenseKey = opts.licenseKey || '';
    this.adminUrl = opts.adminUrl || '';

    // Provider selection (default: mimo)
    this._providerName = opts.provider || 'mimo';
    this._provider = PROVIDERS[this._providerName] || PROVIDERS.mimo;

    // Build key pool
    this._keys = [];
    if (Array.isArray(opts.geminiApiKeys) && opts.geminiApiKeys.length > 0) {
      this._keys = opts.geminiApiKeys.map(k => ({
        id: k.id,
        apiKey: k.api_key,
        label: k.label || '',
      }));
    } else if (opts.apiKey) {
      this._keys = [{ id: 0, apiKey: opts.apiKey, label: 'local' }];
    }

    this._cursor = 0;
    this._lastCallTime = 0;
    this._minIntervalMs = 1000; // 1s between calls (MiMo: 100 RPM, safe)
    this.log(`[ai-api] Initialized with ${this._keys.length} key(s), provider: ${this._providerName}, model: ${this._provider.model}`);
  }

  /** Update key pool */
  updateKeys(geminiApiKeys) {
    if (!Array.isArray(geminiApiKeys) || geminiApiKeys.length === 0) return;
    this._keys = geminiApiKeys.map(k => ({
      id: k.id,
      apiKey: k.api_key,
      label: k.label || '',
    }));
    this._cursor = 0;
    this.log(`[ai-api] Key pool updated: ${this._keys.length} key(s)`);
  }

  get keyCount() { return this._keys.length; }

  get currentKeyInfo() {
    if (!this._keys.length) return null;
    const k = this._keys[this._cursor % this._keys.length];
    return { id: k.id, label: k.label, masked: k.apiKey.slice(0, 8) + '…' + k.apiKey.slice(-4) };
  }

  _nextKey() {
    if (!this._keys.length) throw new Error('Tidak ada API key tersedia');
    const idx = this._cursor % this._keys.length;
    this._cursor = (idx + 1) % this._keys.length;
    return this._keys[idx];
  }

  _report(keyId, success, errorMessage) {
    if (!this.licenseKey || !this.adminUrl || keyId === 0) return;
    const url = `${this.adminUrl}/api/admin/keys/${encodeURIComponent(this.licenseKey)}/gemini-keys/${keyId}/report`;
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success, error_message: errorMessage || null }),
    }).catch(() => {});
  }

  /** Build OpenAI-format image content from file paths */
  _buildImageParts(imagePaths) {
    const imageParts = [];
    for (const imgPath of imagePaths) {
      if (!imgPath || !fs.existsSync(imgPath)) continue;
      const bytes = fs.readFileSync(imgPath);
      const ext = path.extname(imgPath).toLowerCase().replace('.', '');
      const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
      const mimeType = mimeMap[ext] || 'image/jpeg';
      imageParts.push({
        type: 'image_url',
        image_url: { url: `data:${mimeType};base64,${bytes.toString('base64')}` },
      });
      this.log(`[ai-api] Added image: ${path.basename(imgPath)} (${(bytes.length / 1024).toFixed(0)}KB)`);
    }
    return imageParts;
  }

  /** Make request in OpenAI-compatible format (MiMo) */
  async _callOpenAI(prompt, imageParts, keyObj) {
    const content = [
      { type: 'text', text: prompt },
      ...imageParts,
    ];

    const url = `${this._provider.apiBase}/chat/completions`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keyObj.apiKey}`,
      },
      body: JSON.stringify({
        model: this._provider.model,
        messages: [{ role: 'user', content }],
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (r.ok) {
      const data = await r.json();
      // MiMo returns reasoning_content separately; prefer content
      const msg = data.choices?.[0]?.message || {};
      const text = msg.content || msg.reasoning_content || '';
      if (!msg.content && msg.reasoning_content) {
        this.log(`[ai-api] WARNING: MiMo returned reasoning_content only, no content`);
      }
      return text.trim();
    }

    const errBody = await r.text().catch(() => '');
    const err = new Error(`API error: ${r.status} ${errBody.slice(0, 200)}`);
    err.status = r.status;
    throw err;
  }

  /** Make request in native Gemini format (fallback) */
  async _callGemini(prompt, imageParts, keyObj) {
    const parts = [{ text: prompt }];
    for (const img of imageParts) {
      const base64Data = img.image_url.url.split(',')[1];
      parts.push({
        inlineData: {
          mimeType: img.image_url.url.split(';')[0].replace('data:', ''),
          data: base64Data,
        },
      });
    }

    const url = `${this._provider.apiBase}/${this._provider.model}:generateContent?key=${keyObj.apiKey}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    });

    if (r.ok) {
      const data = await r.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return text.trim();
    }

    const errBody = await r.text().catch(() => '');
    const err = new Error(`API error: ${r.status} ${errBody.slice(0, 200)}`);
    err.status = r.status;
    throw err;
  }

  /** Main generate method with multi-key rotation + retry */
  async generate(prompt, imagePaths = []) {
    if (!this._keys.length) throw new Error('API key belum di-set');

    const imageParts = this._buildImageParts(imagePaths);
    const maxRounds = 3;
    let lastError = null;

    // Proactive rate limiting
    const now = Date.now();
    const elapsed = now - this._lastCallTime;
    if (elapsed < this._minIntervalMs) {
      const waitMs = this._minIntervalMs - elapsed;
      this.log(`[ai-api] Rate limiting: waiting ${(waitMs / 1000).toFixed(1)}s...`);
      await new Promise(r => setTimeout(r, waitMs));
    }
    this._lastCallTime = Date.now();

    // Select the right API caller
    const callFn = this._provider.format === 'openai'
      ? (p, img, k) => this._callOpenAI(p, img, k)
      : (p, img, k) => this._callGemini(p, img, k);

    for (let round = 0; round < maxRounds; round++) {
      if (round > 0) {
        const waitSec = 30 * round;
        this.log(`[ai-api] All keys failed. Round ${round + 1}/${maxRounds} — waiting ${waitSec}s...`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
      }

      for (let attempt = 0; attempt < this._keys.length; attempt++) {
        const keyObj = this._nextKey();
        this.log(`[ai-api] Round ${round + 1}, attempt ${attempt + 1}/${this._keys.length} — key: ${keyObj.label || keyObj.apiKey.slice(0, 8) + '…'} (${imageParts.length} images)`);

        try {
          const text = await callFn(prompt, imageParts, keyObj);
          this.log(`[ai-api] Success via ${keyObj.label || 'key'}: ${text.length} chars`);
          this.log(`[ai-api] Response preview: ${text.slice(0, 200)}`);
          this._report(keyObj.id, true);
          return text;
        } catch (err) {
          const status = err.status || 0;
          this.log(`[ai-api] Error ${status}: ${err.message?.slice(0, 200)}`);
          lastError = err;
          this._report(keyObj.id, false, err.message);

          // Retryable errors: 429, 500, 503, network
          if (status === 429 || status === 500 || status === 503 || status === 0) {
            continue;
          }
          // Bad key: 401, 403
          if (status === 401 || status === 403) {
            this.log(`[ai-api] Key invalid, trying next...`);
            continue;
          }
          // Non-retryable
          throw err;
        }
      }
    }

    throw lastError || new Error(`Semua API key gagal setelah ${maxRounds} percobaan`);
  }

  async analyze(prompt, imagePaths = []) {
    return this.generate(prompt, imagePaths);
  }
}

module.exports = { GeminiAPI, getStoryboardPrompt, VIDEO_PROMPT_LOCKED };
