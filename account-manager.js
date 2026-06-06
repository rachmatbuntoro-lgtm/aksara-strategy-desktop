// WebKita account rotation — JS port of account_manager.py, wired to electron-store.
// Transparent credit-based rotation: when the active account lacks credits for the
// requested video, silently sign up the NEXT pool email and swap to it. The UI only
// ever shows "processing" — never "out of credits".
'use strict';

const { LeoEngine, estimateCost, IMAGE_COST } = require('./leo-engine.js');

class NoAccountsLeft extends Error {}

class AccountManager {
  // store    : electron-store instance
  // signupFn : async ({email, slot}) => { token, user_id }  (the hidden-browser signup)
  // sessionFn: async () => { accessToken, user_id }          (refresh active token in place)
  constructor(store, signupFn, sessionFn) {
    this.store = store;
    this.signupFn = signupFn;
    this.sessionFn = sessionFn;
    this._engine = null;
  }

  _state() {
    return this.store.get('accounts_state') || { active: null, exhausted: [], accounts: {} };
  }
  _save(s) { this.store.set('accounts_state', s); }

  setLicense(key, pool) { this.store.set('license_key', key); this.store.set('signup_pool', pool || []); }
  pool() { return this.store.get('signup_pool') || []; }
  licenseKey() { return this.store.get('license_key'); }

  _activeAcct() {
    const s = this._state();
    return s.active ? s.accounts[s.active] : null;
  }

  _nextSlot() {
    const s = this._state();
    const used = new Set([...Object.keys(s.accounts), ...s.exhausted.map(String)]);
    for (const e of this.pool()) if (!used.has(String(e.slot))) return e;
    return null;
  }

  async _provisionNext(onEvent) {
    const entry = this._nextSlot();
    if (!entry) throw new NoAccountsLeft('signup pool exhausted');
    if (onEvent) onEvent('signup', { slot: entry.slot });
    const r = await this.signupFn({ email: entry.email, slot: entry.slot });
    if (!r || !r.uid && !r.user_id) throw new Error('signup returned no uid');
    const s = this._state();
    s.accounts[String(entry.slot)] = {
      slot: String(entry.slot), email: entry.email,
      token: r.token || null, user_id: r.user_id || r.uid, created_at: Date.now(),
    };
    s.active = String(entry.slot);
    this._save(s);
    this._engine = null;
    return s.accounts[String(entry.slot)];
  }

  async _rotate(onEvent) {
    const s = this._state();
    if (s.active && !s.exhausted.includes(s.active)) s.exhausted.push(s.active);
    s.active = null;
    this._save(s);
    return this._provisionNext(onEvent);
  }

  async engine(onEvent) {
    let acct = this._activeAcct();
    if (!acct) acct = await this._provisionNext(onEvent);
    // token missing/expired -> refresh in place before building engine
    if (!acct.token || !new LeoEngine(acct.token, acct.user_id).tokenValid()) {
      if (this.sessionFn) {
        try {
          const sess = await this.sessionFn(acct);
          if (sess && sess.accessToken) {
            acct.token = sess.accessToken;
            if (sess.user_id) acct.user_id = sess.user_id;
            const s = this._state(); s.accounts[acct.slot] = acct; this._save(s);
          }
        } catch (_) {}
      }
    }
    if (!this._engine || this._engine.token !== acct.token) this._engine = new LeoEngine(acct.token, acct.user_id);
    return this._engine;
  }

  // Public call used by the app. Rotates accounts transparently on low credits.
  // job = { prompt, model, duration, ratio, startFrameId, endFrameId, omniIds, omniStrength }
  // Returns { url, slot }.
  //
  // Concurrency model: the SUBMIT phase (acquire engine, check credits, rotate/signup,
  // call generate) is serialized via a mutex so parallel jobs can't corrupt shared account
  // state or double-sign-up. The RENDER phase (waitComplete + getVideoUrl) runs OUTSIDE the
  // lock, so multiple videos render in parallel on Leonardo's servers.
  async makeVideo(job, onEvent) {
    const { eng, gid, slot } = await this._withLock(() => this._submit(job, onEvent));
    if (onEvent) onEvent('queued', { gid });
    await eng.waitComplete(gid, { onTick: (s) => onEvent && onEvent('status', { status: s }) });
    const url = await eng.getVideoUrl(gid);
    return { url, slot };
  }

  // serialize a critical section
  async _withLock(fn) {
    const prev = this._lock || Promise.resolve();
    let release;
    this._lock = new Promise(r => (release = r));
    try { await prev; return await fn(); }
    finally { release(); }
  }

