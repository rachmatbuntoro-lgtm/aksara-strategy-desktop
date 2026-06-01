import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Clock3,
  Download,
  Film,
  Home as HomeIcon,
  ImagePlus,
  KeyRound,
  Layers3,
  Loader2,
  LockKeyhole,
  LogOut,
  MoreVertical,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
  User,
  X,
  Wand2,
  Zap,
} from "lucide-react";

const BRAND = {
  bg: "#1C1C1C",
  depth: "#1C303B",
  accent: "#B5CCD2",
  white: "#FFFFFF",
};

const tools = [
  {
    id: "veo",
    name: "Veo 3.1",
    subtitle: "High realism cinematic generator",
    description: "Cocok untuk hasil video cinematic, detail visual tajam, dan output yang terlihat premium.",
    badge: "Premium",
    durations: ["4s", "6s", "8s"],
    refs: false,
    icon: Sparkles,
  },
  {
    id: "seedance",
    name: "Seedance 2",
    subtitle: "UGC & reference-driven video flow",
    description: "Cocok untuk UGC, gerakan natural, dan penggunaan referensi tambahan sampai 4 gambar.",
    badge: "Omni Ref",
    durations: ["5s", "10s", "15s"],
    refs: true,
    icon: Wand2,
  },
  {
    id: "kling",
    name: "Kling AI 3.0",
    subtitle: "Fast video generation engine",
    description: "Cocok untuk eksperimen cepat, generate stabil, dan variasi video dengan workflow ringan.",
    badge: "Stable",
    durations: ["5s", "10s", "15s"],
    refs: false,
    icon: Zap,
  },
];

// Real jobs from backend — no dummy data

const aksaraLogoBase64 = "data:image/png;base64,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";
// Desktop version logic: Since the logo provided has the text inside it, 
// we will just display it gracefully using standard <img> tag.
function Logo({ className = "h-6" }) {
  return (
    <img 
      src={aksaraLogoBase64} 
      alt="Aksara Strategy" 
      className={`w-auto object-contain object-left ${className}`}
      onError={(e) => {
        e.target.onerror = null;
        e.target.src = "https://placehold.co/400x100/1C1C1C/FFFFFF?text=Aksara+Strategy";
      }}
    />
  );
}

function PrimaryButton({ children, onClick, icon: Icon = ArrowRight, disabled = false, className = "" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group flex items-center justify-between rounded-2xl px-5 py-4 text-sm font-semibold transition active:scale-[.99] disabled:opacity-60 disabled:pointer-events-none ${className}`}
      style={{ background: BRAND.accent, color: "#102027" }}
    >
      <span>{children}</span>
      <span className="grid h-8 w-8 place-items-center rounded-full bg-black/10 transition group-hover:translate-x-0.5">
        <Icon size={18} />
      </span>
    </button>
  );
}

function Sidebar({ active, go, jobs = [], logout }) {
  const pending = jobs.filter((j) => j.status === "processing" || j.status === "queued" || j.status === "failed").length;
  const items = [
    { id: "home", label: "Dashboard", icon: HomeIcon },
    { id: "studio", label: "AI Studio", icon: Layers3 },
    { id: "queue", label: "Queue & Hasil", icon: Film, count: pending },
    { id: "account", label: "Pengaturan Akun", icon: User },
  ];

  return (
    <div className="w-72 h-full border-r border-white/10 bg-[#12181b]/80 backdrop-blur-3xl flex flex-col relative z-30">
      <div className="p-8">
        <Logo className="h-6" />
        <div className="mt-2 text-[10px] font-semibold tracking-[0.15em] text-white/40 uppercase pl-1">AI Video Suite</div>
      </div>
      
      <div className="flex-1 px-4 space-y-2 mt-4">
        {items.map(item => {
           const Icon = item.icon;
           const isActive = active === item.id;
           return (
             <button
                key={item.id}
                onClick={() => go(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all ${isActive ? 'bg-white/10 text-white shadow-sm' : 'text-white/50 hover:bg-white/[.05] hover:text-white'}`}
             >
                <div className="flex items-center gap-3.5">
                   <Icon size={20} style={{ color: isActive ? BRAND.accent : "currentColor" }} />
                   <span className="text-sm font-medium">{item.label}</span>
                </div>
                {item.count > 0 && (
                  <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-sky-400 px-1.5 text-[10px] font-bold text-slate-950 shadow-lg shadow-sky-400/20">
                    {item.count}
                  </span>
                )}
             </button>
           )
        })}
      </div>

      <div className="p-4 border-t border-white/10 m-4 rounded-3xl bg-white/[.02]">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-red-200/70 hover:bg-red-400/10 hover:text-red-200 transition-all"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">Logout Sesi</span>
        </button>
      </div>
    </div>
  )
}

