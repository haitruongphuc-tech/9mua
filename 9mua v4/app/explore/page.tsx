"use client";
// [PAGE-02] Khám phá Kiot - Grid 2 cột, lọc ngành hàng, vị trí, #hashtag, tìm kiếm
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Heart, MapPin, Search, X } from "lucide-react";
import { useStore, visibleKiots } from "@/lib/store";
import { CATEGORIES, LOCATIONS, fmtCount } from "@/lib/data";
import { PageSlogan, Pill } from "@/components/ui";

function Explore() {
  const s = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const tag = params.get("tag") ?? "";
  const [q, setQ] = useState(params.get("q") ?? "");
  const [cat, setCat] = useState("Tất cả");
  const [loc, setLoc] = useState("Mọi nơi");

  const list = visibleKiots(s).filter((k) =>
    (cat === "Tất cả" || k.cat === cat) &&
    (loc === "Mọi nơi" || k.location === loc) &&
    (!tag || k.hashtags.some((h) => h.toLowerCase() === tag.toLowerCase())) &&
    (!q.trim() || `${k.name} ${k.owner} ${k.cat} ${k.location} ${k.hashtags.join(" ")}`.toLowerCase().includes(q.trim().toLowerCase().replace(/^#/, ""))));

  return (
    <div>
      <div className="w-full bg-gradient-to-r from-[#FF6B00] to-orange-400 px-4 py-5 text-center">
        <PageSlogan page="explore" className="text-[18px] md:text-[24px]" />
      </div>
      <div className="mx-auto max-w-[1100px] px-3 md:px-6 py-4">
        <div className="flex items-center gap-2 h-11 rounded-full bg-white/10 border border-white/10 px-4">
          <Search className="w-4 h-4 text-white/50" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm Kiot, sản phẩm, #hashtag" className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-white/40" />
          {q && <button onClick={() => setQ("")} aria-label="Xóa"><X className="w-4 h-4 text-white/50" /></button>}
        </div>
        {tag && (
          <div className="mt-3 inline-flex items-center gap-2 h-8 px-3 rounded-full bg-[#FF6B00] text-[12px] font-bold">#{tag}<button onClick={() => router.push("/explore")} aria-label="Bỏ hashtag"><X className="w-3.5 h-3.5" /></button></div>
        )}
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">{CATEGORIES.map((c) => <Pill key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Pill>)}</div>
        <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">{LOCATIONS.map((l) => <Pill key={l} active={loc === l} onClick={() => setLoc(l)}><MapPin className="inline w-3 h-3 mr-1" />{l}</Pill>)}</div>
        <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar text-[12px]">
          {["Kiot", "Hamubay", "9MUA", "CaPhe", "GomViet", "VietKieu"].map((h) => <Link key={h} href={`/explore?tag=${h}`} className="shrink-0 text-[#FF6B00] font-bold">#{h}</Link>)}
        </div>
        <p className="mt-4 text-[12px] text-white/50">{list.length} Kiot</p>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {list.map((k) => (
            <Link key={k.id} href={`/${k.slug}`} className="rounded-[16px] overflow-hidden bg-white/5 border border-white/10 hover:border-[#FF6B00]/60 transition group">
              <div className={`relative aspect-[3/4] bg-gradient-to-br ${k.color}`}>
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white text-black text-[10px] font-bold">{k.cat}</span>
                {s.pinnedKiot === k.id && <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black text-[10px] font-bold">📌</span>}
                <span className="absolute bottom-2 left-2 flex items-center gap-1 text-[11px] font-bold"><Heart className="w-3.5 h-3.5 fill-white" /> {fmtCount(k.likes)}</span>
                <span className="absolute inset-0 grid place-items-center text-[40px] font-black opacity-30 group-hover:opacity-50 transition">{k.owner[0]}</span>
              </div>
              <div className="p-2.5">
                <p className="font-bold text-[13px] truncate">{k.name}</p>
                <p className="text-[11px] text-white/50 flex items-center gap-1"><MapPin className="w-3 h-3" />{k.location}</p>
              </div>
            </Link>
          ))}
        </div>
        {list.length === 0 && <p className="mt-10 text-center text-white/50 text-[13px]">Không có Kiot phù hợp</p>}
      </div>
    </div>
  );
}

export default function ExplorePage() {
  return <Suspense><Explore /></Suspense>;
}