  // SUBMIT (under lock): return { eng, gid, slot } once the generation is queued.
  async _submit(job, onEvent) {
    const need = estimateCost(job.model, job.duration);
    const maxRot = this.pool().length + 1;
    for (let attempt = 0; attempt <= maxRot; attempt++) {
      const eng = await this.engine(onEvent);
      // pre-flight credit check — MUST succeed or we rotate
      let bal = null;
      try {
        const credits = await eng.getCredits();
        bal = credits.total;
        if (onEvent) onEvent('credit_balance', { balance: bal, need, model: job.model, duration: job.duration });
      } catch (e) {
        if (onEvent) onEvent('credit_check_failed', { error: e.message });
        // If we can't check credits, rotate to be safe (token might be dead)
        if (onEvent) onEvent('rotate', { reason: 'credit_check_failed', error: e.message });
        await this._rotate(onEvent);
        continue;
      }
      if (bal < need) {
        if (onEvent) onEvent('rotate', { reason: 'low_credits', balance: bal, need });
        await this._rotate(onEvent);
        continue;
      }
      try {
        if (onEvent) onEvent('generating', { slot: this._state().active, model: job.model });
        const gid = await eng.generate(job.prompt, {
          model: job.model, duration: job.duration, ratio: job.ratio || '9:16',
          startFrameId: job.startFrameId || null, endFrameId: job.endFrameId || null,
          omniIds: job.omniIds || null, omniStrength: job.omniStrength || 'MID',
        });
        return { eng, gid, slot: this._state().active };
      } catch (e) {
        const m = (e.message || '').toLowerCase();
        if (['token','credit','insufficient','quota','not enough','unauthorized','401'].some(s => m.includes(s))) {
          if (onEvent) onEvent('rotate', { reason: 'api_error', error: e.message.slice(0,200) });
          await this._rotate(onEvent);
          continue;
        }
        throw e; // unrelated error — don't burn an account
      }
    }
    throw new NoAccountsLeft('exhausted all rotations');
  }

  // Upload a reference image to Leonardo for img2img guidance.
  // Accepts file path or Buffer. Returns initImageId (UUID string).
  async uploadRefImage(imagePathOrBuffer, onEvent) {
    const eng = await this.engine(onEvent);
    const fs = require('fs');
    let bytes, ext;
    if (typeof imagePathOrBuffer === 'string') {
      ext = (imagePathOrBuffer.split('.').pop() || 'jpg').toLowerCase();
      bytes = fs.readFileSync(imagePathOrBuffer);
    } else {
      bytes = imagePathOrBuffer;
      ext = 'jpg';
    }
    if (onEvent) onEvent('uploading_ref', {});
    const initImageId = await eng.uploadImage(bytes, ext);
    if (onEvent) onEvent('ref_uploaded', { initImageId });
    return initImageId;
  }

  // Image generation — same rotation logic as makeVideo.
  // job = { prompt, ratio, quality, promptEnhance, refImageId, refStrength }
  // Returns { url, slot }.
  async makeImage(job, onEvent) {
    const { eng, gid, slot } = await this._withLock(() => this._submitImage(job, onEvent));
    if (onEvent) onEvent('queued', { gid });
    await eng.waitComplete(gid, { onTick: (s) => onEvent && onEvent('status', { status: s }) });
    const url = await eng.getImageUrl(gid);
    return { url, slot };
  }

  async _submitImage(job, onEvent) {
    const need = IMAGE_COST[job.ratio || '1:1'] || 573;
    const maxRot = this.pool().length + 1;
    for (let attempt = 0; attempt <= maxRot; attempt++) {
      const eng = await this.engine(onEvent);
      let bal = null;
      try {
        const credits = await eng.getCredits();
        bal = credits.total;
        if (onEvent) onEvent('credit_balance', { balance: bal, need, model: 'gpt-image-2', ratio: job.ratio });
      } catch (e) {
        if (onEvent) onEvent('rotate', { reason: 'credit_check_failed', error: e.message });
        await this._rotate(onEvent);
        continue;
      }
      if (bal < need) {
        if (onEvent) onEvent('rotate', { reason: 'low_credits', balance: bal, need });
        await this._rotate(onEvent);
        continue;
      }
      try {
        if (onEvent) onEvent('generating', { slot: this._state().active, model: 'gpt-image-2' });
        const gid = await eng.generateImage(job.prompt, {
          ratio: job.ratio || '1:1',
          quality: job.quality || 'HIGH',
          promptEnhance: job.promptEnhance !== false,
          refImageId: job.refImageId || null,
          refStrength: job.refStrength || null,
        });
        return { eng, gid, slot: this._state().active };
      } catch (e) {
        const m = (e.message || '').toLowerCase();
        if (['token','credit','insufficient','quota','not enough','unauthorized','401'].some(s => m.includes(s))) {
          if (onEvent) onEvent('rotate', { reason: 'api_error', error: e.message.slice(0,200) });
          await this._rotate(onEvent);
          continue;
        }
        throw e;
      }
    }
    throw new NoAccountsLeft('exhausted all rotations');
  }
}

module.exports = { AccountManager, NoAccountsLeft };
