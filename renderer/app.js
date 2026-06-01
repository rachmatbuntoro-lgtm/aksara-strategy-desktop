const $ = (id) => document.getElementById(id);
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

// Model spec mirrors leo-engine.js MODELS (durations + which frame slots to show).
const SPEC = {
  'veo-3.1-fast':      { durations: [4,6,8],   frames: ['start','end'] },
  'seedance-2.0-fast': { durations: [5,10,15], frames: ['start','end','omni'] },
  'kling-3.0':         { durations: [5,10,15], frames: ['start','end'] },
};
const FRAME_LABEL = { start: 'Start Frame', end: 'End Frame', omni: 'Omni (max 4)' };

let model = 'veo-3.1-fast';
let duration = 4;
let ratio = '9:16';
const files = { start: null, end: null, omni: [] };
let lastFile = null;

function renderDurations() {
  const wrap = $('durations'); wrap.innerHTML = '';
  const ds = SPEC[model].durations;
  if (!ds.includes(duration)) duration = ds[0];
  ds.forEach(d => {
    const c = document.createElement('div');
    c.className = 'chip' + (d === duration ? ' sel' : '');
    c.textContent = d + 's';
    c.onclick = () => { duration = d; renderDurations(); };
    wrap.appendChild(c);
  });
}

function renderFrames() {
  const wrap = $('frames'); wrap.innerHTML = '';
  files.start = null; files.end = null; files.omni = [];
  SPEC[model].frames.forEach(kind => {
    const box = document.createElement('div'); box.className = 'upbox';
    const lab = document.createElement('div'); lab.className = 'label'; lab.textContent = FRAME_LABEL[kind];
    const btn = document.createElement('div'); btn.className = 'filebtn'; btn.textContent = '+ Pilih';
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.style.display = 'none';
    inp.multiple = (kind === 'omni');
    inp.onchange = () => {
      const fs = Array.from(inp.files || []);
      if (!fs.length) return;
      if (kind === 'omni') { files.omni = fs.slice(0, 4).map(f => f.path); btn.textContent = files.omni.length + ' gambar'; }
      else { files[kind] = fs[0].path; btn.textContent = '✓ ' + fs[0].name.slice(0, 14); }
      btn.classList.add('has');
    };
    btn.onclick = () => inp.click();
    box.appendChild(lab); box.appendChild(btn); box.appendChild(inp);
    wrap.appendChild(box);
  });
}

async function init() {
  const st = await window.webkita.getState();
  if (st.connected) {
    $('acct').textContent = `Akun aktif: ${st.email || '-'}`;
    renderDurations(); renderFrames();
    show('s-generate');
  } else show('s-license');
}

window.webkita.onLog((line) => {
  ['log', 'genlog'].forEach(id => {
    const el = $(id); if (!el) return;
    el.textContent += line + '\n'; el.scrollTop = el.scrollHeight;
  });
});

$('btn-activate').addEventListener('click', async () => {
  const key = $('license').value.trim().toUpperCase();
  if (!key) { alert('Masukin license key dulu'); return; }
  $('log').textContent = '';
  show('s-connecting');
  const r = await window.webkita.activate(key);
  if (r.ok) { $('acct').textContent = `Akun aktif: ${r.email}`; renderDurations(); renderFrames(); show('s-generate'); }
  else { alert(r.reason || 'Gagal'); show('s-license'); }
});

document.querySelectorAll('#models .chip').forEach(m => {
  m.addEventListener('click', () => {
    document.querySelectorAll('#models .chip').forEach(x => x.classList.remove('sel'));
    m.classList.add('sel'); model = m.dataset.m;
    renderDurations(); renderFrames();
  });
});
document.querySelectorAll('#ratios .chip').forEach(m => {
  m.addEventListener('click', () => {
    document.querySelectorAll('#ratios .chip').forEach(x => x.classList.remove('sel'));
    m.classList.add('sel'); ratio = m.dataset.r;
  });
});

$('btn-generate').addEventListener('click', async () => {
  const prompt = $('prompt').value.trim();
  if (!prompt) { alert('Tulis prompt dulu'); return; }
  $('genlog').textContent = '';
  show('s-processing');
  const r = await window.webkita.generate({
    model, prompt, duration, ratio,
    startFrame: files.start, endFrame: files.end, omni: files.omni,
  });
  if (r.ok) {
    lastFile = r.file;
    $('result-video').src = 'file://' + r.file;
    show('s-result');
  } else {
    alert(r.reason || 'Gagal generate');
    show('s-generate');
  }
});

$('btn-again').addEventListener('click', () => { $('prompt').value = ''; renderFrames(); show('s-generate'); });
$('btn-save').addEventListener('click', () => {
  if (lastFile) alert('Video tersimpan di:\n' + lastFile);
});

$('btn-reset').addEventListener('click', async () => { await window.webkita.reset(); location.reload(); });

$('btn-capture').addEventListener('click', async () => {
  const ok = confirm('Mode REKAM:\n\n1. Jendela Leonardo bakal kebuka (udah login).\n2. Generate 1 video manual sampe JADI.\n3. TUTUP jendela itu.\n\nApp bakal nyimpen file rekaman di folder Downloads buat dikirim ke dev. Lanjut?');
  if (!ok) return;
  $('btn-capture').textContent = '🔴 Merekam... (generate lalu tutup jendela)';
  $('btn-capture').disabled = true;
  const r = await window.webkita.capture();
  $('btn-capture').textContent = '🔴 Rekam API (untuk dev)';
  $('btn-capture').disabled = false;
  if (r.ok) alert('Rekaman tersimpan di Downloads:\n' + r.file + '\n\n(' + r.count + ' event). Kirim file ini ke dev.');
  else alert(r.reason || 'Gagal merekam');
});

init();
