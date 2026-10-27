"use client";
// [STORE-V4] Trạng thái toàn site (dữ liệu mẫu, lưu trên trình duyệt) - thay bằng Supabase 10 bảng khi có key
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  AI_FEATURES, CEO_APPROVAL_VND, DEFAULT_LEGAL, DEFAULT_SLOGANS, FREE_DAILY_LIMIT, KIOTS, KIOT_PRICE_VND, PageId, Platform,
  PRODUCTS, Product, kiotById,
} from "./data";

export type Role = "free" | "kiot_owner" | "admin";
export type User = { name: string; email: string; provider: "email" | "google" | "tiktok"; role: Role; createdAt: string; kiotId?: number };
export type Comment = { id: string; kiotId: number; author: string; text: string; parentId?: string; pinned?: boolean; mine?: boolean };
export type CartItem = { productId: string; qty: number };
export type Order = { id: string; items: { productId: string; title: string; qty: number; price: number; kiotId: number }[]; ship: number; total: number; method: string; status: string; createdAt: string };
export type Tx = { id: string; type: "in" | "out"; amount: number; source: string; note: string; status: "done" | "pending_ceo" | "rejected"; at: string };
export type Connect = { handle: string; stats: Record<string, number>; verified: boolean };
export type AdminUser = { id: string; name: string; email: string; role: Role; status: "active" | "banned" | "pending_owner" };
export type Modal = { kind: "signup" } | { kind: "buy"; kiotId?: number } | { kind: "comments"; kiotId: number } | { kind: "share"; kiotId: number } | { kind: "contact" } | null;

type Persisted = {
  user: User | null;
  hearted: Record<number, boolean>;
  followed: Record<number, boolean>;
  saved: Record<number, boolean>;
  comments: Comment[];
  cart: CartItem[];
  orders: Order[];
  wallet: { balance: number; history: Tx[] };
  connects: Partial<Record<Platform, Connect>>;
  points: number;
  heartsGiven: number;
  vouchers: number;
  daily: { date: string; n: number };
  lang: string;
  slogans: Record<PageId, string>;
  aiEnabled: Record<string, boolean>;
  legal: { hq: string; office: string };
  pinnedKiot: number | null;
  approvedKiots: Record<number, boolean>;
  bannedKiots: Record<number, boolean>;
  adminUsers: AdminUser[];
  myProducts: Product[];
  signupDismissed: boolean;
};

const today = () => new Date().toISOString().slice(0, 10);
const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const SEED_COMMENTS: Comment[] = KIOTS.flatMap((k) => [
  { id: `c${k.id}-owner`, kiotId: k.id, author: k.owner, text: `📌 Chào cả nhà! ${k.bio}. Mua Kiot $1 để mở shop như mình nhé!`, pinned: true },
  { id: `c${k.id}-1`, kiotId: k.id, author: "Thu Hà", text: "Ship ra Hà Nội được không shop?" },
  { id: `c${k.id}-1r`, kiotId: k.id, author: k.owner, text: "Được ạ, giao toàn quốc 2-3 ngày nha!", parentId: `c${k.id}-1` },
  { id: `c${k.id}-2`, kiotId: k.id, author: "Minh Tuấn", text: "Tim bay đẹp quá, đã follow 🧡" },
]);

const INITIAL: Persisted = {
  user: null, hearted: {}, followed: {}, saved: {}, comments: SEED_COMMENTS, cart: [], orders: [],
  wallet: { balance: 0, history: [] }, connects: {}, points: 0, heartsGiven: 0, vouchers: 0, daily: { date: today(), n: 0 },
  lang: "VI", slogans: DEFAULT_SLOGANS, aiEnabled: Object.fromEntries(AI_FEATURES.map((f) => [f.id, true])),
  legal: DEFAULT_LEGAL, pinnedKiot: 4, approvedKiots: Object.fromEntries(KIOTS.map((k) => [k.id, true])), bannedKiots: {},
  adminUsers: [
    { id: "u1", name: "Cô Lan Bát Tràng", email: "lan@9mua.com", role: "kiot_owner", status: "active" },
    { id: "u2", name: "Thu Hà", email: "thuha@gmail.com", role: "free", status: "pending_owner" },
    { id: "u3", name: "bot_tim_ao_123", email: "bot123@spam.xyz", role: "free", status: "active" },
    { id: "u4", name: "Minh Tuấn", email: "tuan@gmail.com", role: "free", status: "active" },
  ],
  myProducts: [], signupDismissed: false,
};

