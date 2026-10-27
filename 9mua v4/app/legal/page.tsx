"use client";
// [PAGE-10] Pháp lý - Giới thiệu 9MUA Co., LTD, giấy phép, địa chỉ, con dấu, ngân hàng
import { Building2, Copy, Landmark, MapPin, ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { BANK } from "@/lib/data";
import { vietQR } from "@/lib/vietqr";
import LogoV4 from "@/components/LogoV4";
import { PageSlogan, QR } from "@/components/ui";

export default function Legal() {
  const s = useStore();
  const copy = async () => { try { await navigator.clipboard.writeText(BANK.account); s.notify(`Đã copy STK ${BANK.account}`); } catch { s.notify(BANK.account); } };
  const map = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q.split(" - ")[0])}`;

  return (
    <div className="bg-white text-zinc-900 min-h-full">
      <div className="mx-auto max-w-[900px] px-4 md:px-6 py-8">
        <div className="text-center">
          <div className="flex justify-center"><LogoV4 size={64} /></div>
          <h1 className="display mt-4 text-[26px] md:text-[32px] font-black tracking-tight">9MUA Co., LTD</h1>
          <div className="mt-3 inline-flex flex-wrap justify-center gap-2">
            <span className="px-3 py-1 rounded-full bg-black text-white text-[11px] font-bold flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Đã đăng ký kinh doanh - Có con dấu tròn</span>
            <span className="px-3 py-1 rounded-full bg-[#FF6B00] text-white text-[11px] font-bold">Mã số thuế: đang cập nhật</span>
          </div>
        </div>

        <div className="mt-8 grid gap-5">
          <Card icon={<Building2 className="w-5 h-5 text-[#FF6B00]" />} title="Giới thiệu công ty">
            <p className="text-[13px] leading-relaxed text-zinc-700"><b>Lĩnh vực:</b> Sàn TMĐT kết hợp Social, AI Studio, Showroom Hamubay.</p>
            <p className="mt-2 text-[13px] leading-relaxed text-zinc-700"><b>Cam kết:</b> 99% AI + 1% CEO vận hành - Người thật quản lý tiền thật. AI tự duyệt follow, tim, comment, tạo Kiot $1; CEO Nguyễn Hải duyệt rút tiền trên $500, ban Kiot, đổi slogan chính.</p>
          </Card>

          <Card icon={<MapPin className="w-5 h-5 text-[#FF6B00]" />} title="Địa chỉ">
            <div className="grid md:grid-cols-2 gap-3">
              {[["TRỤ SỞ CHÍNH (SHOWROOM)", s.legal.hq], ["VĂN PHÒNG KỸ SƯ", s.legal.office]].map(([tag, addr]) => (
                <a key={tag} href={map(addr)} target="_blank" rel="noopener noreferrer" className="rounded-[14px] bg-[#FFF7ED] border border-black/5 p-4 hover:border-[#FF6B00]">
                  <p className="text-[10px] px-2 py-1 rounded-full bg-black text-white inline-flex">{tag}</p>
                  <p className="mt-2 text-[13px] font-bold">{addr}</p>
                  <p className="mt-2 text-[11px] text-[#FF6B00] font-bold flex items-center gap-1"><MapPin className="w-3 h-3" /> Mở Google Maps</p>
                </a>
              ))}
            </div>
          </Card>

          <Card icon={<Landmark className="w-5 h-5 text-[#FF6B00]" />} title="Tài khoản ngân hàng">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <QR value={vietQR({ bin: BANK.bin, account: BANK.account, note: "9MUA" })} size={150} />
              <div className="flex-1 w-full">
                <p className="text-[11px] text-zinc-500">{BANK.name}</p>
                <p className="font-black text-[22px] tracking-tight">{BANK.account}</p>
                <p className="text-[13px]">Chủ tài khoản: <b>{BANK.holderDisplay}</b></p>
                <p className="text-[12px] text-zinc-500">{BANK.branch}</p>
                <button onClick={copy} className="mt-3 h-10 px-4 rounded-full bg-black text-white text-[12px] font-bold inline-flex items-center gap-1"><Copy className="w-4 h-4" /> Copy STK</button>
              </div>
            </div>
          </Card>

          <Card icon={<ShieldCheck className="w-5 h-5 text-[#FF6B00]" />} title="Con dấu & CEO">
            <div className="flex items-center gap-4">
              <div className="w-[84px] h-[84px] rounded-full border-4 border-red-600 grid place-items-center text-red-600 text-center text-[9px] font-black leading-tight rotate-[-12deg] shrink-0">CÔNG TY<br />TNHH<br />9MUA</div>
              <div><p className="font-black">CEO Nguyễn Hải</p><p className="text-[12px] text-zinc-600">Điều hành 1% quyết định quan trọng • ceo@9mua.com</p>
                <button onClick={() => s.setModal({ kind: "contact" })} className="mt-2 h-9 px-4 rounded-full bg-[#FF6B00] text-white text-[12px] font-black">Liên hệ</button></div>
            </div>
          </Card>
        </div>

        <footer className="mt-10 border-t pt-6 text-center">
          <PageSlogan page="legal" className="text-[15px] text-[#FF6B00]" />
          <p className="mt-2 text-[11px] text-zinc-400">© 2026 9MUA Co., LTD • 9mua.com • {BANK.name} {BANK.account}</p>
        </footer>
      </div>
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[20px] border border-black/10 p-5 bg-white shadow-sm">
      <h2 className="font-black text-[16px] flex items-center gap-2 mb-3">{icon}{title}</h2>
      {children}
    </section>
  );
}
