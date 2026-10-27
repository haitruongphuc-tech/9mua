"use client";
// [PAGE-04] Value Calculator $951 - Nhập handle 6 nền tảng -> Tính -> Loading 3s -> Breakdown
import Link from "next/link";
import { useState } from "react";
import { Calculator, Lock, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { PLATFORMS, Platform, mockStats, platformValue } from "@/lib/data";
import { PageSlogan } from "@/components/ui";

export default function Value() {
  const s = useStore();
  const [handles, setHandles] = useState<Partial<Record<Platform, string>>>(() => Object.fromEntries(Object.entries(s.connects).map(([k, v]) => [k, v!.handle])));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ id: Platform; value: number; stats: Record<string, number> }[] | null>(null);
  const total = result?.reduce((t, r) => t + r.value, 0) ?? 0;
  const max = PLATFORMS.reduce((t, p) => t + p.max, 0);
  const locked = !s.isOwner;

  const calc = () => {
    const filled = PLATFORMS.filter((p) => handles[p.id]?.trim());
    if (!filled.length) return s.notify("Nhập ít nhất 1 handle (hoặc bấm Điền mẫu)");
    setLoading(true); setResult(null);
    setTimeout(() => {
      setResult(filled.map((p) => { const stats = s.connects[p.id]?.stats ?? mockStats(p.id, handles[p.id]!); return { id: p.id, stats, value: platformValue(p.id, stats) }; }));
      setLoading(false);
    }, 3000);
  };

  return (
    <div className="mx-auto max-w-[760px] px-3 md:px-6 py-5">
      <div className="rounded-[24px] bg-gradient-to-br from-zinc-900 to-zinc-800 border border-white/10 p-5">
        <div className="flex items-center gap-2 text-[#FF6B00]"><Calculator className="w-5 h-5" /><span className="text-[12px] font-black tracking-wide">VALUE CALCULATOR • TỐI ĐA ${max}</span></div>
        <PageSlogan page="value" className="mt-2 text-[22px] md:text-[28px] leading-tight" />
        <div className="mt-5 grid gap-2.5">
          {PLATFORMS.map((p) => (
            <label key={p.id} className="flex items-center gap-2">
              <span className={`w-10 h-10 rounded-full ${p.color} grid place-items-center text-[13px] font-black shrink-0`}>{p.name[0]}</span>
              <span className="w-[86px] text-[13px] font-bold shrink-0">{p.name}</span>
              <input value={handles[p.id] ?? ""} onChange={(e) => setHandles((h) => ({ ...h, [p.id]: e.target.value }))} placeholder="@handle" className="flex-1 min-w-0 h-10 rounded-full bg-black/40 border border-white/10 px-4 outline-none focus:border-[#FF6B00] text-[13px]" />
              <span className="hidden md:block w-[52px] text-right text-[11px] text-white/40">≤ ${p.max}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setHandles(Object.fromEntries(PLATFORMS.map((p) => [p.id, "@9mua.demo"])))} className="h-12 px-4 rounded-full bg-white/10 text-[13px] font-bold">Điền mẫu</button>
          <button onClick={calc} disabled={loading} className="flex-1 h-12 rounded-full bg-[#FF6B00] font-black text-[15px] shadow-[0_0_20px_rgba(255,107,0,0.4)] disabled:opacity-60">{loading ? "ĐANG TÍNH..." : "TÍNH GIÁ TRỊ"}</button>
        </div>
        <Link href="/connect" className="mt-2 block text-center text-[12px] text-white/50 underline">Kết nối tài khoản thật tại Social Connect</Link>
      </div>

      {loading && (
        <div className="mt-5 rounded-[24px] bg-white/5 border border-white/10 p-8 text-center">
          <div className="mx-auto w-14 h-14 rounded-full border-4 border-white/10 border-t-[#FF6B00] animate-spin" />
          <p className="mt-3 text-[13px] text-white/70">AI đang quét 6 nền tảng...</p>
        </div>
      )}

      {result && (
        <div className="mt-5 rounded-[24px] bg-white text-black p-5">
          <p className="text-[12px] font-bold text-zinc-500">TÀI KHOẢN CỦA BẠN ĐÁNG GIÁ</p>
          <div className="relative">
            <p className={`display text-[56px] font-black text-[#FF6B00] leading-none mt-1 ${locked ? "blur-md select-none" : ""}`}>${total.toFixed(0)}</p>
            {locked && <span className="absolute inset-0 flex items-center gap-2 text-[14px] font-black"><Lock className="w-5 h-5" /> Đang ẩn số $</span>}
          </div>
          <div className="mt-4 space-y-2">
            {result.map((r) => {
              const p = PLATFORMS.find((x) => x.id === r.id)!;
              return (
                <div key={r.id} className="rounded-[12px] bg-zinc-50 p-3">
                  <div className="flex justify-between text-[13px] font-bold"><span>{p.name}</span><span className={`text-[#FF6B00] ${locked ? "blur-sm" : ""}`}>${r.value.toFixed(0)} / ${p.max}</span></div>
                  <div className="mt-1.5 h-2 rounded-full bg-zinc-200 overflow-hidden"><div className="h-full bg-[#FF6B00]" style={{ width: `${(r.value / p.max) * 100}%` }} /></div>
                  <p className="mt-1 text-[11px] text-zinc-500">{p.fields.map(([k, l]) => `${l}: ${(r.stats[k] ?? 0).toLocaleString("vi-VN")}`).join(" • ")} • {p.api}</p>
                </div>
              );
            })}
          </div>
          {locked ? (
            <button onClick={() => s.setModal({ kind: "buy" })} className="mt-4 w-full h-12 rounded-full bg-[#FF6B00] text-white font-black flex items-center justify-center gap-2"><Lock className="w-4 h-4" /> Mua Kiot $1 để mở khóa định giá $951</button>
          ) : (
            <button onClick={() => s.notify("🚀 Đã mở Kiot bán hàng - biến giá trị thành tiền thật")} className="mt-4 w-full h-12 rounded-full bg-[#FF6B00] text-white font-black flex items-center justify-center gap-2"><Sparkles className="w-4 h-4" /> Mở Kiot để biến ${total.toFixed(0)} thành tiền thật</button>
          )}
        </div>
      )}

      <div className="mt-5 rounded-[20px] bg-white/5 border border-white/10 p-4 text-[12px] text-white/70">
        <p className="font-black text-white">Điểm của bạn: <span className="text-[#FF6B00]">{s.points.toFixed(1)}</span> • Voucher: {s.vouchers}</p>
        <p className="mt-1">Mỗi follow +1 điểm • Mỗi tim +0.5 điểm • Đủ 100 tim tặng voucher $1 mua Kiot</p>
      </div>
    </div>
  );
}
