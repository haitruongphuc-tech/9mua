-- 9MUA.COM V4 - [DB-SUPABASE] 10 bảng theo tài liệu V4 - Free vs Kiot Owner
-- RLS bật hết: Free chỉ đọc, Kiot Owner đọc ghi row của mình, Admin bypass (service role)
-- Chưa dùng trong bản demo: app hiện chạy dữ liệu mẫu trong lib/data.ts + lib/store.tsx

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  role text not null default 'free' check (role in ('free', 'kiot_owner', 'admin')),
  avatar text,
  created_at timestamptz default now()
);

create table kiots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id) on delete cascade,
  slug text unique not null,
  name text not null,
  slogan text,
  logo text,
  address text,
  hamubay_lot text,
  created_at timestamptz default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  kiot_id uuid references kiots(id) on delete cascade,
  title text not null,
  price numeric not null,
  images text[] default '{}',
  ai_generated boolean default false,
  created_at timestamptz default now()
);

create table follows (
  follower_id uuid references users(id) on delete cascade,
  kiot_id uuid references kiots(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, kiot_id)
);

create table hearts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  kiot_id uuid references kiots(id) on delete cascade,
  count int default 1,
  created_at timestamptz default now()
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  target_id uuid not null,
  content text not null,
  parent_id uuid references comments(id) on delete cascade,
  pinned boolean default false,
  created_at timestamptz default now()
);

create table social_connects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  platform text not null check (platform in ('tiktok', 'facebook', 'instagram', 'youtube', 'shopee', 'zalo')),
  handle text not null,
  followers int default 0,
  verified boolean default false,
  value_usd numeric default 0,
  unique (user_id, platform)
);

create table wallets (
  user_id uuid primary key references users(id) on delete cascade,
  balance numeric default 0,
  mb_bank_acc text,
  momo text,
  vnpay text
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references users(id),
  kiot_id uuid references kiots(id),
  product_ids uuid[] not null,
  total numeric not null,
  status text default 'pending',
  created_at timestamptz default now()
);

create table slogan_settings (
  page_id text primary key,
  slogan_text text not null,
  active boolean default true
);

insert into slogan_settings (page_id, slogan_text) values
  ('home', 'Mở cổng thế giới - Một chạm là tới'),
  ('explore', 'Kiot nào cũng là showroom - 9MUA kết nối'),
  ('live', 'Nhìn thật - Mua thật - Người thật việc thật'),
  ('value', 'Tài khoản bạn đáng giá bao nhiêu? 9MUA tính ra tiền'),
  ('cart', 'Gom cả chợ vào một túi - Túi cam 9MUA'),
  ('wallet', 'Tiền về túi cam - An toàn như két'),
  ('profile', 'Mỗi Kiot là một thương hiệu - CEO đứng sau'),
  ('connect', '6 mạng xã hội - 1 nơi quản'),
  ('ai', '5 kỹ thuật - 9 AI - ArtCraft vẽ tương lai'),
  ('legal', '99% AI vận hành - 1% CEO phê duyệt - Người thật');

-- Row Level Security
alter table users enable row level security;
alter table kiots enable row level security;
alter table products enable row level security;
alter table follows enable row level security;
alter table hearts enable row level security;
alter table comments enable row level security;
alter table social_connects enable row level security;
alter table wallets enable row level security;
alter table orders enable row level security;
alter table slogan_settings enable row level security;

create or replace function is_owner() returns boolean language sql stable as $$
  select exists (select 1 from users where id = auth.uid() and role in ('kiot_owner', 'admin'))
$$;

-- Ai cũng đọc được nội dung công khai
create policy "public read kiots" on kiots for select using (true);
create policy "public read products" on products for select using (true);
create policy "public read comments" on comments for select using (true);
create policy "public read slogans" on slogan_settings for select using (true);

-- Người dùng đọc/sửa row của mình
create policy "own user" on users for select using (id = auth.uid());
create policy "own wallet" on wallets for select using (user_id = auth.uid());
create policy "own connects" on social_connects for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own orders" on orders for select using (buyer_id = auth.uid());

-- Free và Owner đều follow / tim / comment (giới hạn 50/ngày cho Free kiểm tra ở API)
create policy "write follows" on follows for all using (follower_id = auth.uid()) with check (follower_id = auth.uid());
create policy "write hearts" on hearts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "write comments" on comments for insert with check (user_id = auth.uid());

-- Chỉ Kiot Owner tạo/sửa Kiot và sản phẩm của mình
create policy "owner kiots" on kiots for all using (owner_id = auth.uid() and is_owner()) with check (owner_id = auth.uid() and is_owner());
create policy "owner products" on products for all
  using (is_owner() and exists (select 1 from kiots k where k.id = kiot_id and k.owner_id = auth.uid()))
  with check (is_owner() and exists (select 1 from kiots k where k.id = kiot_id and k.owner_id = auth.uid()));
