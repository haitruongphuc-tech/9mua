"use client";
// [COMP-UI] Thành phần dùng chung: Sheet (trượt từ dưới lên), QR, slogan theo trang
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import QRCode from "qrcode";
import { useStore } from "@/lib/store";
import { PageId, SLOGAN_I18N, DEFAULT_SLOGANS } from "@/lib/data";

export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center" onClick={onClose}>
      <div className={`w-full ${wide ? "md:max-w-[560px]" : "md:max-w-[440px]"} max-h-[88dvh] overflow-y-auto rounded-t-[24px] md:rounded-[24px] bg-white text-zinc-900 p-5 animate-[sheetUp_0.25s_ease]`} onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-200 md:hidden" />
        <div className="flex items-center justify-between mb-4 gap-3">
          <h3 className="display font-black text-[16px] leading-tight">{title}</h3>
          <button onClick={onClose} aria-label="Đóng" className="w-8 h-8 shrink-0 rounded-full bg-zinc-100 grid place-items-center hover:bg-zinc-200"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function QR({ value, size = 180 }: { value: string; size?: number }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(value, { width: size * 2, margin: 1, color: { dark: "#0A0A0A", light: "#FFFFFF" } }).then(setSrc).catch(() => setSrc(""));
  }, [value, size]);
  return src ? <img src={src} alt="QR" width={size} height={size} style={{ width: size, height: size }} className="rounded-[12px]" /> : <div style={{ width: size, height: size }} className="rounded-[12px] bg-zinc-100 animate-pulse" />;
}

// Slogan trang - lấy từ cài đặt CEO (/admin), dịch nếu có bản dịch sẵn
export function useSlogan(page: PageId) {
  const { slogans, lang } = useStore();
  const text = slogans[page] ?? DEFAULT_SLOGANS[page];
  const translated = lang !== "VI" && text === DEFAULT_SLOGANS[page] ? SLOGAN_I18N[lang]?.[page] : undefined;
  return translated ?? text;
}

export function PageSlogan({ page, className = "" }: { page: PageId; className?: string }) {
  const text = useSlogan(page);
  return <p className={`display font-black tracking-tight ${className}`}>{text}</p>;
}

export function Pill({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`shrink-0 h-8 px-3.5 rounded-full text-[12px] font-bold border transition ${active ? "bg-[#FF6B00] border-[#FF6B00] text-white" : "bg-white/5 border-white/15 text-white/70 hover:text-white"}`}>{children}</button>
  );
}