const STORAGE_KEY = "9mua-v4";

function useStoreValue() {
  const [s, setS] = useState<Persisted>(INITIAL);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setS({ ...INITIAL, ...JSON.parse(raw) });
    } catch {}
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
  }, [s, hydrated]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2800);
  }, []);

  const set = (patch: Partial<Persisted> | ((p: Persisted) => Partial<Persisted>)) =>
    setS((p) => ({ ...p, ...(typeof patch === "function" ? patch(p) : patch) }));

  const isOwner = s.user?.role === "kiot_owner" || s.user?.role === "admin";

  // Free: giới hạn 50 tim + follow / ngày
  const takeQuota = (): boolean => {
    if (!s.user) { setModal({ kind: "signup" }); return false; }
    if (isOwner) return true;
    const n = s.daily.date === today() ? s.daily.n : 0;
    if (n >= FREE_DAILY_LIMIT) { notify(`Tài khoản Free giới hạn ${FREE_DAILY_LIMIT} tim/follow mỗi ngày - Mua Kiot $1 để không giới hạn`); return false; }
    set({ daily: { date: today(), n: n + 1 } });
    return true;
  };

  const requireUser = () => { if (!s.user) { setModal({ kind: "signup" }); return false; } return true; };

  const actions = {
    notify, setModal,
    signup: (name: string, email: string, provider: User["provider"]) => {
      const user: User = { name: name || email.split("@")[0] || "Bạn", email, provider, role: "free", createdAt: new Date().toISOString() };
      set((p) => ({ user, signupDismissed: true, adminUsers: [{ id: uid("u"), name: user.name, email, role: "free", status: "active" }, ...p.adminUsers] }));
      setModal(null);
      notify(`🎉 Đã mở tài khoản miễn phí - Chào ${user.name}!`);
    },
    logout: () => { set({ user: null }); notify("Đã đăng xuất"); },
    dismissSignup: () => { set({ signupDismissed: true }); setModal(null); },
    setLang: (lang: string) => set({ lang }),

    toggleHeart: (kiotId: number, force?: boolean) => {
      const next = force ?? !s.hearted[kiotId];
      if (next === !!s.hearted[kiotId]) return true;
      if (next && !takeQuota()) return false;
      if (!next && !requireUser()) return false;
      set((p) => {
        const heartsGiven = p.heartsGiven + (next ? 1 : 0);
        const earned = next && heartsGiven % 100 === 0 ? 1 : 0;
        if (earned) setTimeout(() => notify("🎁 Đủ 100 tim - Tặng voucher $1 mua Kiot!"), 0);
        return { hearted: { ...p.hearted, [kiotId]: next }, heartsGiven, points: p.points + (next ? 0.5 : -0.5), vouchers: p.vouchers + earned };
      });
      return true;
    },
    toggleFollow: (kiotId: number) => {
      const next = !s.followed[kiotId];
      if (next ? !takeQuota() : !requireUser()) return;
      set((p) => ({ followed: { ...p.followed, [kiotId]: next }, points: p.points + (next ? 1 : -1) }));
      notify(next ? `Đang theo dõi ${kiotById(kiotId)?.owner} • +1 điểm` : "Đã bỏ theo dõi");
    },
    toggleSave: (kiotId: number) => {
      if (!requireUser()) return;
      const next = !s.saved[kiotId];
      set((p) => ({ saved: { ...p.saved, [kiotId]: next } }));
      notify(next ? "🔖 Đã lưu vào bộ sưu tập" : "Đã bỏ lưu");
    },
    addComment: (kiotId: number, text: string, parentId?: string) => {
      if (!requireUser()) return;
      set((p) => ({ comments: [...p.comments, { id: uid("c"), kiotId, author: p.user!.name, text, parentId, mine: true }] }));
    },
    togglePin: (commentId: string) => set((p) => ({ comments: p.comments.map((c) => (c.id === commentId ? { ...c, pinned: !c.pinned } : c)) })),

    addToCart: (productId: string, qty = 1) => {
      set((p) => {
        const found = p.cart.find((c) => c.productId === productId);
        return { cart: found ? p.cart.map((c) => (c.productId === productId ? { ...c, qty: c.qty + qty } : c)) : [...p.cart, { productId, qty }] };
      });
      const prod = [...PRODUCTS, ...s.myProducts].find((p) => p.id === productId);
      notify(`🛒 Đã thêm ${prod?.title ?? "sản phẩm"} vào túi cam`);
    },
    setQty: (productId: string, qty: number) =>
      set((p) => ({ cart: qty <= 0 ? p.cart.filter((c) => c.productId !== productId) : p.cart.map((c) => (c.productId === productId ? { ...c, qty } : c)) })),
    checkout: (method: string, ship: number) => {
      if (!requireUser()) return null;
      const all = [...PRODUCTS, ...s.myProducts];
      const items = s.cart.map((c) => { const pr = all.find((x) => x.id === c.productId)!; return { productId: pr.id, title: pr.title, qty: c.qty, price: pr.price, kiotId: pr.kiotId }; });
      const total = items.reduce((t, i) => t + i.price * i.qty, 0) + ship;
      if (method === "wallet" && s.wallet.balance < total) { notify("Số dư ví không đủ - Nạp thêm hoặc chọn cách khác"); return null; }
      const order: Order = { id: `9MUA-${8823 + s.orders.length}`, items, ship, total, method, status: method === "wallet" ? "Đã thanh toán" : "Chờ thanh toán", createdAt: new Date().toISOString() };
      set((p) => ({
        orders: [order, ...p.orders], cart: [],
        wallet: method === "wallet" ? { balance: p.wallet.balance - total, history: [{ id: uid("tx"), type: "out", amount: total, source: "Ví 9MUA", note: `Thanh toán đơn ${order.id}`, status: "done", at: order.createdAt }, ...p.wallet.history] } : p.wallet,
      }));
      return order;
    },

    // Mua Kiot $1 -> role kiot_owner
    buyKiot: (kiotId: number | undefined, method: string, useVoucher: boolean) => {
      if (!requireUser()) return;
      if (useVoucher && s.vouchers < 1) { notify("Bạn chưa có voucher"); return; }
      if (method === "wallet" && !useVoucher && s.wallet.balance < KIOT_PRICE_VND) { notify("Số dư ví không đủ"); return; }
      const now = new Date().toISOString();
      const paidNow = useVoucher || method === "wallet";
      set((p) => {
        const role: Role = p.user!.role === "admin" ? "admin" : "kiot_owner";
        const seedIncome: Tx[] = p.user!.role === "free" ? (["TikTok", "Facebook", "Instagram", "YouTube", "Shopee", "Zalo"] as const).map((src, i) => ({ id: uid("tx"), type: "in" as const, amount: [420000, 260000, 180000, 150000, 140000, 100000][i], source: src, note: "Doanh thu mẫu (demo)", status: "done" as const, at: now })) : [];
        const fee: Tx[] = method === "wallet" && !useVoucher ? [{ id: uid("tx"), type: "out", amount: KIOT_PRICE_VND, source: "Ví 9MUA", note: "Mua Kiot $1", status: "done", at: now }] : [];
        const incomeTotal = seedIncome.reduce((t, x) => t + x.amount, 0);
        const order: Order = { id: `9MUA-${8823 + p.orders.length}`, items: [{ productId: "kiot", title: `Kiot $1${kiotId ? ` - ${kiotById(kiotId)?.name}` : ""}`, qty: 1, price: KIOT_PRICE_VND, kiotId: kiotId ?? 0 }], ship: 0, total: useVoucher ? 0 : KIOT_PRICE_VND, method: useVoucher ? "voucher" : method, status: paidNow ? "Đã thanh toán" : "Chờ xác nhận chuyển khoản", createdAt: now };
        return {
          user: { ...p.user!, role, kiotId: p.user!.kiotId ?? 100 },
          vouchers: p.vouchers - (useVoucher ? 1 : 0),
          wallet: { balance: p.wallet.balance + incomeTotal - (fee[0]?.amount ?? 0), history: [...fee, ...seedIncome, ...p.wallet.history] },
          orders: [order, ...p.orders],
        };
      });
      setModal(null);
      notify(paidNow ? "✅ Bạn đã là Kiot Owner - Mở khóa đầy đủ!" : "✅ Đã ghi nhận - Mở khóa Kiot Owner (chờ đối soát chuyển khoản)");
    },

    topUp: (amount: number, source: string) => set((p) => ({ wallet: { balance: p.wallet.balance + amount, history: [{ id: uid("tx"), type: "in", amount, source, note: "Nạp ví (demo)", status: "done", at: new Date().toISOString() }, ...p.wallet.history] } })),
    withdraw: (amount: number, to: string) => {
      if (!isOwner) { notify("Chỉ Kiot Owner được rút tiền - Mua Kiot $1"); return; }
      if (amount <= 0 || amount > s.wallet.balance) { notify("Số tiền không hợp lệ"); return; }
      const needCeo = amount > CEO_APPROVAL_VND;
      set((p) => ({ wallet: { balance: p.wallet.balance - amount, history: [{ id: uid("tx"), type: "out", amount, source: to, note: `Rút về ${to}`, status: needCeo ? "pending_ceo" : "done", at: new Date().toISOString() }, ...p.wallet.history] } }));
      notify(needCeo ? "⏳ Rút > $500 - Chờ CEO Nguyễn Hải duyệt (1%)" : `✅ Đã rút về ${to} (AI tự duyệt 99%)`);
    },
    decideWithdraw: (txId: string, ok: boolean) => set((p) => {
      const tx = p.wallet.history.find((t) => t.id === txId);
      if (!tx) return {};
      return { wallet: { balance: p.wallet.balance + (ok ? 0 : tx.amount), history: p.wallet.history.map((t) => (t.id === txId ? { ...t, status: ok ? "done" : "rejected" } : t)) } };
    }),

    connect: (platform: Platform, c: Connect | null) => set((p) => {
      const next = { ...p.connects };
      if (c) next[platform] = c; else delete next[platform];
      return { connects: next };
    }),

    publishProduct: (prod: Omit<Product, "id" | "kiotId">) => {
      set((p) => ({ myProducts: [{ ...prod, id: uid("ai"), kiotId: p.user?.kiotId ?? 100 }, ...p.myProducts] }));
      notify("🚀 Đã đăng bán lên Kiot của bạn");
    },

    // Admin
    setSlogan: (page: PageId, text: string) => set((p) => ({ slogans: { ...p.slogans, [page]: text } })),
    resetSlogans: () => set({ slogans: DEFAULT_SLOGANS }),
    toggleAi: (id: string) => set((p) => ({ aiEnabled: { ...p.aiEnabled, [id]: !p.aiEnabled[id] } })),
    setLegal: (legal: Persisted["legal"]) => set({ legal }),
    pinKiot: (id: number | null) => set({ pinnedKiot: id }),
    setKiotApproved: (id: number, ok: boolean) => set((p) => ({ approvedKiots: { ...p.approvedKiots, [id]: ok } })),
    setKiotBanned: (id: number, banned: boolean) => set((p) => ({ bannedKiots: { ...p.bannedKiots, [id]: banned } })),
    setAdminUser: (id: string, patch: Partial<AdminUser>) => set((p) => ({ adminUsers: p.adminUsers.map((u) => (u.id === id ? { ...u, ...patch } : u)) })),
    becomeAdmin: () => set((p) => (p.user ? { user: { ...p.user, role: "admin", kiotId: p.user.kiotId ?? 100 } } : {})),
    resetDemo: () => { setS(INITIAL); notify("Đã xóa dữ liệu demo"); },
  };

  return { ...s, hydrated, toast, modal, isOwner, ...actions };
}

type Store = ReturnType<typeof useStoreValue>;
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const value = useStoreValue();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside StoreProvider");
  return v;
}

export function allProducts(extra: Product[]) { return [...PRODUCTS, ...extra]; }

// Kiot hiển thị: bỏ Kiot bị ban/chưa duyệt, ghim Kiot lên đầu
export function visibleKiots(s: Pick<Store, "pinnedKiot" | "approvedKiots" | "bannedKiots">) {
  const list = KIOTS.filter((k) => s.approvedKiots[k.id] !== false && !s.bannedKiots[k.id]);
  return s.pinnedKiot ? [...list.filter((k) => k.id === s.pinnedKiot), ...list.filter((k) => k.id !== s.pinnedKiot)] : list;
}