function DesktopLayout({ screen, go, children, jobs = [], logout }) {
  const isAuth = ["home", "studio", "queue", "account"].includes(screen);

  return (
    <div className="flex h-screen w-full bg-neutral-950 text-white font-sans overflow-hidden">
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        ::selection { background: rgba(181,204,210,.3); color: white; }
      `}</style>
      
      {/* Background decorations for Desktop scale */}
      <div className="pointer-events-none fixed inset-0 opacity-60 z-0">
        <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full blur-[140px]" style={{ background: "rgba(181,204,210,.12)" }} />
        <div className="absolute top-1/3 -left-40 h-[800px] w-[800px] rounded-full blur-[150px]" style={{ background: "rgba(28,48,59,.6)" }} />
        <div className="absolute -bottom-40 right-1/4 h-[500px] w-[500px] rounded-full blur-[120px]" style={{ background: "rgba(181,204,210,.05)" }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,.03),transparent_50%)]" />
      </div>

      {isAuth && (
        <div className="relative z-20 flex-shrink-0">
           <Sidebar active={screen} go={go} jobs={jobs} logout={logout} />
        </div>
      )}

      <div className="flex-1 relative z-10 overflow-y-auto no-scrollbar flex flex-col">
         {isAuth ? (
            <div className="w-full max-w-[1400px] mx-auto p-8 lg:p-12">
               <AnimatePresence mode="wait">
                  {children}
               </AnimatePresence>
            </div>
         ) : (
            <div className="flex-1 flex items-center justify-center p-8">
               <div className="w-full max-w-md">
                 <AnimatePresence mode="wait">
                    {children}
                 </AnimatePresence>
               </div>
            </div>
         )}
      </div>
    </div>
  );
}

function Splash({ go }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center text-center p-8">
      <div className="mb-10">
        <Logo className="h-10 mx-auto" />
      </div>
      <h1 className="text-4xl lg:text-5xl font-semibold leading-tight tracking-[-0.04em] max-w-2xl">
        Generate video AI dalam satu control panel.
      </h1>
      <p className="mt-6 text-base leading-relaxed text-white/58 max-w-xl">
        Akses Veo 3.1, Seedance 2, dan Kling AI dengan workflow yang rapi untuk member Aksara Strategy.
      </p>
      <div className="mt-12 w-full max-w-sm">
        <PrimaryButton onClick={go} className="w-full justify-center gap-4 py-5 text-base">Masuk ke aplikasi</PrimaryButton>
      </div>
    </motion.div>
  );
}

function LicensePage({ go, error }) {
  const [license, setLicense] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); try { await go(license); } finally { setBusy(false); } };
  
  return (
    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col bg-white/[.02] border border-white/10 p-8 lg:p-10 rounded-[32px] shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between mb-10">
        <Logo className="h-6" />
        <div className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-[11px] font-medium text-white/60">Member Access</div>
      </div>

      <div>
        <div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/[.05]">
          <KeyRound size={28} style={{ color: BRAND.accent }} />
        </div>
        <h1 className="mt-6 text-3xl font-semibold tracking-[-0.04em]">Masukkan license key.</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/58">Gunakan license yang kamu dapat dari Aksara Strategy untuk membuka semua generator video.</p>
      </div>

      <div className="mt-10 space-y-3">
        <label className="text-xs font-medium text-white/45 pl-1">LICENSE CODE</label>
        <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/40 px-5 py-4 focus-within:border-white/30 transition-colors">
          <LockKeyhole size={20} className="text-white/40" />
          <input
            value={license}
            onChange={(e) => setLicense(e.target.value.toUpperCase())}
            placeholder="AKSARA-XXXX-XXXX"
            className="w-full bg-transparent text-base tracking-[.15em] text-white outline-none placeholder:text-white/25"
            onKeyDown={(e) => e.key === 'Enter' && license.length >= 6 && !busy && submit()}
          />
        </div>
      </div>

      <div className="mt-10 space-y-5">
        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[.07] p-4 text-sm leading-relaxed text-red-100/80">
            {error}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4 text-xs leading-relaxed text-white/52">
            License hanya untuk member aktif. Sistem akan melakukan validasi sebelum dashboard terbuka.
          </div>
        )}
        <PrimaryButton onClick={submit} disabled={license.length < 6 || busy} className="w-full py-4 text-base justify-center gap-4">
          {busy ? "Memvalidasi..." : "Validasi license"}
        </PrimaryButton>
      </div>
    </motion.div>
  );
}

function ValidatingPage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center text-center p-8">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }} className="grid h-24 w-24 place-items-center rounded-3xl border border-white/10 bg-white/[.05] shadow-2xl">
        <Loader2 size={40} style={{ color: BRAND.accent }} />
      </motion.div>
      <h1 className="mt-10 text-3xl font-semibold tracking-[-0.04em]">Menyiapkan akun...</h1>
      <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/58">Sistem sedang memvalidasi license dan menyiapkan workspace generator kamu.</p>
    </motion.div>
  );
}

function Home({ go, setActiveTool }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="h-full">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Logo className="h-8" />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard Overview</h1>
            <p className="text-sm text-white/50 mt-1">Pilih engine dan mulai generate video.</p>
          </div>
        </div>
        <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-medium text-emerald-300">
          Member Aktif
        </div>
      </div>

      <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[.03] p-8 lg:p-10 relative mb-10">
        <div className="flex items-start justify-between gap-6 relative z-10">
          <div className="max-w-xl">
            <div className="rounded-full inline-block border border-white/10 bg-black/30 px-4 py-1.5 text-xs font-medium text-white/70 mb-5">AI Video Suite</div>
            <h2 className="text-4xl font-semibold leading-tight tracking-[-0.03em]">Satu workspace pintar untuk semua engine AI.</h2>
            <p className="mt-5 text-base leading-relaxed text-white/60">Pilih model AI di Studio, atur frame dan prompt, lalu pantau hasil render paralel melalui fitur Queue.</p>
            <div className="mt-8">
              <PrimaryButton onClick={() => go("studio")} icon={Layers3} className="w-max px-8">Go To Studio</PrimaryButton>
            </div>
          </div>
          <div className="hidden md:grid h-24 w-24 shrink-0 place-items-center rounded-[28px] shadow-2xl" style={{ background: BRAND.depth }}>
            <Film size={40} style={{ color: BRAND.accent }} />
          </div>
        </div>
        <div className="absolute right-0 bottom-0 w-64 h-64 bg-white/5 blur-[80px] rounded-full translate-x-1/3 translate-y-1/3 pointer-events-none" />
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight">Model AI Tersedia</h3>
        <span className="text-sm text-white/40">3 Engine Tersedia</span>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <div key={tool.id} className="group rounded-[28px] border border-white/10 bg-black/20 p-6 text-left transition-all hover:bg-white/[.05] hover:border-white/20">
              <div className="flex items-start justify-between mb-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[.05] group-hover:bg-white/10 transition-colors">
                  <Icon size={24} style={{ color: BRAND.accent }} />
                </div>
                <span className="rounded-full px-3 py-1.5 text-[10px] font-bold tracking-wide uppercase" style={{ background: "rgba(181,204,210,.14)", color: BRAND.accent }}>
                  {tool.badge}
                </span>
              </div>
              <h3 className="text-lg font-semibold mb-2">{tool.name}</h3>
              <p className="text-sm leading-relaxed text-white/50">{tool.description}</p>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function UploadCard({ title, subtitle, value, onChange, onClear }) {
  const inputId = `${title.toLowerCase().split(" ").join("-")}-${subtitle.toLowerCase().split(" ").join("-")}`;

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { onChange({ name: file.name, url: reader.result }); };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  return (
    <div className="relative min-h-[140px] flex-1 overflow-hidden rounded-[26px] border border-dashed border-white/20 bg-black/20 transition hover:bg-white/[.04] hover:border-white/30 active:scale-[.98]">
      <input id={inputId} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      {value ? (
        <>
          <label htmlFor={inputId} className="absolute inset-0 cursor-pointer group">
            <img src={value.url} alt={value.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/20 opacity-80 group-hover:opacity-100 transition-opacity" />
            <div className="absolute bottom-4 left-4 right-4">
              <div className="text-sm font-semibold text-white">{title}</div>
              <div className="mt-1 truncate text-xs text-white/60">{value.name}</div>
            </div>
          </label>
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 top-3 z-20 grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-black/70 text-white backdrop-blur transition hover:bg-red-500/80 hover:border-transparent"
            title={`Remove ${title}`}
          >
            <X size={14} />
          </button>
        </>
      ) : (
        <label htmlFor={inputId} className="flex min-h-[140px] h-full cursor-pointer flex-col items-center justify-center p-5 text-center group">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[.05] border border-white/5 group-hover:bg-white/10 transition-colors">
            <Upload size={20} style={{ color: BRAND.accent }} />
          </div>
          <div className="mt-4 text-sm font-semibold text-white/80 group-hover:text-white transition-colors">{title}</div>
          <div className="mt-1 text-xs text-white/40">{subtitle}</div>
        </label>
      )}
    </div>
  );
}

function ReferenceSlot({ index, value, onChange, onClear }) {
  const inputId = `omni-reference-${index}`;

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { onChange({ name: file.name, url: reader.result }); };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  return (
    <div className="relative aspect-square overflow-hidden rounded-[20px] border border-dashed border-white/20 bg-black/20 transition hover:bg-white/[.05] active:scale-95">
      <input id={inputId} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      {value ? (
        <>
          <label htmlFor={inputId} className="absolute inset-0 cursor-pointer group">
            <img src={value.url} alt={value.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-110" />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
          </label>
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 top-2 z-20 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white transition hover:bg-red-500"
            title={`Remove reference ${index}`}
          >
            <X size={12} />
          </button>
        </>
      ) : (
        <label htmlFor={inputId} className="grid h-full w-full cursor-pointer place-items-center text-sm font-medium text-white/30 hover:text-white/60 transition-colors">
          +{index}
        </label>
      )}
    </div>
  );
}

function PillGroup({ label, options, value, setValue }) {
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold tracking-wide text-white/50">{label}</div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => {
          const isSelected = value === option;
          return (
            <button
              key={option}
              onClick={() => setValue(option)}
              className="rounded-2xl border px-3 py-3 text-sm font-semibold transition-all active:scale-95"
              style={{
                borderColor: isSelected ? BRAND.accent : "rgba(255,255,255,.1)",
                background: isSelected ? "rgba(181,204,210,.1)" : "rgba(0,0,0,.2)",
                color: isSelected ? BRAND.accent : "rgba(255,255,255,.6)",
              }}
            >
              {option}
            </button>
          )
        })}
      </div>
    </div>
  );
}

function ModelDropdown({ activeTool, setActiveTool }) {
  const [open, setOpen] = useState(false);
  const selectedTool = tools.find((item) => item.id === activeTool) || tools[0];
  const SelectedIcon = selectedTool.icon;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-[28px] border border-white/10 bg-white/[.02] p-5 text-left transition hover:bg-white/[.04] hover:border-white/20 active:scale-[.99]"
      >
        <div className="flex items-center gap-5">
          <div className="grid h-14 w-14 place-items-center rounded-[20px] shadow-inner" style={{ background: BRAND.depth }}>
            <SelectedIcon size={24} style={{ color: BRAND.accent }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold tracking-wider text-white/40 uppercase mb-1">ENGINE AKTIF</div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold tracking-tight">{selectedTool.name}</h2>
              <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide" style={{ background: "rgba(181,204,210,.14)", color: BRAND.accent }}>
                {selectedTool.badge}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-white/50">{selectedTool.subtitle}</p>
          </div>
          <motion.div animate={{ rotate: open ? 180 : 0 }} className="h-10 w-10 grid place-items-center rounded-full bg-white/5">
            <ChevronDown size={20} className="text-white/60" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            className="absolute left-0 right-0 top-[calc(100%+12px)] z-50 overflow-hidden rounded-[28px] border border-white/10 bg-[#121A1F]/95 p-3 shadow-2xl backdrop-blur-2xl"
          >
            {tools.map((tool) => {
              const Icon = tool.icon;
              const isActive = tool.id === activeTool;
              return (
                <button
                  key={tool.id}
                  onClick={() => { setActiveTool(tool.id); setOpen(false); }}
                  className="flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left transition hover:bg-white/[.06]"
                  style={{ background: isActive ? "rgba(181,204,210,.1)" : "transparent" }}
                >
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/[.05]">
                    <Icon size={20} style={{ color: BRAND.accent }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-semibold">{tool.name}</div>
                    <div className="mt-1 text-xs text-white/50">{tool.subtitle}</div>
                  </div>
                  {isActive && <CheckCircle2 size={20} style={{ color: BRAND.accent }} />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StudioPage({ activeTool, setActiveTool, go, studioData, setStudioData, submitJob }) {
  const tool = useMemo(() => tools.find((item) => item.id === activeTool) || tools[0], [activeTool]);
  const currentData = studioData[tool.id];
  const [showToast, setShowToast] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const MODEL_ID = { veo: "veo-3.1-fast", seedance: "seedance-2.0-fast", kling: "kling-3.0" };

  const updateField = (field, value) => {
    setStudioData((prev) => ({ ...prev, [tool.id]: { ...prev[tool.id], [field]: value } }));
  };

  const updateReference = (index, value) => {
    const nextRefs = [...currentData.omniRefs];
    nextRefs[index] = value;
    updateField("omniRefs", nextRefs);
  };

  const clearReference = (index) => {
    const nextRefs = [...currentData.omniRefs];
    nextRefs[index] = null;
    updateField("omniRefs", nextRefs);
  };

  const handleGenerate = async () => {
    if (!currentData.prompt.trim() || busy) return;
    setErrMsg("");
    setBusy(true);
    const omni = tool.refs ? (currentData.omniRefs || []).filter(Boolean) : [];
    const payload = {
      model: MODEL_ID[tool.id] || tool.id,
      prompt: currentData.prompt.trim(),
      duration: currentData.duration,
      ratio: currentData.ratio,
      startFrame: currentData.startFrame,
      endFrame: currentData.endFrame,
      omni,
    };
    try {
      const r = await submitJob(payload);
      if (r && r.ok) { setShowToast(true); window.setTimeout(() => setShowToast(false), 2500); }
      else { setErrMsg((r && r.reason) || "Gagal mengirim job"); }
    } catch (e) {
      setErrMsg(e && e.message ? e.message : "Gagal mengirim job");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="h-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">AI Studio</h1>
          <p className="text-sm text-white/50 mt-1">Konfigurasi parameter dan hasilkan video kualitas tinggi.</p>
        </div>
      </div>

      {/* Two-column layout for Desktop Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pb-10">
        
        {/* Left Column: Engine, Prompt, Settings */}
        <div className="lg:col-span-7 space-y-6">
          <ModelDropdown activeTool={tool.id} setActiveTool={setActiveTool} />

          <div className="space-y-3">
            <div className="flex items-center justify-between pl-1">
              <div className="text-xs font-semibold tracking-wide text-white/50">PROMPT DESKRIPSI VIDEO</div>
              <div className="text-xs font-medium text-white/40 bg-white/5 px-2 py-1 rounded-md">{currentData.prompt.length} / 1500</div>
            </div>
            <textarea
              value={currentData.prompt}
              maxLength={1500}
              onChange={(e) => updateField("prompt", e.target.value)}
              placeholder={`Tulis prompt untuk ${tool.name}. Jelaskan detail visual, subjek, pergerakan kamera, lighting, mood, gaya render, dan negative instruction jika diperlukan.`}
              className="h-[280px] w-full resize-none rounded-[28px] border border-white/10 bg-black/30 p-6 text-base leading-relaxed text-white outline-none placeholder:text-white/30 focus:border-white/30 transition-colors shadow-inner"
            />
          </div>

          <div className="grid grid-cols-2 gap-6 bg-white/[.02] border border-white/5 p-6 rounded-[28px]">
            <PillGroup label="DURASI (DETIK)" options={tool.durations} value={currentData.duration} setValue={(value) => updateField("duration", value)} />
            <PillGroup label="ASPECT RATIO" options={["9:16", "16:9"]} value={currentData.ratio} setValue={(value) => updateField("ratio", value)} />
          </div>
        </div>

        {/* Right Column: Visual Frames & Submit */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-3 bg-white/[.02] border border-white/5 p-6 rounded-[28px]">
            <div className="text-xs font-semibold tracking-wide text-white/50 mb-4">IMAGE FRAMES (KEYFRAMES)</div>
            <div className="grid grid-cols-2 gap-4">
              <UploadCard title="Start Frame" subtitle="Gambar awal" value={currentData.startFrame} onChange={(value) => updateField("startFrame", value)} onClear={() => updateField("startFrame", null)} />
              <UploadCard title="End Frame" subtitle="Opsional" value={currentData.endFrame} onChange={(value) => updateField("endFrame", value)} onClear={() => updateField("endFrame", null)} />
            </div>
          </div>

          {tool.refs && (
            <div className="rounded-[28px] border border-white/5 bg-white/[.02] p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold tracking-wide text-white/50">OMNI REFERENCE</div>
                  <div className="mt-1.5 text-xs text-white/40">Gunakan hingga 4 referensi pose/style</div>
                </div>
                <div className="h-10 w-10 rounded-full bg-white/5 grid place-items-center"><ImagePlus size={18} style={{ color: BRAND.accent }} /></div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[0, 1, 2, 3].map((index) => (
                  <ReferenceSlot key={index} index={index + 1} value={currentData.omniRefs[index]} onChange={(value) => updateReference(index, value)} onClear={() => clearReference(index)} />
                ))}
              </div>
            </div>
          )}

          <div className="rounded-[28px] border border-emerald-400/20 bg-emerald-400/5 p-6 text-sm text-emerald-100/70 leading-relaxed">
            <div className="flex items-start gap-4">
              <Clock3 size={20} className="shrink-0 text-emerald-400 mt-0.5" />
              <p>Job generation akan diproses di background. Kamu bisa melanjutkan kerja dan memantau status render di menu <strong>Queue & Hasil</strong>.</p>
            </div>
          </div>

          {errMsg && (
            <div className="rounded-2xl border border-red-400/20 bg-red-400/[.07] p-4 text-sm leading-relaxed text-red-100/80">{errMsg}</div>
          )}
          
          <PrimaryButton icon={Play} onClick={handleGenerate} disabled={busy || !currentData.prompt.trim()} className="w-full py-5 text-base shadow-lg shadow-sky-900/20">
            {busy ? "Mengirim ke Server..." : "Generate Video Sekarang"}
          </PrimaryButton>
        </div>
      </div>

      {/* Desktop Toast positioned at Bottom-Right */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            className="fixed bottom-10 right-10 z-50 w-96 rounded-2xl border border-white/10 bg-[#162028]/95 px-5 py-4 shadow-2xl backdrop-blur-2xl"
          >
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl" style={{ background: "rgba(181,204,210,.16)" }}>
                <CheckCircle2 size={24} style={{ color: BRAND.accent }} />
              </div>
              <div>
                <div className="text-base font-semibold">Job Berhasil Dikirim</div>
                <div className="mt-1 text-sm text-white/60">Cek status di menu Queue.</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function VideoThumbnail({ gradient, status }) {
  const isProcess = status === "Proses" || status === "Antri";
  return (
    <div className={`relative h-24 w-36 shrink-0 overflow-hidden rounded-[20px] bg-gradient-to-br ${gradient}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.24),transparent_34%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
      <div className={`absolute right-2 top-2 rounded-lg px-2.5 py-1 text-[11px] font-bold shadow-md ${isProcess ? "bg-sky-400 text-slate-950" : status === "Gagal" ? "bg-red-400 text-red-950" : "bg-emerald-400 text-emerald-950"}`}>
        {status}
      </div>
    </div>
  );
}

