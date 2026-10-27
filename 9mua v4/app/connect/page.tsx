"use client";
// [PAGE-08] Social Connect - Kết nối 6 nền tảng: TikTok, Facebook, Instagram, YouTube, Shopee, Zalo
import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, Link2, Unlink } from "lucide-react";
import { useStore } from "@/lib/store";
import { PLATFORMS, Platform, mockStats, platformValue } from "@/lib/data";
import { PageSlogan, Sheet } from "@/components/ui";

export default function Connect() {
  const s = useStore();
  const [editing, setEditing] = useState<Platform | null>(null);
  const [handle, setHandle] = useState("");
  const [loading, setLoading] = useState(false);
  const connected = PLATFORMS.filter((p) => s.connects[p.id]);
  const totalFollowers = connected.reduce((t, p) => t + (s.connects[p.id]!.stats.followers ?? 0), 0);
  const plat = PLATFORMS.find((p) => p.id === editing);

  const doConnect = () => {
    if (!editing || !handle.trim()) return;
    if (!s.user) return s.setModal({ kind: "signup" });
    setLoading(true);
    setTimeout(() => {
      s.connect(editing, { handle: handle.trim(), stats: mockStats(editing, handle.trim()), verified: true });
      s.notify(`✅ Đã kết nối ${plat?.name} ${handle.trim()}`);
      setLoading(false); setEditing(null); setHandle("");
    }, 1200);
  };

  return (
    <div className="mx-auto max-w-[760px] px-3 md:px-6 py-5">
      <div className="flex gap-2 overflow-x-auto no-scrollbar border-b border-white/10">
        {["Social Connect", "Tin nhắn", "Thông báo"].map((t, i) => (
          <button key={t} onClick={() => i && s.notify(`${t}: đang cập nhật (demo)`)} className={`h-10 px-3 text-[13px] font-bold border-b-2 ${i === 0 ? "border-[#FF6B00] text-white" : "border-transparent text-white/50"}`}>{t}</button>
        ))}
      </div>
      <PageSlogan page="connect" className="mt-4 text-[22px] md:text-[28px]" />
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-[14px] bg-white/5 border border-white/10 p-3"><p className="text-[11px] text-white/50">Đã kết nối</p><p className="font-black text-[20px]">{connected.length}/6</p></div>
        <div className="rounded-[14px] bg-white/5 border border-white/10 p-3"><p className="text-[11px] text-white/50">Tổng followers</p><p className="font-black text-[20px]">{totalFollowers.toLocaleString("vi-VN")}</p></div>
        <Link href="/value" className="rounded-[14px] bg-[#FF6B00] p-3"><p className="text-[11px] opacity-80">Giá trị ước tính</p><p className="font-black text-[20px]">{s.isOwner ? `$${connected.reduce((t, p) => t + platformValue(p.id, s.connects[p.id]!.stats), 0).toFixed(0)}` : "🔒"}</p></Link>
      </div>
      <div className="mt-4 space-y-2">
        {PLATFORMS.map((p) => {
          const c = s.connects[p.id];
          return (
            <div key={p.id} className="flex items-center gap-3 rounded-[16px] bg-white/5 border border-white/10 p-3">
              <span className={`w-11 h-11 rounded-full ${p.color} grid place-items-center font-black shrink-0`}>{p.name[0]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold flex items-center gap-1">{p.name}{c?.verified && <BadgeCheck className="w-4 h-4 text-sky-400" />}</p>
                <p className="text-[12px] text-white/50 truncate">{c ? `${c.handle} • ${(c.stats.followers ?? 0).toLocaleString("vi-VN")} followers` : p.api}</p>
              </div>
              {c ? (
                <button onClick={() => { s.connect(p.id, null); s.notify(`Đã ngắt ${p.name}`); }} className="h-9 px-3 rounded-full bg-white/10 text-[12px] font-bold flex items-center gap-1"><Unlink className="w-3.5 h-3.5" /> Ngắt</button>
              ) : (
                <button onClick={() => { setEditing(p.id); setHandle(""); }} className="h-9 px-3 rounded-full bg-[#FF6B00] text-[12px] font-black flex items-center gap-1"><Link2 className="w-3.5 h-3.5" /> Kết nối</button>
              )}
            </div>
          );
        })}
      </div>

      <Sheet open={!!plat} onClose={() => setEditing(null)} title={`Kết nối ${plat?.name ?? ""}`}>
        <p className="text-[12px] text-zinc-500">Demo: nhập handle, 9MUA tạo số liệu mẫu. Bản thật sẽ đăng nhập qua {plat?.api}.</p>
        <input autoFocus value={handle} onChange={(e) => setHandle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doConnect()} placeholder="@handle" className="mt-3 w-full h-12 rounded-full border border-black/10 px-4 outline-none focus:border-[#FF6B00] text-[15px]" />
        <button onClick={doConnect} disabled={loading} className="mt-3 w-full h-12 rounded-full bg-[#FF6B00] text-white font-black disabled:opacity-60">{loading ? "ĐANG XÁC MINH..." : "KẾT NỐI"}</button>
      </Sheet>
    </div>
  );
}
