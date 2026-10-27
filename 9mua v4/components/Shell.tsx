"use client";
// [LAYOUT-SHELL] Header (Logo + slogan + Search) + Bottom Nav 5 nút như TikTok + popup dùng chung
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Compass, Copy, Facebook, Globe, House, Instagram, Link2, Mail, MapPin, Plus, Search, Send, ShoppingBag, User, Volume2, Wallet, Zap,
} from "lucide-react";
import LogoV4 from "./LogoV4";
import { QR, Sheet, useSlogan } from "./ui";
import { useStore } from "@/lib/store";
import { BANK, KIOT_PRICE_VND, LANGS, PageId, fmtVND, kiotById } from "@/lib/data";
import { vietQR } from "@/lib/vietqr";

function pageOf(path: string): PageId {
  const seg = path.split("/")[1] || "";
  const map: Record<string, PageId> = { "": "home", explore: "explore", live: "live", value: "value", cart: "cart", wallet: "wallet", connect: "connect", ai: "ai", legal: "legal", me: "home", admin: "home" };
  return map[seg] ?? "profile";
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const store = useStore();
  const page = pageOf(path);
  const slogan = useSlogan(page);
  const [q, setQ] = useState("");
  const [langOpen, setLangOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const cartCount = store.cart.reduce((t, c) => t + c.qty, 0);

  // Popup mở tài khoản miễn phí lần đầu vào site
  useEffect(() => {
    if (!store.hydrated || store.user || store.signupDismissed || path.startsWith("/admin")) return;
    const t = setTimeout(() => store.setModal({ kind: "signup" }), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.hydrated]);

  const speak = () => {
    const synth = window.speechSynthesis;
    if (!synth) return store.notify("Trình duyệt không hỗ trợ đọc tự động");
    if (speaking) { synth.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(slogan);
    u.lang = LANGS.find((l) => l.id === store.lang)?.tts ?? "vi-VN";
    u.onend = u.onerror = () => setSpeaking(false);
    synth.cancel(); synth.speak(u); setSpeaking(true);
  };

  const nav = [
    { href: "/", label: "Home", Icon: House },
    { href: "/explore", label: "Explore", Icon: Compass },
    { href: "/live", label: "Live", Icon: Plus, center: true },
    { href: "/value", label: "Value", Icon: Wallet },
    { href: "/me", label: "Tôi", Icon: User },
  ];
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#0A0A0A]">
      <header className="sticky top-0 z-50 bg-[#0A0A0A]/90 backdrop-blur-xl border-b border-white/10">
        <div className="mx-auto max-w-[1200px] h-[64px] px-3 md:px-6 flex items-center gap-3">
          <Link href="/" aria-label="Về Home 9MUA" className="rounded-full" style={{ animation: "glowPulse 2.8s infinite" }}><LogoV4 /></Link>
          <p className="min-w-0 flex-1 text-[12px] italic text-[#94A3B8] truncate">{slogan}</p>
          <form onSubmit={(e) => { e.preventDefault(); router.push(`/explore?q=${encodeURIComponent(q)}`); }} className="hidden md:flex items-center gap-2 h-10 w-[300px] rounded-full bg-white/10 border border-white/10 px-4">
            <Search className="w-4 h-4 text-white/50" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm Kiot, sản phẩm, #hashtag" className="flex-1 bg-transparent outline-none text-[13px] text-white placeholder:text-white/40" />
          </form>
          <Link href="/explore" aria-label="Tìm kiếm" className="md:hidden w-10 h-10 rounded-full bg-white/10 grid place-items-center"><Search className="w-4 h-4" /></Link>
          <div className="relative">
            <button onClick={() => setLangOpen((o) => !o)} aria-label="Ngôn ngữ" className="h-10 px-3 rounded-full bg-white/10 flex items-center gap-1 text-[12px] font-bold"><Globe className="w-4 h-4" />{store.lang}</button>
            {langOpen && (
              <div className="absolute right-0 top-12 w-[200px] rounded-[16px] bg-white text-black p-2 shadow-2xl z-50">
                {LANGS.map((l) => (
                  <button key={l.id} onClick={() => { store.setLang(l.id); setLangOpen(false); }} className={`w-full text-left px-3 py-2 rounded-[10px] text-[13px] ${store.lang === l.id ? "bg-[#FF6B00] text-white font-bold" : "hover:bg-[#FFF7ED]"}`}>{l.label}</button>
                ))}
                <button onClick={() => { speak(); setLangOpen(false); }} className="mt-1 w-full h-9 rounded-[10px] bg-black text-white text-[12px] font-bold flex items-center justify-center gap-1"><Volume2 className="w-4 h-4" /> {speaking ? "Dừng đọc" : "TTS Auto-Read"}</button>
              </div>
            )}
          </div>
          <Link href="/cart" aria-label="Giỏ hàng" className="relative w-10 h-10 rounded-full bg-white/10 grid place-items-center">
            <ShoppingBag className="w-4 h-4" />
            {cartCount > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[#FF6B00] text-[10px] font-black grid place-items-center">{cartCount}</span>}
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full">{children}</main>

      <nav className="sticky bottom-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-white/10">
        <div className="mx-auto max-w-[560px] h-[64px] px-2 flex items-center justify-around">
          {nav.map(({ href, label, Icon, center }) => (
            center ? (
              <Link key={href} href={href} aria-label="Live" className="flex flex-col items-center">
                <span className={`w-14 h-9 rounded-[12px] grid place-items-center text-white ${isActive(href) ? "bg-[#FF6B00] shadow-[0_0_16px_#FF6B00]" : "bg-gradient-to-r from-cyan-400 via-white to-[#FF6B00] p-[2px]"}`}>
                  <span className={`w-full h-full rounded-[10px] grid place-items-center ${isActive(href) ? "" : "bg-[#FF6B00]"}`}><Icon className="w-5 h-5" /></span>
                </span>
                <span className={`text-[10px] font-bold mt-0.5 ${isActive(href) ? "text-[#FF6B00]" : "text-white/60"}`}>{label}</span>
              </Link>
            ) : (
              <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 w-14 ${isActive(href) ? "text-[#FF6B00]" : "text-white/60 hover:text-white"}`}>
                <Icon className="w-6 h-6" />
                <span className="text-[10px] font-bold">{label}</span>
              </Link>
            )
          ))}
        </div>
      </nav>

      {store.toast && (
        <div className="fixed bottom-[80px] left-1/2 -translate-x-1/2 z-[90] pointer-events-none">
          <div className="px-4 py-3 rounded-full bg-white text-black font-bold text-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.4)] flex items-center gap-2 animate-[scaleIn_0.25s_ease]">
            <span className="w-6 h-6 rounded-full bg-[#FF6B00] text-white grid place-items-center shrink-0"><Zap className="w-3 h-3" /></span>
            <span className="max-w-[300px] truncate">{store.toast}</span>
          </div>
        </div>
      )}

      <SignupSheet />
      <BuyKiotSheet />
      <CommentSheet />
      <ShareSheet />
      <ContactSheet />
    </div>
  );
}

function SignupSheet() {
  const s = useStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const open = s.modal?.kind === "signup";
  return (
    <Sheet open={open} onClose={s.dismissSignup} title="Mở tài khoản miễn phí - Dùng như TikTok - Không cần mua Kiot">
      <div className="flex justify-center mb-4"><LogoV4 size={64} /></div>
      <div className="grid gap-2">
        <button onClick={() => s.signup("Bạn Google", "ban.google@gmail.com", "google")} className="h-11 rounded-full border border-black/10 font-bold text-[13px] hover:bg-zinc-50">Tiếp tục với Google</button>
        <button onClick={() => s.signup("Bạn TikTok", "ban.tiktok@tiktok.com", "tiktok")} className="h-11 rounded-full bg-black text-white font-bold text-[13px]">Tiếp tục với TikTok</button>
      </div>
      <div className="my-4 flex items-center gap-3 text-[11px] text-zinc-400"><span className="flex-1 h-px bg-zinc-200" />hoặc Email<span className="flex-1 h-px bg-zinc-200" /></div>
      <form onSubmit={(e) => { e.preventDefault(); s.signup(name, email || "ban@9mua.com", "email"); }} className="grid gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên của bạn" className="h-11 rounded-full border border-black/10 px-4 outline-none focus:border-[#FF6B00] text-[14px]" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" className="h-11 rounded-full border border-black/10 px-4 outline-none focus:border-[#FF6B00] text-[14px]" />
        <button className="h-12 rounded-full bg-[#FF6B00] text-white font-black">MỞ TÀI KHOẢN MIỄN PHÍ</button>
      </form>
      <ul className="mt-4 text-[11px] text-zinc-500 space-y-1">
        <li>• Lướt feed, thả tim, follow, comment, share đầy đủ như TikTok</li>
        <li>• Free: 50 tim/follow mỗi ngày • Đủ 100 tim tặng voucher $1 mua Kiot</li>
      </ul>
      <button onClick={s.dismissSignup} className="mt-3 w-full text-[12px] text-zinc-500 underline">Để sau, xem trước đã</button>
    </Sheet>
  );
}

function BuyKiotSheet() {
  const s = useStore();
  const open = s.modal?.kind === "buy";
  const kiotId = s.modal?.kind === "buy" ? s.modal.kiotId : undefined;
  const [method, setMethod] = useState("mbbank");
  const note = `MUA KIOT ${s.user?.email?.split("@")[0] ?? ""}`;
  const methods = [
    { id: "mbbank", label: "MBBank (QR)" }, { id: "momo", label: "MoMo" }, { id: "vnpay", label: "VNPay" }, { id: "stripe", label: "Thẻ quốc tế (Stripe)" }, { id: "wallet", label: `Ví 9MUA (${fmtVND(s.wallet.balance)})` },
  ];
  return (
    <Sheet open={open} onClose={() => s.setModal(null)} title={`MUA KIOT $1 ${kiotId ? `• ${kiotById(kiotId)?.name}` : ""}`}>
      <div className="rounded-[16px] bg-[#0A0A0A] text-white p-4">
        <p className="text-[12px] text-white/60">Kiot $1 mở khóa</p>
        <ul className="mt-1 text-[12px] space-y-0.5">
          <li>✓ Tạo Kiot, phát Live & bán hàng</li><li>✓ Value Calculator đầy đủ $951</li><li>✓ Tim/follow không giới hạn, ghim comment</li><li>✓ Rút tiền qua ví 9MUA</li>
        </ul>
        <p className="mt-2 font-black text-[22px] text-[#FF6B00]">$1 <span className="text-[13px] text-white/60 font-bold">≈ {fmtVND(KIOT_PRICE_VND)}</span></p>
      </div>
      {s.vouchers > 0 && (
        <button onClick={() => s.buyKiot(kiotId, "voucher", true)} className="mt-3 w-full h-11 rounded-full bg-emerald-500 text-white font-black text-[13px]">DÙNG VOUCHER $1 ({s.vouchers}) - MIỄN PHÍ</button>
      )}
      <p className="mt-4 text-[12px] font-bold">Chọn cách thanh toán</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {methods.map((m) => (
          <button key={m.id} onClick={() => setMethod(m.id)} className={`h-10 rounded-[12px] border text-[12px] font-bold ${method === m.id ? "border-[#FF6B00] bg-[#FFF7ED] text-[#FF6B00]" : "border-black/10"}`}>{m.label}</button>
        ))}
      </div>
      {method === "mbbank" && (
        <div className="mt-3 rounded-[14px] bg-[#FFF7ED] p-3 flex gap-3 items-center">
          <QR value={vietQR({ bin: BANK.bin, account: BANK.account, amount: KIOT_PRICE_VND, note })} size={110} />
          <div className="text-[12px] min-w-0">
            <p className="font-black text-[15px]">{BANK.account}</p>
            <p>{BANK.name} • {BANK.holderDisplay}</p>
            <p className="text-zinc-500">{BANK.branch}</p>
            <p className="mt-1">Nội dung: <b>{note}</b></p>
          </div>
        </div>
      )}
      {!s.user ? (
        <button onClick={() => s.setModal({ kind: "signup" })} className="mt-4 w-full h-12 rounded-full bg-[#FF6B00] text-white font-black">MỞ TÀI KHOẢN TRƯỚC ĐỂ MUA</button>
      ) : (
        <button onClick={() => s.buyKiot(kiotId, method, false)} className="mt-4 w-full h-12 rounded-full bg-[#FF6B00] text-white font-black shadow-[0_0_20px_rgba(255,107,0,0.4)]">{method === "mbbank" ? "TÔI ĐÃ CHUYỂN KHOẢN" : `THANH TOÁN $1 QUA ${methods.find((m) => m.id === method)?.label.split(" (")[0].toUpperCase()}`}</button>
      )}
      <p className="mt-2 text-[10px] text-zinc-400 text-center">Bản demo - chưa trừ tiền thật</p>
    </Sheet>
  );
}

function CommentSheet() {
  const s = useStore();
  const kiotId = s.modal?.kind === "comments" ? s.modal.kiotId : 0;
  const kiot = kiotById(kiotId);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | undefined>();
  const list = s.comments.filter((c) => c.kiotId === kiotId);
  const roots = [...list.filter((c) => !c.parentId)].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  const send = () => { if (!text.trim()) return; s.addComment(kiotId, text.trim(), replyTo); setText(""); setReplyTo(undefined); };
  return (
    <Sheet open={!!kiot} onClose={() => { s.setModal(null); setReplyTo(undefined); }} title={`${list.length} bình luận • ${kiot?.name ?? ""}`}>
      <div className="space-y-3 max-h-[45dvh] overflow-y-auto pr-1">
        {roots.map((c) => (
          <div key={c.id}>
            <div className={`rounded-[14px] px-3 py-2 ${c.pinned ? "bg-[#FFF7ED] border border-[#FF6B00]/30" : "bg-zinc-50"}`}>
              <p className="text-[12px] font-bold">{c.author}{c.author === kiot?.owner && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#FF6B00] text-white text-[9px]">CHỦ KIOT</span>}{c.pinned && <span className="ml-1 text-[10px] text-[#FF6B00]">📌 Đã ghim</span>}</p>
              <p className="text-[13px]">{c.text}</p>
              <div className="mt-1 flex gap-3 text-[11px] text-zinc-500">
                <button onClick={() => setReplyTo(c.id)}>Trả lời</button>
                {s.isOwner && <button onClick={() => s.togglePin(c.id)}>{c.pinned ? "Bỏ ghim" : "Ghim"}</button>}
              </div>
            </div>
            {list.filter((r) => r.parentId === c.id).map((r) => (
              <div key={r.id} className="ml-6 mt-1 rounded-[12px] bg-zinc-50 px-3 py-1.5">
                <p className="text-[11px] font-bold">{r.author}</p><p className="text-[12px]">{r.text}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
      {replyTo && <p className="mt-2 text-[11px] text-[#FF6B00]">Đang trả lời {list.find((c) => c.id === replyTo)?.author} • <button onClick={() => setReplyTo(undefined)} className="underline">hủy</button></p>}
      <div className="mt-3 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={s.user ? "Viết bình luận..." : "Mở tài khoản để bình luận"} className="flex-1 h-11 rounded-full border border-black/10 px-4 outline-none focus:border-[#FF6B00] text-[14px]" />
        <button onClick={send} aria-label="Gửi" className="w-11 h-11 rounded-full bg-[#FF6B00] text-white grid place-items-center"><Send className="w-4 h-4" /></button>
      </div>
    </Sheet>
  );
}

function ShareSheet() {
  const s = useStore();
  const kiotId = s.modal?.kind === "share" ? s.modal.kiotId : 0;
  const kiot = kiotById(kiotId);
  const url = typeof window !== "undefined" && kiot ? `${window.location.origin}/${kiot.slug}` : "";
  const enc = encodeURIComponent(url);
  const targets = [
    { name: "TikTok", href: `https://www.tiktok.com/`, cls: "bg-black" },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc}`, cls: "bg-[#1877F2]", Icon: Facebook },
    { name: "Instagram", href: "https://www.instagram.com/", cls: "bg-gradient-to-br from-fuchsia-500 to-orange-400", Icon: Instagram },
    { name: "YouTube", href: "https://www.youtube.com/", cls: "bg-[#FF0000]" },
    { name: "Shopee", href: "https://shopee.vn/", cls: "bg-[#EE4D2D]" },
    { name: "Zalo", href: `https://zalo.me/share?url=${enc}`, cls: "bg-[#0068FF]" },
  ];
  const copy = async () => { try { await navigator.clipboard.writeText(url); s.notify("🔗 Đã copy link Kiot"); } catch { s.notify(url); } };
  return (
    <Sheet open={!!kiot} onClose={() => s.setModal(null)} title={`Chia sẻ ${kiot?.name ?? ""}`}>
      <div className="grid grid-cols-3 gap-3">
        {targets.map((t) => (
          <a key={t.name} href={t.href} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1">
            <span className={`w-12 h-12 rounded-full ${t.cls} text-white grid place-items-center font-black text-[13px]`}>{t.Icon ? <t.Icon className="w-5 h-5" /> : t.name[0]}</span>
            <span className="text-[11px] font-bold">{t.name}</span>
          </a>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3 rounded-[14px] bg-zinc-50 p-3">
        {url && <QR value={url} size={96} />}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-zinc-500">QR code Kiot • quét để mở</p>
          <p className="text-[12px] font-bold truncate">{url}</p>
          <button onClick={copy} className="mt-2 h-9 px-4 rounded-full bg-black text-white text-[12px] font-bold flex items-center gap-1"><Link2 className="w-4 h-4" /> Copy link</button>
        </div>
      </div>
    </Sheet>
  );
}

function ContactSheet() {
  const s = useStore();
  return (
    <Sheet open={s.modal?.kind === "contact"} onClose={() => s.setModal(null)} title="Liên hệ 9MUA Co., LTD">
      <div className="space-y-3 text-[13px]">
        <p className="flex gap-2"><MapPin className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" /><span><b>Showroom:</b> {s.legal.hq}</span></p>
        <p className="flex gap-2"><MapPin className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" /><span><b>Văn phòng kỹ sư:</b> {s.legal.office}</span></p>
        <p className="flex gap-2"><Copy className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" /><span><b>{BANK.name}:</b> {BANK.account} • {BANK.holderDisplay}</span></p>
        <a href="mailto:ceo@9mua.com" className="flex gap-2 items-center h-11 justify-center rounded-full bg-[#FF6B00] text-white font-black"><Mail className="w-4 h-4" /> Email CEO Nguyễn Hải</a>
      </div>
    </Sheet>
  );
}
