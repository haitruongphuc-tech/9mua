"use client";
// [PAGE-01] Home Feed - Feed dọc như TikTok, double tap thả tim túi cam, infinite scroll
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bookmark, Eye, Heart, MessageCircle, Music2, Repeat2, Share2, ShoppingBag, Users } from "lucide-react";
import { useStore, visibleKiots } from "@/lib/store";
import { fmtCount, fmtVND, productsOf } from "@/lib/data";

export default function Home() {
  const s = useStore();
  const kiots = visibleKiots(s);
  const [rounds, setRounds] = useState(2);
  const [current, setCurrent] = useState(0);
  const [pops, setPops] = useState<{ id: number; x: number; y: number }[]>([]);
  const [tab, setTab] = useState<"fyp" | "following">("fyp");
  const lastTap = useRef(0);
  const feed = useRef<HTMLDivElement>(null);

  // FYP: ưu tiên ngành hàng bạn đã thả tim
  const likedCats = new Set(kiots.filter((k) => s.hearted[k.id]).map((k) => k.cat));
  const base = tab === "following" ? kiots.filter((k) => s.followed[k.id]) : [...kiots].sort((a, b) => Number(likedCats.has(b.cat)) - Number(likedCats.has(a.cat)));
  const items = Array.from({ length: rounds }).flatMap((_, r) => base.map((k) => ({ k, key: `${r}-${k.id}` })));

  useEffect(() => {
    const el = feed.current;
    if (!el) return;
    const obs = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      const i = Number((e.target as HTMLElement).dataset.index);
      setCurrent(i);
      if (i >= items.length - 2) setRounds((r) => r + 1); // infinite scroll
    }), { threshold: 0.6 });
    el.querySelectorAll("[data-index]").forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, [items.length]);

  const pop = (x: number, y: number) => {
    const id = Date.now() + Math.random();
    setPops((p) => [...p, { id, x, y }]);
    setTimeout(() => setPops((p) => p.filter((q) => q.id !== id)), 900);
  };

  const onTap = (e: React.MouseEvent, kiotId: number) => {
    const now = Date.now();
    if (now - lastTap.current < 300) { pop(e.clientX, e.clientY); s.toggleHeart(kiotId, true); }
    lastTap.current = now;
  };

  return (
    <div className="relative">
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex gap-4 text-[14px] font-bold">
        <button onClick={() => setTab("following")} className={tab === "following" ? "text-white border-b-2 border-white pb-0.5" : "text-white/60"}>Đang Follow</button>
        <button onClick={() => setTab("fyp")} className={tab === "fyp" ? "text-white border-b-2 border-white pb-0.5" : "text-white/60"}>Dành cho bạn</button>
      </div>
      <div ref={feed} className="h-[calc(100dvh-128px)] overflow-y-scroll snap-y-mandatory no-scrollbar">
        {items.length === 0 && (
          <div className="h-full grid place-items-center text-center px-6">
            <div><p className="font-black text-[18px]">Bạn chưa follow Kiot nào</p><button onClick={() => setTab("fyp")} className="mt-3 h-10 px-5 rounded-full bg-[#FF6B00] font-black text-[13px]">Xem Dành cho bạn</button></div>
          </div>
        )}
        {items.map(({ k, key }, idx) => {
          const prod = productsOf(k.id, s.myProducts)[0];
          return (
            <section key={key} data-index={idx} onClick={(e) => onTap(e, k.id)} className="snap-start relative h-[calc(100dvh-128px)] w-full overflow-hidden flex">
              <div className={`absolute inset-0 bg-gradient-to-br ${k.color}`} />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/20" />
              <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] bg-[size:22px_22px]" />
              <div className="mx-auto w-full max-w-[900px] relative flex">
                <div className="relative z-10 flex-1 flex flex-col justify-end p-4 md:p-8 pb-6 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {s.pinnedKiot === k.id && <span className="px-2 py-1 rounded-full bg-white text-black text-[10px] font-black">📌 GHIM HAMUBAY</span>}
                    <span className="px-2 py-1 rounded-full bg-black/40 text-[10px] border border-white/20 flex items-center gap-1"><Eye className="w-3 h-3" /> {k.views}</span>
                    <span className="px-2 py-1 rounded-full bg-[#FF6B00] text-[10px] font-bold">KIOT $1</span>
                  </div>
                  <Link href={`/${k.slug}`} onClick={(e) => e.stopPropagation()} className="font-black text-[16px] hover:underline">@{k.slug}</Link>
                  <h2 className="display text-[28px] md:text-[44px] font-black leading-[0.95] tracking-tight drop-shadow-[0_2px_20px_rgba(0,0,0,0.6)]">{k.name}</h2>
                  <p className="mt-2 text-[14px] text-white/85">{k.bio} {k.hashtags.map((h) => (
                    <Link key={h} href={`/explore?tag=${h}`} onClick={(e) => e.stopPropagation()} className="font-bold hover:underline">#{h} </Link>
                  ))}</p>
                  <p className="mt-2 text-[12px] text-white/80 flex items-center gap-1.5"><Music2 className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{k.music}</span></p>
                  {prod && (
                    <button onClick={(e) => { e.stopPropagation(); s.addToCart(prod.id); }} className="mt-3 w-full max-w-[360px] flex items-center gap-3 rounded-[14px] bg-white/90 text-black p-2 text-left">
                      <span className={`w-11 h-11 rounded-[10px] bg-gradient-to-br ${k.color} grid place-items-center shrink-0`}><ShoppingBag className="w-5 h-5 text-white" /></span>
                      <span className="min-w-0 flex-1"><span className="block text-[12px] font-bold truncate">{prod.title}</span><span className="block text-[12px] text-[#FF6B00] font-black">{fmtVND(prod.price)}</span></span>
                      <span className="h-8 px-3 rounded-full bg-[#FF6B00] text-white text-[11px] font-black grid place-items-center">+ Giỏ</span>
                    </button>
                  )}
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button onClick={(e) => { e.stopPropagation(); s.setModal({ kind: "buy", kiotId: k.id }); }} className="h-9 px-4 rounded-full bg-white text-black font-black text-[12px]">MUA KIOT $1</button>
                    <button onClick={(e) => { e.stopPropagation(); s.notify(`🎬 Đã mở Duet với ${k.name} - Collab bán chéo`); }} className="h-9 px-4 rounded-full bg-black/40 border border-white/20 font-bold text-[12px] flex items-center gap-1"><Repeat2 className="w-4 h-4" /> Duet / Collab</button>
                  </div>
                </div>
                <div className="relative z-10 w-[72px] flex flex-col items-center justify-end gap-4 pb-6 pr-2">
                  <div className="relative mb-2">
                    <Link href={`/${k.slug}`} onClick={(e) => e.stopPropagation()} className="block w-12 h-12 rounded-full border-2 border-white overflow-hidden"><div className={`w-full h-full bg-gradient-to-br ${k.color} grid place-items-center font-black`}>{k.owner[0]}</div></Link>
                    <button onClick={(e) => { e.stopPropagation(); s.toggleFollow(k.id); }} aria-label="Follow" className={`absolute -bottom-2 left-1/2 -translate-x-1/2 h-5 px-1.5 rounded-full text-[10px] font-black ${s.followed[k.id] ? "bg-zinc-400 text-white" : "bg-[#FF6B00] text-white"}`}>{s.followed[k.id] ? "✓" : "+"}</button>
                  </div>
                  <Action label={fmtCount(k.likes + (s.hearted[k.id] ? 1 : 0))} active={s.hearted[k.id]} onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); if (!s.hearted[k.id]) pop(r.left + r.width / 2, r.top); s.toggleHeart(k.id); }} aria="Thả tim"><Heart className={`w-6 h-6 ${s.hearted[k.id] ? "fill-white" : ""}`} /></Action>
                  <Action label={`${s.comments.filter((c) => c.kiotId === k.id).length}`} onClick={() => s.setModal({ kind: "comments", kiotId: k.id })} aria="Bình luận"><MessageCircle className="w-6 h-6" /></Action>
                  <Action label={s.saved[k.id] ? "Đã lưu" : "Lưu"} active={s.saved[k.id]} onClick={() => s.toggleSave(k.id)} aria="Lưu"><Bookmark className={`w-5 h-5 ${s.saved[k.id] ? "fill-white" : ""}`} /></Action>
                  <Action label="Share" onClick={() => s.setModal({ kind: "share", kiotId: k.id })} aria="Chia sẻ"><Share2 className="w-5 h-5" /></Action>
                  <Action label={s.followed[k.id] ? "Following" : "Follow"} active={s.followed[k.id]} gray onClick={() => s.toggleFollow(k.id)} aria="Theo dõi"><Users className="w-5 h-5" /></Action>
                </div>
              </div>
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/10 z-20"><div className="h-full bg-[#FF6B00] transition-all" style={{ width: `${(((current % (base.length || 1)) + 1) / (base.length || 1)) * 100}%` }} /></div>
            </section>
          );
        })}
      </div>
      {pops.map((p) => (
        <div key={p.id} className="pointer-events-none fixed z-[60]" style={{ left: p.x - 36, top: p.y - 36, animation: "bagPop 0.9s ease-out forwards" }}>
          <div className="w-[72px] h-[72px] rounded-full bg-[#FF6B00] grid place-items-center shadow-[0_0_24px_#FF6B00]"><ShoppingBag className="w-9 h-9 text-white" /></div>
          <Heart className="absolute -top-2 -right-2 w-7 h-7 fill-white text-white" />
        </div>
      ))}
    </div>
  );
}

function Action({ children, label, onClick, active, gray, aria }: { children: React.ReactNode; label: string; onClick: (e: React.MouseEvent) => void; active?: boolean; gray?: boolean; aria: string }) {
  return (
    <button aria-label={aria} onClick={(e) => { e.stopPropagation(); onClick(e); }} className="flex flex-col items-center gap-1">
      <span className={`w-12 h-12 rounded-full grid place-items-center border transition ${active ? (gray ? "bg-zinc-500 border-zinc-500" : "bg-[#FF6B00] border-[#FF6B00] shadow-[0_0_16px_#FF6B00]") : "bg-white/15 border-white/20 hover:bg-white/25"}`}>{children}</span>
      <span className="text-[11px] font-bold">{label}</span>
    </button>
  );
}
