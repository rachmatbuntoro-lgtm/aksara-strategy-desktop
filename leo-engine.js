// WebKita Leonardo engine — JS port of leo_engine.py (verified against live captures).
// All calls via https://api.leonardo.ai/v1/graphql with Bearer JWT.
'use strict';

const GQL = 'https://api.leonardo.ai/v1/graphql';
const SCHEMA_VERSION = '1.158.3';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36';

// ---- model registry (exact, user-confirmed) ----
const MODELS = {
  'veo-3.1-fast':      { id: 'veo-3.1-fast-generate-001', modes: ['start_frame','end_frame'],
                         durations: [4,6,8], locked_res: 'RESOLUTION_1080', omni_max: 0, ratios: ['16:9','9:16'] },
  'seedance-2.0':      { id: 'seedance-2.0', modes: ['image_reference','start_frame','end_frame'],
                         durations: [5,10], locked_res: 'RESOLUTION_720', omni_max: 4, ratios: ['16:9','9:16'] },
  'kling-3.0':         { id: 'kling-3.0', modes: ['start_frame','end_frame'],
                         durations: [5,10,15], locked_res: 'RESOLUTION_1080', omni_max: 0, ratios: ['16:9','9:16'] },
};
const RATIO_DIMS = {
  RESOLUTION_480:  { '16:9': [854,480],   '9:16': [480,854] },
  RESOLUTION_720:  { '16:9': [1280,720],  '9:16': [720,1280] },
  RESOLUTION_1080: { '16:9': [1920,1080], '9:16': [1080,1920] },
};
// EXACT token cost per (model,duration) — user-confirmed from Leonardo UI.
const COST_TABLE = {
  'veo-3.1-fast':      { 4:600, 6:900, 8:1200 },
  'seedance-2.0':      { 5:1209, 10:2419 },
  'kling-3.0':         { 5:840, 10:1680, 15:2520 },
};
function estimateCost(model, duration) {
  const tbl = COST_TABLE[model] || {};
  if (tbl[duration] != null) return tbl[duration];
  const ks = Object.keys(tbl).map(Number);
  if (ks.length) return Math.round((Math.max(...Object.values(tbl)) / Math.max(...ks)) * duration);
  return 250 * duration;
}

// ---- GraphQL query strings (verbatim from capture) ----
const Q_UPLOAD = `mutation UploadImage($uploadImageInput: UploadImageInput!) {
  uploadImage(arg1: $uploadImageInput) { uploadId url fields __typename }
}`;
const Q_MODERATION = `query GetInitImageModeration($akUUID: uuid!) {
  init_image_moderation(where: {akUUID: {_eq: $akUUID}}) { akUUID initImageId checkStatus __typename }
}`;
const Q_GENERATE = `mutation Generate($request: CreateGenerationRequest!) {
  generate(request: $request) { apiCreditCost generationId __typename }
}`;
const Q_TOKENS = `query GetUserTokensFromSub($sub: String) {
  user_details(where: {cognitoId: {_eq: $sub}}) {
    id plan subscriptionTokens paidTokens rolloverTokens tokenRenewalDate __typename
  }
}`;
const Q_STATUS = `query GetAIGenerationFeedStatuses($where: generations_bool_exp = {}) {
  generations(where: $where) { id status __typename }
}`;
const Q_FEED = `query GetAIGenerationFeed($where: generations_bool_exp = {}, $limit: Int, $offset: Int = 0) {
  generations(limit: $limit, offset: $offset, order_by: [{createdAt: desc}], where: $where) {
    id status createdAt generated_images { id url motionMP4URL __typename } __typename
  }
}`;

