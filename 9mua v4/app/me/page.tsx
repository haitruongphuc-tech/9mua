"use client";
// [PAGE-ME] Tôi - Hồ sơ người dùng, Free vs Kiot Owner, lối tắt tới các trang
import Link from "next/link";
import { Bookmark, Bot, Calculator, ChevronRight, Crown, FileText, Gauge, LogOut, Share2, ShoppingBag, Store, Wallet } from "lucide-react";
import { useStore } from "@/lib/store";
import { FREE_DAILY_LIMIT, KIOTS, fmtVND } from "@/lib/data";
import LogoV4 from "@/components/LogoV4";

export default function Me() {
  const s = useStore();
  if (!s.user) {
    return (
      <div className="mx-auto max-w-[420px] px-4 py-16 text-center">
        <div className="flex justify-center"><LogoV4 size={72} /></div>
        <p className="mt-5 display font-black text-[22px]">Chưa mua Kiot vẫn dùng được</p>
        <p className="mt-1 text-[13px] text-white/60">Mở tài khoản 9MUA.com miễn phí - dùng như TikTok</p>
        <button onClick={() => s.setModal({ kind: "signup" })} className="mt-5 w-full h-12 rounded-full bg-[#FF6B00] font-black">MỞ TÀI KHOẢN MIỄN PHÍ</button>
      </div>
    );
  }
  const role = s.user.role;
  const following = Object.values(s.followed).filter(Boolean).length;
  const saved = KIOTS.filter((k) => s.saved[k.id]);
  const usedToday = s.daily.date === new Date().toISOString().slice(0, 10) ? s.daily.n : 0;
  const links = [
    { href: "/cart", label: "Giỏ hàng", sub: `${s.cart.length} món • ${s.orders.length} đơn`, Icon: ShoppingBag },
    { href: "/wallet", label: "Ví 9MUA", sub: fmtVND(s.wallet.balance), Icon: Wallet },
    { href: "/value", label: "Value Calculator", sub: "Tài khoản đáng giá bao nhiêu?", Icon: Calculator },
    { href: "/connect", label: "Social Connect", sub: `${Object.keys(s.connects).length}/6 nền tảng`, Icon: Share2 },
    { href: "/ai", label: "AI Studio", sub: "ArtCraft 5 kỹ thuật + 9 AI", Icon: Bot },
    { href: "/legal", label: "Pháp lý", sub: "9MUA Co., LTD", Icon: FileText },
    { href: "/admin", label: "Trang CEO /admin", sub: "Demo quản trị", Icon: Gauge },
  ];

  return (
    <div className="mx-auto max-w-[760px] px-3 md:px-6 py-6">
      <div className="text-center">
        <span className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-[#FF6B00] to-red-500 grid place-items-center text-[36px] font-black">{s.user.name[0]?.toUpperCase()}</span>
        <h1 className="mt-3 display text-[22px] font-black">{s.user.name}</h1>
        <p className="text-[12px] text-white/50">{s.user.email} • qua {s.user.provider}</p>
        <span className={`mt-2 inline-flex items-center gap-1 h-7 px-3 rounded-full text-[12px] font-black ${role === "free" ? "bg-white/10" : "bg-[#FF6B00]"}`}>{role !== "free" && <Crown className="w-3.5 h-3.5" />}{role === "free" ? "FREE ACCOUNT" : role === "admin" ? "ADMIN / CEO" : "KIOT OWNER"}</span>
      </div>
      <div className="mt-5 grid grid-cols-4 gap-2 text-center">
        {[[following, "Following"], [Object.values(s.hearted).filter(Boolean).length, "Đã thả tim"], [s.points.toFixed(1), "Điểm"], [s.vouchers, "Voucher $1"]].map(([v, l]) => (
          <div key={l} className="rounded-[14px] bg-white/5 border border-white/10 py-3"><p className="font-black text-[18px]">{v}</p><p className="text-[10px] text-white/50">{l}</p></div>
        ))}
      </div>
      {role === "free" ? (
        <div className="mt-4 rounded-[18px] bg-gradient-to-r from-[#FF6B00] to-orange-500 p-4">
          <p className="font-black">Đang dùng Free • {usedToday}/{FREE_DAILY_LIMIT} tim/follow hôm nay</p>
          <p className="text-[12px] opacity-90">Mua Kiot $1: tạo Kiot, phát Live, Value $951, rút tiền, không giới hạn</p>
          <button onClick={() => s.setModal({ kind: "buy" })} className="mt-3 h-10 px-5 rounded-full bg-white text-black font-black text-[13px]">MUA KIOT $1</button>
        </div>
      ) : (
        <div className="mt-4 rounded-[18px] bg-white/5 border border-[#FF6B00]/40 p-4 flex items-center gap-3">
          <Store className="w-8 h-8 text-[#FF6B00]" />
          <div className="flex-1"><p className="font-black">Kiot của bạn</p><p className="text-[12px] text-white/60">{s.myProducts.length} sản phẩm AI • {s.orders.length} đơn hàng</p></div>
          <Link href="/ai" className="h-9 px-4 rounded-full bg-[#FF6B00] text-[12px] font-black grid place-items-center">Thêm SP</Link>
        </div>
      )}
      <div className="mt-4 rounded-[18px] bg-white/5 border border-white/10 divide-y divide-white/10">
        {links.map(({ href, label, sub, Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5">
            <Icon className="w-5 h-5 text-[#FF6B00]" />
            <div className="flex-1"><p className="text-[14px] font-bold">{label}</p><p className="text-[11px] text-white/50">{sub}</p></div>
            <ChevronRight className="w-4 h-4 text-white/30" />
          </Link>
        ))}
      </div>
      {saved.length > 0 && (
        <div className="mt-4">
          <p className="text-[13px] font-black flex items-center gap-1"><Bookmark className="w-4 h-4" /> Bộ sưu tập</p>
          <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
            {saved.map((k) => <Link key={k.id} href={`/${k.slug}`} className={`shrink-0 w-[110px] h-[140px] rounded-[14px] bg-gradient-to-br ${k.color} p-2 flex items-end text-[12px] font-bold`}>{k.name}</Link>)}
          </div>
        </div>
      )}
      <div className="mt-6 flex gap-2">
        <button onClick={s.logout} className="flex-1 h-11 rounded-full bg-white/10 text-[13px] font-bold flex items-center justify-center gap-1"><LogOut className="w-4 h-4" /> Đăng xuất</button>
        <button onClick={s.resetDemo} className="flex-1 h-11 rounded-full bg-white/10 text-[13px] font-bold">Xóa dữ liệu demo</button>
      </div>
    </div>
  );
}
