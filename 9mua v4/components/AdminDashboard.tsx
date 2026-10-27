"use client";
// [PAGE-ADMIN] CEO 1% approval - Tổng quan, Users, Kiots, Value, AI cost $745, Slogan 10 trang, Legal
import Link from "next/link";
import { useState } from "react";
import { Check, CreditCard, Pin, RotateCcw, ShieldAlert, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { AI_FEATURES, KIOTS, PAGE_LABELS, PLATFORMS, PageId, fmtVND } from "@/lib/data";

const SECTIONS = [
  ["", "Tổng quan"], ["users", "Users"], ["kiots", "Kiots"], ["value", "Value $951"], ["ai-cost", "AI cost"], ["slogan", "Slogan"], ["legal", "Legal"],
] as const;

export default function AdminDashboard({ section = "" }: { section?: string }) {
  const s = useStore();
  const pending = s.wallet.history.filter((t) => t.status === "pending_ceo");
  const aiTotal = AI_FEATURES.filter((f) => s.aiEnabled[f.id]).reduce((t, f) => t + f.cost, 0);
  const [legal, setLegal] = useState(s.legal);

  return (
    <div className="mx-auto max-w-[1100px] px-3 md:px-6 py-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="display text-[24px] font-black">CEO ĐIỀU HÀNH • 99% AI + 1% CEO</h1>
          <p className="text-[12px] text-white/50">CEO Nguyễn Hải duyệt 1%: rút &gt; $500, ban Kiot, đổi slogan chính • Bản demo, chưa có đăng nhập admin</p>
        </div>
        {s.user && s.user.role !== "admin" && <button onClick={() => { s.becomeAdmin(); s.notify("Đã chuyển tài khoản sang Admin (demo)"); }} className="h-9 px-4 rounded-full bg-white/10 text-[12px] font-bold">Dùng tài khoản này làm Admin</button>}
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar">
        {SECTIONS.map(([id, label]) => (
          <Link key={id} href={`/admin${id ? `/${id}` : ""}`} className={`shrink-0 h-9 px-4 rounded-full text-[12px] font-bold grid place-items-center ${section === id ? "bg-[#FF6B00]" : "bg-white/10 hover:bg-white/15"}`}>{label}{id === "" && pending.length > 0 && <span className="ml-1 text-yellow-300">• {pending.length}</span>}</Link>
        ))}
      </div>

      <div className="mt-5">
        {section === "" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[["Users", (12480 + s.adminUsers.length).toLocaleString("vi-VN")], ["Kiot", KIOTS.length + 1240], ["GMV", fmtVND(2350000000 + s.orders.reduce((t, o) => t + o.total, 0))], ["Value total", "$951 × 1.2K"], ["AI cost", `$${aiTotal}/mo`]].map(([l, v]) => (
                <div key={l} className="rounded-[16px] bg-white/5 border border-white/10 p-4"><p className="text-[11px] text-white/50">{l}</p><p className="font-black text-[18px] truncate">{v}</p></div>
              ))}
            </div>
            <div className="mt-5 rounded-[18px] bg-white text-black p-4">
              <p className="font-black text-[14px] flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-[#FF6B00]" /> CẦN CEO DUYỆT (1%)</p>
              {pending.length === 0 && <p className="mt-2 text-[12px] text-zinc-500">Không có yêu cầu nào. Thử: vào Ví → Rút trên 13.000.000đ.</p>}
              {pending.map((t) => (
                <div key={t.id} className="mt-2 flex items-center gap-2 rounded-[12px] bg-[#FFF7ED] p-3">
                  <div className="flex-1 text-[13px]"><b>Rút {fmtVND(t.amount)}</b> → {t.source}<p className="text-[11px] text-zinc-500">{s.user?.name} • {new Date(t.at).toLocaleString("vi-VN")}</p></div>
                  <button onClick={() => { s.decideWithdraw(t.id, true); s.notify("Đã duyệt rút tiền"); }} className="h-9 px-3 rounded-full bg-emerald-500 text-white text-[12px] font-bold flex items-center gap-1"><Check className="w-4 h-4" /> Duyệt</button>
                  <button onClick={() => { s.decideWithdraw(t.id, false); s.notify("Đã từ chối - hoàn tiền về ví"); }} className="h-9 px-3 rounded-full bg-red-500 text-white text-[12px] font-bold flex items-center gap-1"><X className="w-4 h-4" /> Từ chối</button>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[12px] text-white/50">99% AI tự duyệt: follow, tim, comment, tạo Kiot $1</p>
          </>
        )}

        {section === "users" && (
          <div className="rounded-[18px] bg-white/5 border border-white/10 divide-y divide-white/10">
            {s.adminUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-3 flex-wrap">
                <div className="flex-1 min-w-[160px]"><p className="text-[14px] font-bold">{u.name}</p><p className="text-[11px] text-white/50">{u.email}</p></div>
                <span className={`h-7 px-2.5 rounded-full text-[11px] font-bold grid place-items-center ${u.role === "free" ? "bg-white/10" : "bg-[#FF6B00]"}`}>{u.role}</span>
                <span className={`text-[11px] ${u.status === "banned" ? "text-red-400" : u.status === "pending_owner" ? "text-yellow-300" : "text-emerald-400"}`}>{u.status === "pending_owner" ? "Chờ lên Kiot Owner" : u.status}</span>
                {u.role === "free" && u.status !== "banned" && <button onClick={() => { s.setAdminUser(u.id, { role: "kiot_owner", status: "active" }); s.notify(`Đã duyệt ${u.name} lên Kiot Owner`); }} className="h-8 px-3 rounded-full bg-emerald-500 text-[11px] font-bold">Duyệt Owner</button>}
                <button onClick={() => { s.setAdminUser(u.id, { status: u.status === "banned" ? "active" : "banned" }); s.notify(u.status === "banned" ? `Đã mở khóa ${u.name}` : `Đã ban ${u.name}`); }} className={`h-8 px-3 rounded-full text-[11px] font-bold ${u.status === "banned" ? "bg-white/10" : "bg-red-500"}`}>{u.status === "banned" ? "Bỏ ban" : "Ban user ảo"}</button>
              </div>
            ))}
          </div>
        )}

        {section === "kiots" && (
          <div className="grid md:grid-cols-2 gap-3">
            {KIOTS.map((k) => {
              const banned = !!s.bannedKiots[k.id];
              return (
                <div key={k.id} className={`rounded-[16px] border p-3 flex gap-3 items-center ${banned ? "border-red-500/50 bg-red-500/10" : "border-white/10 bg-white/5"}`}>
                  <span className={`w-12 h-12 rounded-[12px] bg-gradient-to-br ${k.color} shrink-0`} />
                  <div className="flex-1 min-w-0"><p className="text-[13px] font-bold truncate">{k.name}</p><p className="text-[11px] text-white/50">{k.location} {s.pinnedKiot === k.id && "• 📌 Đang ghim top"}</p></div>
                  <button onClick={() => { s.pinKiot(s.pinnedKiot === k.id ? null : k.id); s.notify(s.pinnedKiot === k.id ? "Đã bỏ ghim" : `Đã ghim ${k.name} lên top`); }} aria-label="Ghim" className={`w-9 h-9 rounded-full grid place-items-center ${s.pinnedKiot === k.id ? "bg-[#FF6B00]" : "bg-white/10"}`}><Pin className="w-4 h-4" /></button>
                  <button onClick={() => { s.setKiotBanned(k.id, !banned); s.notify(banned ? `Đã mở lại ${k.name}` : `CEO đã ban ${k.name}`); }} className={`h-9 px-3 rounded-full text-[11px] font-bold ${banned ? "bg-white/10" : "bg-red-500"}`}>{banned ? "Mở lại" : "Ban"}</button>
                </div>
              );
            })}
          </div>
        )}

        {section === "value" && (
          <div className="rounded-[18px] bg-white text-black p-4 overflow-x-auto">
            <table className="w-full text-[13px] min-w-[520px]">
              <thead><tr className="text-left text-zinc-500 text-[11px]"><th className="py-2">Nền tảng</th><th>Giá trị max</th><th>Đã kết nối</th><th>Trung bình / user</th><th>API</th></tr></thead>
              <tbody>
                {PLATFORMS.map((p, i) => (
                  <tr key={p.id} className="border-t"><td className="py-2 font-bold">{p.name}</td><td>${p.max}</td><td>{(4200 - i * 530).toLocaleString("vi-VN")}</td><td className="text-[#FF6B00] font-bold">${Math.round(p.max * 0.62)}</td><td className="text-zinc-500">{p.api}</td></tr>
                ))}
                <tr className="border-t font-black"><td className="py-2">TỔNG</td><td>${PLATFORMS.reduce((t, p) => t + p.max, 0)}</td><td /><td className="text-[#FF6B00]">${PLATFORMS.reduce((t, p) => t + Math.round(p.max * 0.62), 0)}</td><td /></tr>
              </tbody>
            </table>
          </div>
        )}

        {section === "ai-cost" && (
          <div className="rounded-[18px] bg-white/5 border border-white/10 p-4">
            <div className="flex items-center justify-between"><p className="font-black">Mua lẻ từng tính năng AI</p><p className="font-black text-[22px] text-[#FF6B00]">${aiTotal}<span className="text-[12px] text-white/50">/mo</span></p></div>
            <div className="mt-3 space-y-2">
              {AI_FEATURES.map((f) => (
                <div key={f.id} className="flex items-center gap-3 rounded-[12px] bg-black/40 p-3">
                  <div className="flex-1 min-w-0"><p className="text-[13px] font-bold">{f.name}</p><p className="text-[11px] text-white/50">{f.provider} • {f.desc}</p></div>
                  <span className="text-[13px] font-black w-[64px] text-right">${f.cost}</span>
                  <button onClick={() => s.toggleAi(f.id)} aria-label={`Bật tắt ${f.name}`} className={`w-12 h-7 rounded-full p-0.5 transition ${s.aiEnabled[f.id] ? "bg-[#FF6B00]" : "bg-white/20"}`}><span className={`block w-6 h-6 rounded-full bg-white transition ${s.aiEnabled[f.id] ? "translate-x-5" : ""}`} /></button>
                </div>
              ))}
            </div>
            <button onClick={() => s.notify(`💳 Mở Stripe Checkout $${aiTotal}/mo (demo)`)} className="mt-4 w-full h-12 rounded-full bg-[#FF6B00] font-black flex items-center justify-center gap-2"><CreditCard className="w-5 h-5" /> MUA NGAY QUA STRIPE • ${aiTotal}/mo</button>
          </div>
        )}

        {section === "slogan" && (
          <div className="rounded-[18px] bg-white/5 border border-white/10 p-4">
            <div className="flex items-center justify-between"><p className="font-black">Slogan 10 trang • đổi là cập nhật toàn site</p><button onClick={() => { s.resetSlogans(); s.notify("Đã khôi phục slogan V4"); }} className="h-8 px-3 rounded-full bg-white/10 text-[11px] font-bold flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" /> Khôi phục</button></div>
            <div className="mt-3 space-y-2">
              {(Object.keys(PAGE_LABELS) as PageId[]).map((p) => (
                <label key={p} className="block">
                  <span className="text-[11px] text-white/50">{PAGE_LABELS[p]}</span>
                  <input value={s.slogans[p]} onChange={(e) => s.setSlogan(p, e.target.value)} className="mt-1 w-full h-10 rounded-[10px] bg-black/40 border border-white/10 px-3 outline-none focus:border-[#FF6B00] text-[13px]" />
                </label>
              ))}
            </div>
          </div>
        )}

        {section === "legal" && (
          <div className="rounded-[18px] bg-white/5 border border-white/10 p-4 space-y-3">
            <label className="block"><span className="text-[11px] text-white/50">Trụ sở chính (Showroom) - Lô 26 Hamubay</span><textarea value={legal.hq} onChange={(e) => setLegal({ ...legal, hq: e.target.value })} rows={2} className="mt-1 w-full rounded-[10px] bg-black/40 border border-white/10 p-3 outline-none focus:border-[#FF6B00] text-[13px]" /></label>
            <label className="block"><span className="text-[11px] text-white/50">Văn phòng kỹ sư - 115 Nguyễn Hậu</span><textarea value={legal.office} onChange={(e) => setLegal({ ...legal, office: e.target.value })} rows={2} className="mt-1 w-full rounded-[10px] bg-black/40 border border-white/10 p-3 outline-none focus:border-[#FF6B00] text-[13px]" /></label>
            <div className="flex gap-2">
              <button onClick={() => { s.setLegal(legal); s.notify("Đã lưu địa chỉ - trang /legal đã cập nhật"); }} className="h-11 px-6 rounded-full bg-[#FF6B00] font-black text-[13px]">Lưu</button>
              <Link href="/legal" className="h-11 px-6 rounded-full bg-white/10 font-bold text-[13px] grid place-items-center">Xem /legal</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
