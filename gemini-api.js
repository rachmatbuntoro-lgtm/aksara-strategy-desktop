// Gemini API engine — uses official Google AI Studio API key.
// NO browser, NO cookies, NO web scraping. Simple fetch calls.
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

// ---- Gemini API Class ----
class GeminiAPI {
  constructor(logFn, apiKey) {
    this.log = logFn || (() => {});
    this.apiKey = apiKey;
  }

  // Send prompt with images → get text response
  async generate(prompt, imagePaths = []) {
    if (!this.apiKey) throw new Error('Gemini API key belum di-set');

    // Build parts array
    const parts = [{ text: prompt }];

    // Add images as inline base64
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

    this.log(`[gemini-api] Calling ${MODEL} with ${parts.length} parts...`);

    const url = `${API_BASE}/${MODEL}:generateContent?key=${this.apiKey}`;
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

    if (!r.ok) {
      const errBody = await r.text().catch(() => '');
      this.log(`[gemini-api] Error ${r.status}: ${errBody.slice(0, 300)}`);
      throw new Error(`Gemini API error: ${r.status}`);
    }

    const data = await r.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    this.log(`[gemini-api] Response: ${text.length} chars`);
    return text.trim();
  }

  // Convenience: analyze images with a prompt
  async analyze(prompt, imagePaths = []) {
    return this.generate(prompt, imagePaths);
  }
}

module.exports = { GeminiAPI, getStoryboardPrompt, VIDEO_PROMPT_LOCKED };
