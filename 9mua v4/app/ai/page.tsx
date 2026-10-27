"use client";
// [PAGE-09] AI Studio - ArtCraft AI: 5 techniques + 9 AIs -> 4 ảnh + 1 video 10s + voiceover 7 ngôn ngữ (demo)
import { useState } from "react";
import { Check, Image as ImageIcon, Lock, Mic, Play, Rocket, Sparkles, Video } from "lucide-react";
import { useStore } from "@/lib/store";
import { AIS, LANGS, TECHNIQUES, fmtVND } from "@/lib/data";
import { PageSlogan } from "@/components/ui";

export default function AIStudio() {
  const s = useStore();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("150000");
  const [tech, setTech] = useState(TECHNIQUES[4].id);
  const [ais, setAis] = useState<string[]>(["Midjourney v6", "Runway Gen-3", "ElevenLabs"]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ name: string; tech: string } | null>(null);
  const [pick, setPick] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const t = TECHNIQUES.find((x) => x.id === tech)!;

  const gen = () => {
    if (!s.isOwner) return s.setModal({ kind: "buy" });
    if (!name.trim()) return s.notify("Nhập tên sản phẩm");
    setLoading(true); setResult(null);
    setTimeout(() => { setResult({ name: name.trim(), tech }); setPick(0); setLoading(false); }, 2200);
  };

  const voice = (lang: string) => {
    const synth = window.speechSynthesis;
    if (!synth || !result) return;
    const u = new SpeechSynthesisUtterance(`${result.name}. 9MUA`);
    u.lang = LANGS.find((l) => l.id === lang)!.tts;
    synth.cancel(); synth.speak(u);
    s.notify(`🔊 Voiceover ${lang}`);
  };

  return (
    <div className="mx-auto max-w-[900px] px-3 md:px-6 py-5">
      <div className="rounded-[24px] bg-gradient-to-br from-fuchsia-700/40 via-[#FF6B00]/30 to-cyan-600/30 border border-white/10 p-5">
        <div className="flex items-center gap-2 text-[12px] font-black"><Sparkles className="w-4 h-4 text-[#FF6B00]" /> ARTCRAFT AI STUDIO</div>
        <PageSlogan page="ai" className="mt-2 text-[22px] md:text-[28px] leading-tight" />
        {!s.isOwner && <p className="mt-2 text-[12px] text-white/70 flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Dành cho Kiot Owner - Mua Kiot $1 để dùng</p>}

        <div className="mt-4 grid md:grid-cols-[1fr_140px] gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên sản phẩm, VD: Mực một nắng Hamubay" className="h-12 rounded-full bg-black/40 border border-white/15 px-4 outline-none focus:border-[#FF6B00] text-[14px]" />
          <input value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Giá (đ)" className="h-12 rounded-full bg-black/40 border border-white/15 px-4 outline-none focus:border-[#FF6B00] text-[14px]" />
        </div>
        <p className="mt-4 text-[12px] font-bold">5 kỹ thuật</p>
        <div className="mt-2 grid grid-cols-5 gap-2">
          {TECHNIQUES.map((x) => (
            <button key={x.id} onClick={() => setTech(x.id)} className={`rounded-[12px] p-1 border-2 ${tech === x.id ? "border-[#FF6B00]" : "border-transparent"}`}>
              <span className={`block aspect-square rounded-[8px] bg-gradient-to-br ${x.cls}`} />
              <span className="block mt-1 text-[10px] font-bold leading-tight">{x.name}</span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-[12px] font-bold">9 AI • đã chọn {ais.length}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {AIS.map((a) => {
            const on = ais.includes(a);
            return <button key={a} onClick={() => setAis((x) => (on ? x.filter((y) => y !== a) : [...x, a]))} className={`h-8 px-3 rounded-full text-[11px] font-bold border flex items-center gap-1 ${on ? "bg-white text-black border-white" : "border-white/20 text-white/70"}`}>{on && <Check className="w-3 h-3" />}{a}</button>;
          })}
        </div>
        <button onClick={gen} disabled={loading} className="mt-5 w-full h-12 rounded-full bg-[#FF6B00] font-black text-[15px] shadow-[0_0_20px_rgba(255,107,0,0.5)] disabled:opacity-60 flex items-center justify-center gap-2">
          {s.isOwner ? <Sparkles className="w-5 h-5" /> : <Lock className="w-5 h-5" />}{loading ? "AI ĐANG TẠO..." : s.isOwner ? "TẠO 4 ẢNH + VIDEO + VOICE" : "MUA KIOT $1 ĐỂ DÙNG AI STUDIO"}
        </button>
      </div>

      {loading && (
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-square rounded-[16px] bg-white/10 animate-pulse" />)}</div>
      )}

      {result && (
        <div className="mt-5 space-y-4">
          <div>
            <p className="text-[13px] font-black flex items-center gap-1"><ImageIcon className="w-4 h-4" /> 4 ẢNH • {t.name} • chọn ảnh đẹp nhất</p>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <button key={i} onClick={() => setPick(i)} className={`relative aspect-square rounded-[16px] overflow-hidden bg-gradient-to-br ${t.cls} border-4 ${pick === i ? "border-[#FF6B00]" : "border-transparent"}`} style={{ filter: `hue-rotate(${i * 25}deg)` }}>
                  <span className={`absolute inset-0 grid place-items-center p-3 text-center display font-black text-[15px] ${tech === "sketch" || tech === "flat" ? "text-black" : "text-white"}`}>{result.name}</span>
                  {pick === i && <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#FF6B00] grid place-items-center"><Check className="w-4 h-4" /></span>}
                </button>
              ))}
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <button onClick={() => { setVideoPlaying(true); setTimeout(() => setVideoPlaying(false), 10000); }} className={`relative h-[160px] rounded-[16px] overflow-hidden bg-gradient-to-br ${t.cls} text-left`}>
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-[11px] font-bold flex items-center gap-1"><Video className="w-3 h-3" /> Video 10s</span>
              <span className="absolute inset-0 grid place-items-center">{videoPlaying ? <span className="text-[13px] font-black bg-black/50 px-3 py-1 rounded-full">▶ Đang phát...</span> : <span className="w-14 h-14 rounded-full bg-black/50 grid place-items-center"><Play className="w-7 h-7 fill-white" /></span>}</span>
              {videoPlaying && <span className="absolute bottom-0 left-0 h-1 bg-[#FF6B00]" style={{ animation: "storyBar 10s linear forwards" }} />}
            </button>
            <div className="rounded-[16px] bg-white/5 border border-white/10 p-3">
              <p className="text-[12px] font-black flex items-center gap-1"><Mic className="w-4 h-4" /> Voiceover 7 ngôn ngữ</p>
              <div className="mt-2 grid grid-cols-4 gap-1.5">{LANGS.map((l) => <button key={l.id} onClick={() => voice(l.id)} className="h-9 rounded-[10px] bg-white/10 text-[11px] font-bold hover:bg-[#FF6B00]">{l.id}</button>)}</div>
            </div>
          </div>
          <button onClick={() => s.publishProduct({ title: result.name, price: Number(price) || 0, desc: `Ảnh AI ${t.name} • ${ais.join(", ")}`, ai: true, technique: t.name })} className="w-full h-12 rounded-full bg-white text-black font-black flex items-center justify-center gap-2"><Rocket className="w-5 h-5" /> ĐĂNG BÁN • {fmtVND(Number(price) || 0)}</button>
        </div>
      )}
    </div>
  );
}
