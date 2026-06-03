// WebKita job queue — concurrent generation + persistent history.
// Manages a list of jobs across statuses (queued/processing/done/failed), runs up to
// MAX_CONCURRENT at once, and drives each through AccountManager.makeVideo (which rotates
// accounts transparently on low credits). Persists everything to electron-store so the
// Queue/History survives app restarts. Emits 'update' on every state change so the main
// process can push the full job list to the renderer.

'use strict';
const { EventEmitter } = require('events');

const MAX_CONCURRENT = 2;            // how many videos render at once (per Kaif: 2-3)
const ENGINE_LABEL = { 'veo-3.1-fast': 'Veo 3.1', 'seedance-2.0-fast': 'Seedance 2', 'kling-3.0': 'Kling AI 3.0' };
// gradient pool so each card gets a distinct thumb (matches the UI's tailwind gradients)
const GRADIENTS = [
  'from-slate-700 via-amber-900 to-slate-950',
  'from-emerald-950 via-slate-800 to-black',
  'from-sky-950 via-emerald-900 to-slate-950',
  'from-fuchsia-950 via-slate-900 to-black',
  'from-zinc-600 via-zinc-900 to-black',
  'from-indigo-950 via-slate-900 to-black',
];

class JobQueue extends EventEmitter {
  constructor(store, accounts, log) {
    super();
    this.store = store;
    this.accounts = accounts;   // AccountManager
    this.log = log || (() => {});
    this.jobs = store.get('jobs') || [];   // newest first
    this.running = 0;
    this._gi = 0;
  }

  _save() { this.store.set('jobs', this.jobs); this.emit('update', this.jobs); }
  list() { return this.jobs; }

  _title(prompt) {
    const t = (prompt || '').trim().split(/\s+/).slice(0, 4).join(' ');
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Untitled';
  }

