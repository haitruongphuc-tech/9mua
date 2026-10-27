"use client";
// [PAGE-06] Ví & Thanh toán - Số dư, 1 ví 6 nguồn, lịch sử, rút về MBBank / MoMo / VNPay
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Lock, ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { BANK, CEO_APPROVAL_VND, fmtVND } from "@/lib/data";
import { PageSlogan, Sheet } from "@/components/ui";

const SOURCES = ["TikTok", "Facebook", "Instagram", "YouTube", "Shopee", "Zalo"];

export default function Wallet() {
  const s = useStore();
  const [sheet, setSheet] = useState<"in" | "out" | null>(null);
  const [amount, setAmount] = useState("");
  const [to, setTo] = useState(`MBBank ${BANK.account}`);
  const bySource = SOURCES.map((src) => ({ src, total: s.wallet.history.filter((t) => t.type === "in" && t.source === src).reduce((a, t) => a + t.amount, 0) }));
  const statusText = { done: "Hoàn tất", pending_ceo: "Chờ CEO duyệt", rejected: "Bị từ chối (đã hoàn tiền)" };

  const submit = () => {
    const n = Number(amount.replace(/\D/g, ""));
    if (!n) return s.notify("Nhập số tiền");
    if (sheet === "in") { s.topUp(n, to); s.notify(`Đã nạp ${fmtVND(n)} (demo)`); } else s.withdraw(n, to);
    setSheet(null); setAmount("");
  };

  return (
    <div className="mx-auto max-w-[760px] px-3 md:px-6 py-5">
      <div className="rounded-[24px] bg-gradient-to-br from-[#FF6B00] to-orange-500 p-5 shadow-[0_10px_40px_rgba(255,107,0,0.3)]">
        <PageSlogan page="wallet" className="text-[14px] opacity-90" />
        <p className="mt-3 text-[12px] opacity-80">Số dư ví 9MUA</p>
        <p className="display text-[40px] font-black leading-none">{fmtVND(s.wallet.balance)}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => { setTo("MBBank"); setSheet("in"); }} className="h-11 rounded-full bg-white text-black font-black text-[13px] flex items-center justify-center gap-1"><ArrowDownLeft className="w-4 h-4" /> Nạp tiền</button>
          <button onClick={() => (s.isOwner ? (setTo(`MBBank ${BANK.account}`), setSheet("out")) : s.setModal({ kind: "buy" }))} className="h-11 rounded-full bg-black/80 font-black text-[13px] flex items-center justify-center gap-1">{s.isOwner ? <ArrowUpRight className="w-4 h-4" /> : <Lock className="w-4 h-4" />} Rút tiền</button>
        </div>
        {!s.isOwner && <p className="mt-2 text-[11px] opacity-90">Tài khoản Free không rút được - Mua Kiot $1 để mở khóa</p>}
      </div>

      <div className="mt-5 rounded-[20px] bg-white/5 border border-white/10 p-4">
        <p className="font-black text-[13px]">1 VÍ - 6 NGUỒN</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {bySource.map((b) => (
            <div key={b.src} className="rounded-[12px] bg-black/40 p-2.5"><p className="text-[11px] text-white/50">{b.src}</p><p className="text-[13px] font-black text-[#FF6B00]">{fmtVND(b.total)}</p></div>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-[20px] bg-white/5 border border-white/10 p-4">
        <p className="font-black text-[13px]">LỊCH SỬ GIAO DỊCH</p>
        {s.wallet.history.length === 0 && <p className="mt-3 text-[12px] text-white/50">Chưa có giao dịch</p>}
        <div className="mt-2 space-y-2">
          {s.wallet.history.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-[12px] bg-black/40 px-3 py-2">
              <span className={`w-8 h-8 rounded-full grid place-items-center ${t.type === "in" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>{t.type === "in" ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}</span>
              <div className="min-w-0 flex-1"><p className="text-[12px] font-bold truncate">{t.note}</p><p className="text-[11px] text-white/50">{t.source} • {new Date(t.at).toLocaleString("vi-VN")}</p></div>
              <div className="text-right"><p className={`text-[13px] font-black ${t.type === "in" ? "text-emerald-400" : ""}`}>{t.type === "in" ? "+" : "-"}{fmtVND(t.amount)}</p><p className={`text-[10px] ${t.status === "pending_ceo" ? "text-yellow-400" : "text-white/40"}`}>{statusText[t.status]}</p></div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-[11px] text-white/40 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> AI tự duyệt 99% • Rút trên $500 ({fmtVND(CEO_APPROVAL_VND)}) cần CEO Nguyễn Hải duyệt</p>

      <Sheet open={!!sheet} onClose={() => setSheet(null)} title={sheet === "in" ? "Nạp tiền vào ví" : "Rút tiền"}>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="Số tiền (VNĐ)" className="w-full h-12 rounded-full border border-black/10 px-4 outline-none focus:border-[#FF6B00] text-[16px] font-bold" />
        <div className="mt-2 flex gap-2 flex-wrap">{[100000, 500000, 2000000, 15000000].map((n) => <button key={n} onClick={() => setAmount(String(n))} className="h-8 px-3 rounded-full bg-zinc-100 text-[12px] font-bold">{fmtVND(n)}</button>)}</div>
        <p className="mt-4 text-[12px] font-bold">{sheet === "in" ? "Nạp từ" : "Rút về"}</p>
        <div className="mt-2 grid gap-2">
          {[`MBBank ${BANK.account}`, "MoMo", "VNPay"].map((m) => <button key={m} onClick={() => setTo(m)} className={`h-10 rounded-[12px] border text-[13px] font-bold ${to === m ? "border-[#FF6B00] bg-[#FFF7ED] text-[#FF6B00]" : "border-black/10"}`}>{m}</button>)}
        </div>
        <button onClick={submit} className="mt-4 w-full h-12 rounded-full bg-[#FF6B00] text-white font-black">{sheet === "in" ? "NẠP TIỀN" : "RÚT TIỀN"}</button>
        <p className="mt-2 text-[10px] text-zinc-400 text-center">Bản demo - không chuyển tiền thật</p>
      </Sheet>
    </div>
  );
}
