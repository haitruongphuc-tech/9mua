"use client";
// [PAGE-05] Giỏ hàng & Deal - Gom từ nhiều Kiot, 1 lần checkout, phí ship tính gộp
import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Minus, Plus, ShoppingBag, Store, Trash2 } from "lucide-react";
import { allProducts, useStore } from "@/lib/store";
import { BANK, fmtVND, kiotById } from "@/lib/data";
import { vietQR } from "@/lib/vietqr";
import { PageSlogan, QR, Sheet } from "@/components/ui";

const METHODS = [{ id: "wallet", label: "Ví 9MUA" }, { id: "mbbank", label: "MBBank QR" }, { id: "momo", label: "MoMo" }, { id: "vnpay", label: "VNPay" }, { id: "stripe", label: "Stripe" }];

export default function Cart() {
  const s = useStore();
  const [method, setMethod] = useState("mbbank");
  const [done, setDone] = useState<string | null>(null);
  const products = allProducts(s.myProducts);
  const lines = s.cart.map((c) => ({ ...c, p: products.find((p) => p.id === c.productId)! })).filter((l) => l.p);
  const byKiot = Array.from(new Set(lines.map((l) => l.p.kiotId)));
  const subtotal = lines.reduce((t, l) => t + l.p.price * l.qty, 0);
  const ship = byKiot.length ? 30000 + (byKiot.length - 1) * 10000 : 0; // ship gộp: 30k + 10k mỗi Kiot thêm
  const shipSeparate = byKiot.length * 30000;
  const total = subtotal + ship;
  const order = s.orders.find((o) => o.id === done);

  return (
    <div className="mx-auto max-w-[900px] px-3 md:px-6 py-4">
      <div className="sticky top-[64px] z-20 -mx-3 md:mx-0 px-4 py-3 bg-[#FF6B00] md:rounded-[16px] flex items-center gap-2">
        <ShoppingBag className="w-5 h-5 shrink-0" /><PageSlogan page="cart" className="text-[15px] md:text-[17px]" />
      </div>

      {lines.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="font-black text-[18px]">Túi cam đang trống</p>
          <p className="text-[13px] text-white/50 mt-1">Bấm "+ Giỏ" ở Feed, Live hoặc trang Kiot</p>
          <Link href="/explore" className="mt-4 inline-flex h-11 px-6 rounded-full bg-[#FF6B00] font-black text-[13px] items-center">Đi chợ Kiot</Link>
          {s.orders.length > 0 && <OrderList />}
        </div>
      ) : (
        <div className="mt-4 grid md:grid-cols-[1fr_320px] gap-4">
          <div className="space-y-3">
            {byKiot.map((kid) => {
              const k = kiotById(kid);
              return (
                <div key={kid} className="rounded-[18px] bg-white/5 border border-white/10 p-3">
                  <Link href={k ? `/${k.slug}` : "/me"} className="flex items-center gap-2 text-[13px] font-black"><Store className="w-4 h-4 text-[#FF6B00]" />{k?.name ?? "Kiot của bạn"}</Link>
                  {lines.filter((l) => l.p.kiotId === kid).map((l) => (
                    <div key={l.productId} className="mt-2 flex items-center gap-3 rounded-[12px] bg-black/40 p-2">
                      <span className={`w-14 h-14 rounded-[10px] bg-gradient-to-br ${k?.color ?? "from-orange-500 to-red-500"} shrink-0`} />
                      <div className="min-w-0 flex-1"><p className="text-[13px] font-bold truncate">{l.p.title}</p><p className="text-[13px] text-[#FF6B00] font-black">{fmtVND(l.p.price)}</p></div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => s.setQty(l.productId, l.qty - 1)} aria-label="Bớt" className="w-8 h-8 rounded-full bg-white/10 grid place-items-center">{l.qty === 1 ? <Trash2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}</button>
                        <span className="w-6 text-center text-[13px] font-bold">{l.qty}</span>
                        <button onClick={() => s.setQty(l.productId, l.qty + 1)} aria-label="Thêm" className="w-8 h-8 rounded-full bg-white/10 grid place-items-center"><Plus className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          <div className="rounded-[18px] bg-white text-black p-4 h-fit md:sticky md:top-[140px]">
            <p className="font-black text-[14px]">Thanh toán 1 lần</p>
            <div className="mt-3 space-y-1.5 text-[13px]">
              <div className="flex justify-between"><span>Tạm tính ({lines.reduce((t, l) => t + l.qty, 0)} món)</span><span>{fmtVND(subtotal)}</span></div>
              <div className="flex justify-between"><span>Ship gộp {byKiot.length} Kiot</span><span>{fmtVND(ship)}</span></div>
              {shipSeparate > ship && <p className="text-[11px] text-emerald-600 font-bold">Tiết kiệm {fmtVND(shipSeparate - ship)} nhờ gom 1 túi</p>}
              <div className="flex justify-between font-black text-[16px] pt-2 border-t"><span>Tổng</span><span className="text-[#FF6B00]">{fmtVND(total)}</span></div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {METHODS.map((m) => <button key={m.id} onClick={() => setMethod(m.id)} className={`h-9 rounded-[10px] border text-[11px] font-bold ${method === m.id ? "border-[#FF6B00] bg-[#FFF7ED] text-[#FF6B00]" : "border-black/10"}`}>{m.label}</button>)}
            </div>
            {method === "wallet" && <p className="mt-2 text-[11px] text-zinc-500">Số dư ví: {fmtVND(s.wallet.balance)}</p>}
            <button onClick={() => { const o = s.checkout(method, ship); if (o) setDone(o.id); }} className="mt-3 w-full h-12 rounded-full bg-[#FF6B00] text-white font-black">ĐẶT HÀNG • {fmtVND(total)}</button>
          </div>
        </div>
      )}

      <Sheet open={!!order} onClose={() => setDone(null)} title={`Đặt hàng thành công • ${order?.id ?? ""}`}>
        {order && (
          <div className="text-center">
            <CheckCircle2 className="mx-auto w-12 h-12 text-emerald-500" />
            <p className="mt-2 font-black">{order.status}</p>
            {order.method === "mbbank" && (
              <div className="mt-3 flex flex-col items-center">
                <QR value={vietQR({ bin: BANK.bin, account: BANK.account, amount: order.total, note: order.id })} size={180} />
                <p className="mt-2 text-[12px]">{BANK.name} {BANK.account} • {BANK.holderDisplay} • {fmtVND(order.total)}</p>
                <p className="text-[11px] text-zinc-500">Nội dung: {order.id}</p>
              </div>
            )}
            {["momo", "vnpay", "stripe"].includes(order.method) && <p className="mt-2 text-[12px] text-zinc-500">Demo: cổng {order.method.toUpperCase()} sẽ mở ở đây khi có tài khoản thật</p>}
            <button onClick={() => setDone(null)} className="mt-4 h-11 px-6 rounded-full bg-black text-white font-bold text-[13px]">Xong</button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function OrderList() {
  const s = useStore();
  return (
    <div className="mt-8 text-left rounded-[18px] bg-white/5 border border-white/10 p-4">
      <p className="font-black text-[13px]">Đơn hàng của bạn</p>
      <div className="mt-2 space-y-2">
        {s.orders.map((o) => (
          <div key={o.id} className="flex justify-between gap-2 text-[12px] bg-black/40 rounded-[10px] px-3 py-2">
            <span className="min-w-0"><b>{o.id}</b><span className="block text-white/50 truncate">{o.items.map((i) => i.title).join(", ")}</span></span>
            <span className="text-right shrink-0"><span className="block text-[#FF6B00] font-bold">{fmtVND(o.total)}</span><span className="text-white/50">{o.status}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}
