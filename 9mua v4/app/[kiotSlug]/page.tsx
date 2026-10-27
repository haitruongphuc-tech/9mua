"use client";
// [PAGE-07] Hồ sơ Kiot - như TikTok profile + Shopee shop
import Link from "next/link";
import { notFound } from "next/navigation";
import { useState } from "react";
import { Grid3x3, Heart, MapPin, MessageCircle, Play, Radio, Share2, ShoppingBag } from "lucide-react";
import { useStore } from "@/lib/store";
import { fmtCount, fmtVND, kiotBySlug, productsOf } from "@/lib/data";
import { PageSlogan } from "@/components/ui";

export default function KiotProfile({ params }: { params: { kiotSlug: string } }) {
  const s = useStore();
  const k = kiotBySlug(params.kiotSlug);
  const [tab, setTab] = useState<"video" | "shop" | "live">("shop");
  if (!k) notFound();
  const products = productsOf(k.id, s.myProducts);

  return (
    <div className="mx-auto max-w-[900px]">
      <div className={`relative h-[170px] md:h-[220px] bg-gradient-to-br ${k.color} md:rounded-b-[24px]`}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent md:rounded-b-[24px]" />
        <PageSlogan page="profile" className="absolute bottom-3 left-4 right-4 text-[16px] md:text-[20px] drop-shadow" />
      </div>
      <div className="px-4 -mt-10 relative">
        <div className="flex items-end gap-4">
          <span className={`w-24 h-24 rounded-full border-4 border-[#0A0A0A] bg-gradient-to-br ${k.color} grid place-items-center text-[36px] font-black`}>{k.owner[0]}</span>
          <div className="pb-1 min-w-0">
            <h1 className="display text-[22px] font-black leading-tight">{k.name}</h1>
            <p className="text-[13px] text-white/60">@{k.slug} • {k.owner}</p>
          </div>
        </div>
        <div className="mt-4 flex gap-6 text-center">
          <div><p className="font-black text-[17px]">{fmtCount(k.followers + (s.followed[k.id] ? 1 : 0))}</p><p className="text-[11px] text-white/50">Followers</p></div>
          <div><p className="font-black text-[17px]">{fmtCount(k.likes + (s.hearted[k.id] ? 1 : 0))}</p><p className="text-[11px] text-white/50">Tim</p></div>
          <div><p className="font-black text-[17px]">{products.length}</p><p className="text-[11px] text-white/50">Sản phẩm</p></div>
          <div><p className="font-black text-[17px]">4.9★</p><p className="text-[11px] text-white/50">Đánh giá</p></div>
        </div>
        <p className="mt-3 text-[13px]">{k.bio} {k.hashtags.map((h) => <Link key={h} href={`/explore?tag=${h}`} className="text-[#FF6B00] font-bold">#{h} </Link>)}</p>
        <p className="mt-1 text-[12px] text-white/50 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{k.location}</p>
        <div className="mt-4 flex gap-2">
          <button onClick={() => s.toggleFollow(k.id)} className={`flex-1 h-11 rounded-[12px] font-black text-[14px] ${s.followed[k.id] ? "bg-zinc-600" : "bg-[#FF6B00]"}`}>{s.followed[k.id] ? "Following" : "Follow"}</button>
          <button onClick={() => s.setModal({ kind: "comments", kiotId: k.id })} aria-label="Nhắn tin" className="w-11 h-11 rounded-[12px] bg-white/10 grid place-items-center"><MessageCircle className="w-5 h-5" /></button>
          <button onClick={() => s.toggleHeart(k.id)} aria-label="Thả tim" className={`w-11 h-11 rounded-[12px] grid place-items-center ${s.hearted[k.id] ? "bg-[#FF6B00]" : "bg-white/10"}`}><Heart className={`w-5 h-5 ${s.hearted[k.id] ? "fill-white" : ""}`} /></button>
          <button onClick={() => s.setModal({ kind: "share", kiotId: k.id })} aria-label="Chia sẻ" className="w-11 h-11 rounded-[12px] bg-white/10 grid place-items-center"><Share2 className="w-5 h-5" /></button>
        </div>

        <div className="mt-5 flex border-b border-white/10">
          {([["video", "Video", Grid3x3], ["shop", "Sản phẩm", ShoppingBag], ["live", "Live", Radio]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={`flex-1 h-11 flex items-center justify-center gap-1.5 text-[13px] font-bold border-b-2 ${tab === id ? "border-white text-white" : "border-transparent text-white/50"}`}><Icon className="w-4 h-4" />{label}</button>
          ))}
        </div>

        {tab === "video" && (
          <div className="mt-1 grid grid-cols-3 gap-1">
            {Array.from({ length: 9 }).map((_, i) => (
              <Link key={i} href="/" className={`relative aspect-[3/4] bg-gradient-to-br ${k.color}`} style={{ filter: `hue-rotate(${i * 12}deg)` }}>
                <span className="absolute bottom-1 left-1 text-[11px] font-bold flex items-center gap-0.5"><Play className="w-3 h-3 fill-white" />{(k.likes / (i + 1) / 100).toFixed(1)}K</span>
              </Link>
            ))}
          </div>
        )}
        {tab === "shop" && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3 pb-6">
            {products.map((p) => (
              <div key={p.id} className="rounded-[14px] bg-white text-black overflow-hidden">
                <div className={`aspect-square bg-gradient-to-br ${k.color} relative`}>{p.ai && <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black text-white text-[10px] font-bold">AI • {p.technique}</span>}</div>
                <div className="p-2.5">
                  <p className="text-[13px] font-bold leading-tight line-clamp-2">{p.title}</p>
                  <p className="text-[11px] text-zinc-500 line-clamp-1">{p.desc}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[14px] font-black text-[#FF6B00]">{fmtVND(p.price)}</span>
                    <button onClick={() => s.addToCart(p.id)} className="h-8 px-3 rounded-full bg-black text-white text-[11px] font-bold">+ Giỏ</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === "live" && (
          <div className="mt-4 pb-6 text-center">
            <p className="text-[13px] text-white/60">{k.owner} đang live bán hàng</p>
            <Link href="/live" className="mt-3 inline-flex h-11 px-6 rounded-full bg-red-600 font-black text-[13px] items-center gap-2"><Radio className="w-4 h-4" /> Vào xem Live</Link>
          </div>
        )}
      </div>
    </div>
  );
}