  // job spec from UI: { model, prompt, duration, ratio, startFrame, endFrame, omni:[...] }
  // image fields are data: URLs (from the UI FileReader) or absolute paths.
  enqueue(spec) {
    const id = 'job_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const job = {
      id,
      model: spec.model,
      engine: ENGINE_LABEL[spec.model] || spec.model,
      title: this._title(spec.prompt),
      prompt: spec.prompt,
      duration: spec.duration,       // numeric seconds
      ratio: spec.ratio || '9:16',
      // keep raw inputs so "coba lagi" can re-run without re-upload
      inputs: { startFrame: spec.startFrame || null, endFrame: spec.endFrame || null, omni: spec.omni || [] },
      status: 'queued',              // queued | processing | done | failed
      progress: 0,
      thumb: GRADIENTS[(this._gi++) % GRADIENTS.length],
      file: null,
      url: null,
      reason: null,
      createdAt: Date.now(),
    };
    this.jobs.unshift(job);
    this._save();
    this._pump();
    return id;
  }

  retry(id) {
    const j = this.jobs.find(x => x.id === id);
    if (!j) return;
    j.status = 'queued'; j.progress = 0; j.reason = null;
    this._save();
    this._pump();
  }

  remove(id) {
    this.jobs = this.jobs.filter(x => x.id !== id);
    this._save();
  }

  // Add an already-completed job (for storyboard pipeline results)
  addCompleted(spec) {
    const id = 'job_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const job = {
      id,
      model: spec.model || 'storyboard',
      engine: spec.engine || 'Storyboard AI',
      title: spec.title || 'Storyboard',
      prompt: spec.prompt || '',
      duration: 0,
      ratio: spec.ratio || '1:1',
      inputs: { startFrame: spec.imageUrl || null, endFrame: null, omni: [] },
      status: 'done',
      progress: 100,
      thumb: GRADIENTS[(this._gi++) % GRADIENTS.length],
      file: null,
      url: spec.imageUrl || null,
      reason: null,
      createdAt: Date.now(),
      doneAt: Date.now(),
      storyboardData: spec.storyboardData || null, // extra metadata
    };
    this.jobs.unshift(job);
    this._save();
    return id;
  }

  // start as many queued jobs as the concurrency budget allows
  _pump() {
    while (this.running < MAX_CONCURRENT) {
      const next = this.jobs.find(j => j.status === 'queued');
      if (!next) break;
      this._run(next);
    }
  }

  async _run(job) {
    this.running++;
    job.status = 'processing'; job.progress = 5;
    this._save();
    const fs = require('fs');
    const os = require('os');
    const path = require('path');

    // Decode a data: URL or pass through an absolute path. Returns a temp file path.
    const toPath = (img) => {
      if (!img) return null;
      const val = typeof img === 'string' ? img : img.url;   // UI sends {name,url}
      if (!val) return null;
      if (!val.startsWith('data:')) return val;              // already a path
      const m = /^data:([^;]+);base64,(.*)$/s.exec(val);
      if (!m) return null;
      const ext = (m[1].split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const p = path.join(os.tmpdir(), `wk_${job.id}_${Math.random().toString(36).slice(2,6)}.${ext}`);
      fs.writeFileSync(p, Buffer.from(m[2], 'base64'));
      return p;
    };

    const tmp = [];
    try {
      const eng = await this.accounts.engine((s, i) => this.log('[acct] ' + s + ' ' + JSON.stringify(i || {})));
      let startFrameId = null, endFrameId = null, omniIds = null;
      const sf = toPath(job.inputs.startFrame); if (sf) { tmp.push(sf); job.progress = 12; this._save(); startFrameId = await eng.uploadImage(sf); }
      const ef = toPath(job.inputs.endFrame);   if (ef) { tmp.push(ef); job.progress = 18; this._save(); endFrameId   = await eng.uploadImage(ef); }
      const omniPaths = (job.inputs.omni || []).map(toPath).filter(Boolean);
      if (omniPaths.length) { tmp.push(...omniPaths); omniIds = []; for (const p of omniPaths) omniIds.push(await eng.uploadImage(p)); job.progress = 25; this._save(); }

      this.log(`[queue] generate ${job.model} ${job.duration}s ${job.ratio}`);
      job.progress = 35; this._save();

      const res = await this.accounts.makeVideo(
        { prompt: job.prompt, model: job.model, duration: job.duration, ratio: job.ratio,
          startFrameId, endFrameId, omniIds, omniStrength: 'MID' },
        (s, i) => {
          // nudge a visible progress bar as status ticks come in
          if (s === 'status') job.progress = Math.min(95, (job.progress || 35) + 4);
          else if (s === 'queued') job.progress = Math.max(job.progress, 40);
          else if (s === 'credit_balance') this.log(`[credit] Saldo: ${i.balance} | Butuh: ${i.need} (${i.model} ${i.duration}s)`);
          else if (s === 'rotate') this.log(`[rotate] ${i.reason} — saldo: ${i.balance || '?'}, butuh: ${i.need || '?'}`);
          else if (s === 'signup') this.log(`[rotate] Signup akun baru slot ${i.slot}...`);
          else if (s === 'generating') this.log(`[generate] Slot ${i.slot} — ${i.model}`);
          this._save();
        }
      );

      // download mp4 to userData/videos
      const dir = path.join(this.store.path ? path.dirname(this.store.path) : os.tmpdir(), 'webkita-videos');
      fs.mkdirSync(dir, { recursive: true });
      const out = path.join(dir, job.id + '.mp4');
      const r = await fetch(res.url);
      const buf = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(out, buf);

      job.status = 'done'; job.progress = 100; job.file = out; job.url = res.url; job.slot = res.slot;
      job.doneAt = Date.now();
      this.log(`[queue] done ${job.id} (${(buf.length/1048576).toFixed(2)} MB)`);
    } catch (e) {
      job.status = 'failed';
      job.reason = /no account|exhausted/i.test(e.message)
        ? 'Kuota akun habis. Hubungi admin untuk menambah kapasitas.'
        : ('Generate gagal: ' + (e.message || 'error tak dikenal') + '. Prompt & input masih bisa dipakai ulang.');
      this.log('[queue] FAILED ' + job.id + ': ' + e.message);
    } finally {
      tmp.forEach(p => { try { require('fs').unlinkSync(p); } catch (_) {} });
      this.running--;
      this._save();
      this._pump();   // free slot -> start next queued job
    }
  }
}

module.exports = { JobQueue, MAX_CONCURRENT };