// ---- Image generation (gpt-image-2) ----
const IMAGE_MODELS = {
  'gpt-image-2': { id: 'gpt-image-2', ratios: ['16:9', '9:16', '1:1', '2:3'] },
  'nano-banana-2': { id: 'nano-banana-2', ratios: ['16:9', '9:16', '1:1', '2:3'] },
};
const IMAGE_COST = { '16:9': 573, '9:16': 573, '1:1': 1033, '2:3': 694 };
const IMAGE_Q_FEED = `query GetAIGenerationFeed($where: generations_bool_exp = {}, $limit: Int) {
  generations(limit: $limit, order_by: [{createdAt: desc}], where: $where) {
    id status createdAt generated_images { id url __typename } __typename
  }
}`;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function subFromToken(token) {
  try {
    const p = token.split('.')[1];
    const json = Buffer.from(p.replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString('utf8');
    const c = JSON.parse(json);
    return c.sub || c['cognito:username'] || null;
  } catch { return null; }
}
function tokenExp(token) {
  try {
    const p = token.split('.')[1];
    const c = JSON.parse(Buffer.from(p.replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString('utf8'));
    return c.exp || 0;
  } catch { return 0; }
}

class LeoEngine {
  constructor(token, userId, schema = SCHEMA_VERSION) {
    this.token = token;
    this.userId = userId;
    this.sub = subFromToken(token);
    this.schema = schema;
  }
  headers() {
    return {
      authorization: `Bearer ${this.token}`,
      'content-type': 'application/json',
      'x-leo-schema-version': this.schema,
      accept: '*/*',
      origin: 'https://app.leonardo.ai',
      referer: 'https://app.leonardo.ai/',
      'User-Agent': UA,
    };
  }
  async gql(op, query, variables) {
    const r = await fetch(GQL, { method: 'POST', headers: this.headers(),
      body: JSON.stringify({ operationName: op, variables, query }) });
    const j = await r.json().catch(() => ({}));
    if (j.errors) throw new Error(`${op} errors: ${JSON.stringify(j.errors).slice(0,400)}`);
    if (!r.ok) throw new Error(`${op} HTTP ${r.status}`);
    return j.data;
  }
  async getCredits() {
    const d = await this.gql('GetUserTokensFromSub', Q_TOKENS, { sub: this.sub });
    const ud = (d.user_details || [{}])[0] || {};
    const s = ud.subscriptionTokens || 0, p = ud.paidTokens || 0, ro = ud.rolloverTokens || 0;
    return { subscription: s, paid: p, rollover: ro, total: s + p + ro };
  }
  tokenValid(marginSec = 120) { return tokenExp(this.token) - Math.floor(Date.now()/1000) > marginSec; }

  // 1+2+3: upload an image (Buffer or path), return its initImageId.
  async uploadImage(bytes, ext = 'jpg', pollTimeout = 60000) {
    const fs = require('fs');
    if (typeof bytes === 'string') { ext = (bytes.split('.').pop() || 'jpg').toLowerCase(); bytes = fs.readFileSync(bytes); }
    if (ext === 'jpeg') ext = 'jpg';
    const d = await this.gql('UploadImage', Q_UPLOAD, { uploadImageInput: { uploadType: 'INIT', extension: ext } });
    const up = d.uploadImage;
    const fields = JSON.parse(up.fields);
    const ctype = fields['Content-Type'] || (ext === 'png' ? 'image/png' : 'image/jpeg');
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);     // presigned fields FIRST
    fd.append('file', new Blob([bytes], { type: ctype }), `upload.${ext}`); // file LAST
    const s3 = await fetch(up.url, { method: 'POST', body: fd });
    if (![200,201,204].includes(s3.status)) throw new Error(`S3 upload failed ${s3.status}`);
    const deadline = Date.now() + pollTimeout;
    while (Date.now() < deadline) {
      const md = await this.gql('GetInitImageModeration', Q_MODERATION, { akUUID: up.uploadId });
      const rows = md.init_image_moderation || [];
      if (rows[0] && rows[0].checkStatus === 'Accepted' && rows[0].initImageId) return rows[0].initImageId;
      if (rows[0] && ['Rejected','Failed'].includes(rows[0].checkStatus)) throw new Error(`moderation ${rows[0].checkStatus}`);
      await sleep(2000);
    }
    throw new Error('image moderation timed out');
  }

  // 4: start a generation. ratio is the ONLY size choice; resolution is locked per model.
  async generate(prompt, { model = 'veo-3.1-fast', ratio = '9:16', duration = 8, audio = true,
                 startFrameId = null, endFrameId = null, omniIds = null, omniStrength = 'MID',
                 publicGen = true, quantity = 1, seed = null } = {}) {
    const spec = MODELS[model];
    const modelId = spec ? spec.id : model;
    const mode = spec ? spec.locked_res : 'RESOLUTION_1080';
    if (spec && !spec.ratios.includes(ratio)) throw new Error(`${model} ratios ${spec.ratios}, got ${ratio}`);
    const dims = (RATIO_DIMS[mode] || {})[ratio];
    if (!dims) throw new Error(`no dims for ${mode} ${ratio}`);
    const [width, height] = dims;
    if (spec && !spec.durations.includes(duration)) throw new Error(`${model} durations ${spec.durations}, got ${duration}`);
    const params = { height, width, duration, mode, motion_has_audio: audio, quantity, prompt };
    const g = {};
    if (startFrameId) g.start_frame = [{ image: { id: startFrameId, type: 'UPLOADED' } }];
    if (endFrameId)   g.end_frame   = [{ image: { id: endFrameId, type: 'UPLOADED' } }];
    if (omniIds && omniIds.length) {
      const max = (spec || {}).omni_max || 0;
      if (max && omniIds.length > max) throw new Error(`${model} omni max ${max}`);
      g.image_reference = omniIds.map(id => ({ image: { id, type: 'UPLOADED' }, strength: omniStrength }));
    }
    if (Object.keys(g).length) params.guidances = g;
    if (seed != null) params.seed = seed;
    else if (model.startsWith('seedance')) params.seed = -1;
    const d = await this.gql('Generate', Q_GENERATE, { request: { model: modelId, public: publicGen, parameters: params } });
    return d.generate.generationId;
  }

  // 5: poll until COMPLETE
  async waitComplete(genId, { timeout = 600000, interval = 6000, onTick = null } = {}) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const d = await this.gql('GetAIGenerationFeedStatuses', Q_STATUS,
        { where: { id: { _in: [genId] }, status: { _in: ['PENDING','COMPLETE','FAILED'] } } });
      const st = (d.generations[0] || {}).status || 'PENDING';
      if (onTick) onTick(st);
      if (st === 'COMPLETE') return true;
      if (st === 'FAILED') throw new Error('generation FAILED');
      await sleep(interval);
    }
    throw new Error('generation timed out');
  }

  // 6: fetch mp4 url. Query by generation id ONLY (it's globally unique) — filtering by
  // userId breaks when this.userId is empty/mismatched (uid came from localStorage, which
  // can differ from the token's user). Retry: the feed + motionMP4URL lag a few seconds
  // after status flips to COMPLETE.
  async getVideoUrl(genId, { tries = 15, interval = 3000 } = {}) {
    let lastErr = 'unknown';
    for (let i = 0; i < tries; i++) {
      const d = await this.gql('GetAIGenerationFeed', Q_FEED,
        { where: { id: { _eq: genId } }, limit: 1 });
      const gens = d.generations || [];
      if (!gens.length) { lastErr = 'generation not in feed'; }
      else {
        for (const img of (gens[0].generated_images || [])) if (img.motionMP4URL) return img.motionMP4URL;
        lastErr = 'no motionMP4URL yet';
      }
      await sleep(interval);
    }
    throw new Error(lastErr);
  }

  // ---- Image generation (gpt-image-2) ----

  // Generate an image. Returns generationId.
  async generateImage(prompt, { ratio = '1:1', quality = 'HIGH', promptEnhance = true,
                                   styleIds = [], publicGen = true, quantity = 1,
                                   refImageId = null, refStrength = null,
                                   model = 'gpt-image-2' } = {}) {
    const spec = IMAGE_MODELS[model];
    if (!spec) throw new Error(`Unknown model: ${model}. Available: ${Object.keys(IMAGE_MODELS).join(', ')}`);
    if (!spec.ratios.includes(ratio)) throw new Error(`${model} ratios ${spec.ratios}, got ${ratio}`);
    const params = {
      prompt,
      ratio,
      quality,
      promptEnhance,
      quantity,
    };
    if (styleIds.length) params.styleIds = styleIds;

    // Image reference (img2img) — use uploaded image as visual reference
    if (refImageId) {
      const ref = { image: { id: refImageId, type: 'UPLOADED' } };
      // gpt-image-2: no strength param; gpt-image-1.5: strength LOW/MID/HIGH
      if (refStrength) ref.strength = refStrength;
      params.guidances = { image_reference: [ref] };
    }

    const d = await this.gql('Generate', Q_GENERATE, { request: { model: spec.id, public: publicGen, parameters: params } });
    return d.generate.generationId;
  }

  // Fetch generated image URL from feed.
  async getImageUrl(genId, { tries = 20, interval = 3000 } = {}) {
    let lastErr = 'unknown';
    for (let i = 0; i < tries; i++) {
      const d = await this.gql('GetAIGenerationFeed', IMAGE_Q_FEED,
        { where: { id: { _eq: genId } }, limit: 1 });
      const gens = d.generations || [];
      if (!gens.length) { lastErr = 'generation not in feed'; }
      else {
        for (const img of (gens[0].generated_images || [])) if (img.url) return img.url;
        lastErr = 'no image url yet';
      }
      await sleep(interval);
    }
    throw new Error(lastErr);
  }
}

module.exports = {
  GQL, SCHEMA_VERSION, UA, MODELS, RATIO_DIMS, COST_TABLE, estimateCost,
  IMAGE_MODELS, IMAGE_COST, IMAGE_Q_FEED,
  Q_UPLOAD, Q_MODERATION, Q_GENERATE, Q_TOKENS, Q_STATUS, Q_FEED,
  subFromToken, tokenExp, sleep, LeoEngine,
};