function ActiveJobCard({ job }) {
  const queued = job.status === "queued";
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[.02] p-4 transition-all hover:bg-white/[.04] hover:border-white/20">
      <div className="flex gap-5">
        <VideoThumbnail gradient={job.thumb} status={queued ? "Antri" : "Proses"} />
        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-base font-semibold">{job.engine}</div>
              <div className="mt-1.5 truncate text-sm text-white/50">{job.title}</div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-medium text-white/40">
            <span>{job.duration}s • {job.ratio}</span>
            <span className="text-white/70">{queued ? "Menunggu slot" : `${job.progress || 0}%`}</span>
          </div>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-black/50 border border-white/5">
            <div className="h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(181,204,210,0.5)]" style={{ width: `${queued ? 5 : (job.progress || 0)}%`, background: BRAND.accent }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function fmtDate(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) + " • " +
           d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function CompletedJobCard({ job }) {
  const [open, setOpen] = useState(false);
  const src = job.file ? "file://" + job.file : job.url;
  return (
    <div className="rounded-[28px] border border-emerald-400/20 bg-emerald-400/5 p-4 transition-all hover:bg-emerald-400/10">
      <div className="flex gap-5">
        <button onClick={() => setOpen(true)} className="relative h-24 w-36 shrink-0 overflow-hidden rounded-[20px] group border border-white/10">
          {src ? (
            <video src={src} className="h-full w-full object-cover" muted playsInline preload="metadata" />
          ) : (
            <div className={`h-full w-full bg-gradient-to-br ${job.thumb}`} />
          )}
          <div className="absolute inset-0 grid place-items-center bg-black/40 group-hover:bg-black/20 transition-colors">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-white/20 backdrop-blur-sm group-hover:scale-110 transition-transform"><Play size={20} className="text-white ml-1" /></div>
          </div>
        </button>
        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-base font-semibold">{job.engine}</div>
              <div className="mt-1.5 truncate text-sm text-white/50">{job.title}</div>
            </div>
            <a href={src} download className="h-10 w-10 grid place-items-center rounded-xl bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors" title="Download Video">
              <Download size={18} />
            </a>
          </div>
          <div className="mt-4 flex items-center gap-2.5 text-xs font-medium text-white/40">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span>{fmtDate(job.doneAt || job.createdAt)}</span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-10 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <div className="relative max-w-5xl w-full">
               <button onClick={() => setOpen(false)} className="absolute -top-12 right-0 text-white/50 hover:text-white"><X size={32}/></button>
               <video src={src} className="max-h-[85vh] w-full rounded-2xl shadow-2xl" controls autoPlay loop onClick={(e) => e.stopPropagation()} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FailedJobCard({ job, onRetry, onRemove }) {
  return (
    <div className="rounded-[28px] border border-red-400/20 bg-red-400/[.04] p-4 transition-all hover:bg-red-400/10">
      <div className="flex gap-5">
        <VideoThumbnail gradient={job.thumb} status="Gagal" />
        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-base font-semibold text-red-200">{job.engine}</div>
              <div className="mt-1 truncate text-sm text-red-200/60">{job.title}</div>
            </div>
            <button
              onClick={() => onRemove(job.id)}
              className="h-10 w-10 grid place-items-center rounded-xl bg-red-400/10 text-red-300 hover:bg-red-400/20 transition-colors"
              title="Hapus Job"
            >
              <X size={18} />
            </button>
          </div>
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-red-400/10 bg-black/30 p-3 text-xs leading-relaxed text-red-200/70">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" />
            <span>{job.reason}</span>
          </div>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="text-xs font-medium text-red-200/50">{fmtDate(job.createdAt)}</div>
            <button
              onClick={() => onRetry(job.id)}
              className="flex items-center gap-2 rounded-xl bg-red-400 px-4 py-2 text-xs font-bold text-red-950 transition active:scale-95 hover:bg-red-300"
            >
              <RotateCcw size={14} />
              Coba Lagi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QueueResultsPage({ go, generateAgain, jobs = [] }) {
  const active = jobs.filter((j) => j.status === "processing" || j.status === "queued");
  const failed = jobs.filter((j) => j.status === "failed");
  const completed = jobs.filter((j) => j.status === "done");
  const onRetry = (id) => { if (window.webkita) window.webkita.jobRetry(id); };
  const onRemove = (id) => { if (window.webkita) window.webkita.jobRemove(id); };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="h-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Queue & Hasil</h1>
          <p className="text-sm text-white/50 mt-1">Pantau proses render dan unduh video yang sudah selesai.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pb-10">
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-[32px] border border-white/10 bg-white/[.02] p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-xs font-semibold tracking-wider text-white/40 mb-2">TOTAL RENDER JOBS</div>
                <div className="text-4xl font-bold tracking-tight">{jobs.length} <span className="text-xl font-medium text-white/40">Video</span></div>
              </div>
              <div className="grid h-16 w-16 place-items-center rounded-2xl shadow-inner" style={{ background: BRAND.depth }}>
                <Film size={28} style={{ color: BRAND.accent }} />
              </div>
            </div>
            <p className="text-sm leading-relaxed text-white/50 mb-8">
              Semua *job* video berjalan secara paralel di server. Video yang selesai otomatis tersimpan dan siap diunduh.
            </p>
            <PrimaryButton onClick={generateAgain} className="w-full py-4 text-base justify-center gap-3">
              Buat Video Baru
            </PrimaryButton>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-8">
          {jobs.length === 0 && (
            <div className="flex flex-col items-center justify-center p-16 text-center border border-white/5 bg-white/[.01] rounded-[32px]">
              <Film size={48} className="text-white/10 mb-4" />
              <p className="text-base text-white/40">Belum ada video di antrean.<br/>Mulai dari Studio untuk generate video pertamamu.</p>
            </div>
          )}

          {active.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-5 pl-2">
                <Loader2 size={18} className="text-sky-400 animate-spin" />
                <h2 className="text-lg font-semibold tracking-tight">Proses Aktif ({active.length})</h2>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {active.map((job) => <ActiveJobCard key={job.id} job={job} />)}
              </div>
            </div>
          )}

          {failed.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-5 pl-2">
                <AlertTriangle size={18} className="text-red-400" />
                <h2 className="text-lg font-semibold tracking-tight text-red-100">Render Gagal ({failed.length})</h2>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {failed.map((job) => <FailedJobCard key={job.id} job={job} onRetry={onRetry} onRemove={onRemove} />)}
              </div>
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-5 pl-2">
                <CheckCircle2 size={18} className="text-emerald-400" />
                <h2 className="text-lg font-semibold tracking-tight">Selesai ({completed.length})</h2>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {completed.map((job) => <CompletedJobCard key={job.id} job={job} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function AccountPage({ go }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="h-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Pengaturan Akun</h1>
          <p className="text-sm text-white/50 mt-1">Kelola lisensi dan status keanggotaan.</p>
        </div>
      </div>

      <div className="max-w-3xl border border-white/10 bg-white/[.02] p-8 lg:p-10 rounded-[32px] mt-10">
        <div className="flex items-center gap-6 mb-10">
          <div className="grid h-24 w-24 place-items-center rounded-3xl shadow-inner" style={{ background: BRAND.depth }}>
            <User size={40} style={{ color: BRAND.accent }} />
          </div>
          <div>
            <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-300 w-max mb-3">Status Aktif</div>
            <h2 className="text-3xl font-semibold tracking-tight">Aksara Strategy Member</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-[24px] border border-white/5 bg-black/20 p-6 flex items-center gap-5">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[.05]">
              <ShieldCheck size={24} style={{ color: BRAND.accent }} />
            </div>
            <div>
              <div className="text-xs font-semibold tracking-wide text-white/40 mb-1">LICENSE KEY</div>
              <div className="text-base font-medium flex items-center gap-2">
                AKSARA-••••-•••• <BadgeCheck size={16} className="text-emerald-400" />
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/5 bg-black/20 p-6 flex items-center gap-5">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[.05]">
              <CalendarClock size={24} style={{ color: BRAND.accent }} />
            </div>
            <div>
              <div className="text-xs font-semibold tracking-wide text-white/40 mb-1">MASA AKTIF</div>
              <div className="text-base font-medium text-white/90">Unlimited Access</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function App() {
  const [screen, setScreen] = useState("splash");
  const [activeTool, setActiveTool] = useState("seedance");
  const [licenseError, setLicenseError] = useState("");
  const [jobs, setJobs] = useState([]);
  const [account, setAccount] = useState(null);
  const [logs, setLogs] = useState([]);
  const [studioData, setStudioData] = useState({
    veo:      { startFrame: null, endFrame: null, omniRefs: [null, null, null, null], duration: "4s", ratio: "9:16", prompt: "" },
    seedance: { startFrame: null, endFrame: null, omniRefs: [null, null, null, null], duration: "5s", ratio: "9:16", prompt: "" },
    kling:    { startFrame: null, endFrame: null, omniRefs: [null, null, null, null], duration: "5s", ratio: "9:16", prompt: "" },
  });

  // Check saved state on mount
  useEffect(() => {
    const wk = window.webkita;
    if (!wk) return; // dev mode without Electron
    wk.getState().then((s) => {
      if (s && s.connected) {
        setAccount({ email: s.email, uid: s.uid });
        setScreen("home");
      }
    });
    // Subscribe to live job updates from main process
    wk.onJobs((updatedJobs) => setJobs(updatedJobs || []));
    wk.onLog((line) => setLogs((prev) => [...prev.slice(-200), line]));
    wk.jobsList().then((list) => { if (list && list.length) setJobs(list); });
  }, []);

  const doActivate = async (key) => {
    setLicenseError("");
    setScreen("validating");
    const wk = window.webkita;
    if (!wk) {
      // Dev fallback — no Electron
      setTimeout(() => { setAccount({ email: "demo@aksara.id", uid: "123" }); setScreen("home"); }, 1500);
      return;
    }
    try {
      const r = await wk.activate(key);
      if (r && r.ok !== false) {
        setAccount({ email: r.email || "member@aksara.id", uid: r.uid || r.userId });
        setScreen("home");
      } else {
        setLicenseError((r && r.reason) || "License tidak valid");
        setScreen("license");
      }
    } catch (e) {
      setLicenseError(e.message || "Koneksi gagal");
      setScreen("license");
    }
  };

  const submitJob = async (payload) => {
    const wk = window.webkita;
    if (!wk) return { ok: false, reason: "Electron tidak tersedia" };
    return await wk.generate(payload);
  };

  const goBottomNav = (target) => {
    if (["home", "studio", "queue", "account"].includes(target)) setScreen(target);
  };

  const logout = async () => {
    const wk = window.webkita;
    if (wk) await wk.reset();
    setAccount(null);
    setJobs([]);
    setScreen("license");
  };

  return (
    <DesktopLayout screen={screen} go={goBottomNav} jobs={jobs} logout={logout}>
        {screen === "splash" && <Splash key="splash" go={() => setScreen("license")} />}
        {screen === "license" && <LicensePage key="license" go={doActivate} error={licenseError} />}
        {screen === "validating" && <ValidatingPage key="validating" />}
        {screen === "home" && <Home key="home" go={goBottomNav} setActiveTool={(t) => { setActiveTool(t); setScreen("studio"); }} logout={logout} />}
        {screen === "studio" && (
          <StudioPage
            key="studio"
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            go={goBottomNav}
            studioData={studioData}
            setStudioData={setStudioData}
            submitJob={submitJob}
          />
        )}
        {screen === "queue" && <QueueResultsPage key="queue" go={goBottomNav} jobs={jobs} generateAgain={() => setScreen("studio")} />}
        {screen === "account" && <AccountPage key="account" go={goBottomNav} account={account} logout={logout} logs={logs} />}
    </DesktopLayout>
  );
}