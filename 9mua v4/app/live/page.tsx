"use client";
// [PAGE-03] Live & Story - Live bán hàng (ghim sản phẩm, mua ngay), Story 24h của Kiot Owner
import { useEffect, useRef, useState } from "react";
import { Eye, Gift, Heart, Pin, Radio, Send, ShoppingBag, X } from "lucide-react";
import { useStore, visibleKiots } from "@/lib/store";
import { fmtVND, kiotById, productsOf } from "@/lib/data";
import { PageSlogan } from "@/components/ui";

const CHAT = ["Tim bay đẹp quá 🧡", "Ship Đà Nẵng bao lâu shop?", "Mua 2 cái nha", "Kiot $1 mở ở đâu vậy?", "Hàng thật Hamubay 👍", "Giảm giá đi chị ơi", "Đã follow!"];

export default function Live() {
  const s = useStore();
  const kiots = visibleKiots(s);
  const [liveId, setLiveId] = useState(kiots[0]?.id ?? 1);
  const [story, setStory] = useState<number | null>(null);
  const [seen, setSeen] = useState<Record<number, boolean>>({});
  const [chat, setChat] = useState<{ id: number; who: string; text: string }[]>([]);
  const [msg, setMsg] = useState("");
  const [hearts, setHearts] = useState<number[]>([]);
  const [myLive, setMyLive] = useState(false);
  const live = kiotById(liveId)!;
  const products = productsOf(liveId, s.myProducts);
  const [pinned, setPinned] = useState(0);
  const chatRef = useRef<HTMLDivElement>(null);

  // Chat chạy tự động
  useEffect(() => {
    setChat([]); setPinned(0);
    const t = setInterval(() => setChat((c) => [...c.slice(-20), { id: Date.now(), who: ["Thu Hà", "Minh Tuấn", "Lan Anh", "Việt Kiều", "Bé Na"][Math.floor(Math.random() * 5)], text: CHAT[Math.floor(Math.random() * CHAT.length)] }]), 1800);
    return () => clearInterval(t);
  }, [liveId]);
  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight }); }, [chat]);

  // Story tự chuyển sau 5s
  useEffect(() => {
    if (story === null) return;
    setSeen((x) => ({ ...x, [story]: true }));
    const t = setTimeout(() => {
      const i = kiots.findIndex((k) => k.id === story);
      setStory(kiots[i + 1]?.id ?? null);
    }, 5000);
    return () => clearTimeout(t);
  }, [story, kiots]);

  const heart = () => { const id = Date.now() + Math.random(); setHearts((h) => [...h, id]); setTimeout(() => setHearts((h) => h.filter((x) => x !== id)), 1200); };
  const send = () => { if (!msg.trim()) return; if (!s.user) return s.setModal({ kind: "signup" }); setChat((c) => [...c, { id: Date.now(), who: s.user!.name, text: msg.trim() }]); setMsg(""); };
  const storyKiot = story !== null ? kiotById(story) : null;

  return (
    <div className="mx-auto max-w-[1100px] px-3 md:px-6 py-4">
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
        <button onClick={() => (s.isOwner ? s.notify("📸 Đã đăng Story 24h (demo)") : s.setModal({ kind: "buy" }))} className="shrink-0 flex flex-col items-center gap-1 w-[68px]">
          <span className="w-16 h-16 rounded-full border-2 border-dashed border-white/40 grid place-items-center text-[24px]">+</span>
          <span className="text-[10px] text-white/70">Story của bạn</span>
        </button>
        {kiots.map((k) => (
          <button key={k.id} onClick={() => setStory(k.id)} className="shrink-0 flex flex-col items-center gap-1 w-[68px]">
            <span className={`w-16 h-16 rounded-full p-[3px] ${seen[k.id] ? "bg-white/20" : "bg-gradient-to-tr from-[#FF6B00] to-yellow-400"}`}>
              <span className={`w-full h-full rounded-full border-2 border-[#0A0A0A] bg-gradient-to-br ${k.color} grid place-items-center font-black`}>{k.owner[0]}</span>
            </span>
            <span className="text-[10px] text-white/70 truncate w-full text-center">{k.owner}</span>
          </button>
        ))}
      </div>

      <PageSlogan page="live" className="mt-3 text-[18px] md:text-[22px] text-center" />

      <div className="mt-3 grid md:grid-cols-[1.4fr_0.6fr] gap-4">
        <div className="relative rounded-[20px] overflow-hidden h-[520px] md:h-[600px] border border-white/10">
          <div className={`absolute inset-0 bg-gradient-to-br ${live.color}`} />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/40" />
          <div className="absolute top-3 left-3 right-3 flex justify-between items-center">
            <div className="flex items-center gap-2 rounded-full bg-black/50 pr-3">
              <span className={`w-9 h-9 rounded-full bg-gradient-to-br ${live.color} grid place-items-center font-black border-2 border-white`}>{live.owner[0]}</span>
              <span className="text-[12px] font-bold">{live.owner}</span>
              <button onClick={() => s.toggleFollow(live.id)} className={`h-7 px-3 rounded-full text-[11px] font-black ${s.followed[live.id] ? "bg-zinc-500" : "bg-[#FF6B00]"}`}>{s.followed[live.id] ? "Following" : "Follow"}</button>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-red-600 text-[11px] font-black flex items-center gap-1"><Eye className="w-3 h-3" /> LIVE • {live.views}</span>
          </div>

          {products[pinned] && (
            <div className="absolute top-16 left-3 w-[230px] rounded-[14px] bg-white text-black p-2 flex gap-2 items-center shadow-xl">
              <span className={`w-12 h-12 rounded-[10px] bg-gradient-to-br ${live.color} grid place-items-center shrink-0`}><ShoppingBag className="w-5 h-5 text-white" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-[#FF6B00] font-bold flex items-center gap-1"><Pin className="w-3 h-3" /> Đang ghim</p>
                <p className="text-[12px] font-bold truncate">{products[pinned].title}</p>
                <p className="text-[12px] font-black">{fmtVND(products[pinned].price)}</p>
              </div>
              <button onClick={() => s.addToCart(products[pinned].id)} className="h-8 px-2.5 rounded-full bg-[#FF6B00] text-white text-[11px] font-black">Mua ngay</button>
            </div>
          )}

          <div ref={chatRef} className="absolute left-3 bottom-[72px] w-[70%] max-h-[200px] overflow-y-auto no-scrollbar space-y-1.5">
            {chat.map((c) => <p key={c.id} className="text-[12px] bg-black/40 rounded-[12px] px-2.5 py-1 w-fit max-w-full"><b className="text-[#FFB27A]">{c.who}:</b> {c.text}</p>)}
          </div>
          {hearts.map((h) => <Heart key={h} className="absolute right-6 bottom-24 w-8 h-8 fill-[#FF6B00] text-[#FF6B00] pointer-events-none" style={{ animation: "heartFly 1.2s ease-out forwards" }} />)}

          <div className="absolute bottom-3 left-3 right-3 flex gap-2">
            <input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Bình luận..." className="flex-1 min-w-0 h-11 rounded-full bg-black/50 border border-white/20 px-4 outline-none text-[13px]" />
            <button onClick={send} aria-label="Gửi" className="w-11 h-11 rounded-full bg-white/15 grid place-items-center"><Send className="w-4 h-4" /></button>
            <button onClick={() => s.notify(`🎁 Đã tặng Gift cho ${live.owner}`)} aria-label="Gift" className="w-11 h-11 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 grid place-items-center"><Gift className="w-5 h-5" /></button>
            <button onClick={heart} aria-label="Thả tim" className="w-11 h-11 rounded-full bg-[#FF6B00] grid place-items-center shadow-[0_0_14px_#FF6B00]"><Heart className="w-5 h-5 fill-white" /></button>
          </div>
        </div>

        <div className="space-y-3">
          <button onClick={() => { if (!s.isOwner) return s.setModal({ kind: "buy" }); setMyLive((l) => !l); s.notify(myLive ? "Đã kết thúc Live" : "🔴 Bạn đang phát Live bán hàng!"); }} className={`w-full h-12 rounded-full font-black text-[14px] flex items-center justify-center gap-2 ${myLive ? "bg-red-600" : "bg-[#FF6B00] shadow-[0_0_18px_rgba(255,107,0,0.5)]"}`}>
            <Radio className="w-5 h-5" /> {myLive ? "ĐANG LIVE • KẾT THÚC" : s.isOwner ? "PHÁT LIVE + BÁN HÀNG" : "MUA KIOT $1 ĐỂ PHÁT LIVE"}
          </button>
          <div className="rounded-[16px] bg-white/5 border border-white/10 p-3">
            <p className="text-[12px] font-black">SẢN PHẨM TRONG LIVE</p>
            <div className="mt-2 space-y-2">
              {products.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2 rounded-[12px] bg-black/40 p-2">
                  <div className="min-w-0 flex-1"><p className="text-[12px] font-bold truncate">{p.title}</p><p className="text-[11px] text-[#FF6B00] font-black">{fmtVND(p.price)}</p></div>
                  <button onClick={() => setPinned(i)} className={`h-7 px-2 rounded-full text-[10px] font-bold ${pinned === i ? "bg-[#FF6B00]" : "bg-white/10"}`}>{pinned === i ? "Đã ghim" : "Ghim"}</button>
                  <button onClick={() => s.addToCart(p.id)} className="h-7 px-2 rounded-full bg-white text-black text-[10px] font-black">+ Giỏ</button>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[16px] bg-white/5 border border-white/10 p-3">
            <p className="text-[12px] font-black">ĐANG LIVE • {kiots.length} KIOT</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {kiots.map((k) => (
                <button key={k.id} onClick={() => setLiveId(k.id)} className={`rounded-[12px] p-1.5 text-left border ${liveId === k.id ? "border-[#FF6B00]" : "border-white/10"}`}>
                  <div className={`h-[56px] rounded-[8px] bg-gradient-to-br ${k.color} relative`}><span className="absolute top-1 left-1 px-1 rounded bg-red-600 text-[8px] font-bold">LIVE</span></div>
                  <p className="mt-1 text-[11px] font-bold truncate">{k.name}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {storyKiot && (
        <div className="fixed inset-0 z-[85] bg-black flex items-center justify-center" onClick={() => setStory(null)}>
          <div className={`relative w-full max-w-[420px] h-full md:h-[88dvh] md:rounded-[20px] overflow-hidden bg-gradient-to-br ${storyKiot.color}`} onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-2 left-2 right-2 h-1 rounded-full bg-white/30 overflow-hidden"><div key={storyKiot.id} className="h-full bg-white" style={{ animation: "storyBar 5s linear forwards" }} /></div>
            <div className="absolute top-5 left-3 right-3 flex items-center justify-between">
              <span className="text-[13px] font-bold">{storyKiot.owner} • 3 giờ trước</span>
              <button onClick={() => setStory(null)} aria-label="Đóng"><X className="w-6 h-6" /></button>
            </div>
            <div className="absolute inset-0 grid place-items-center text-center px-8">
              <div><p className="display text-[28px] font-black">{storyKiot.name}</p><p className="mt-2 text-[14px] text-white/80">{storyKiot.bio}</p></div>
            </div>
            <button onClick={() => { setLiveId(storyKiot.id); setStory(null); }} className="absolute bottom-6 left-1/2 -translate-x-1/2 h-11 px-6 rounded-full bg-white text-black font-black text-[13px]">Xem Live của Kiot</button>
          </div>
        </div>
      )}
    </div>
  );
}
