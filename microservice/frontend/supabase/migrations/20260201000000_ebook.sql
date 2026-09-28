-- Modul E-Book neutrack (di dalam frontend kachponz).
-- Reader berbasis GAMBAR (WebP per halaman) + klaim manual (upload bukti bayar &
-- webinar) + verifikasi admin. Pola meniru ling-mandarin-lab. Jalankan di project
-- Supabase yang dipakai kachponz (atau project khusus e-book).

-- 1. products ------------------------------------------------------------------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  title       text not null,
  description text,
  price       integer not null default 0,
  cover_url   text,
  kind        text not null default 'ebook',   -- 'ebook' (berbayar) | 'materi' (gratis)
  pages_path  text,                             -- folder di bucket 'ebooks', mis '<slug>/pages'
  page_count  integer,                          -- jumlah halaman (dari manifest.json)
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 2. orders (= "klaim") --------------------------------------------------------
create table if not exists public.orders (
  id                 uuid primary key default gen_random_uuid(),
  order_ref          text unique not null,
  product_id         uuid references public.products(id) on delete restrict,
  buyer_name         text not null,
  buyer_whatsapp     text not null,            -- untuk admin hubungi via WA
  buyer_email        text,                     -- opsional; akses utama lewat token
  amount             integer not null default 0,
  status             text not null default 'awaiting_verification',
                     -- 'awaiting_verification' | 'paid' | 'rejected' | 'expired'
  proof_path         text,                     -- bukti pembayaran (bucket payment-proofs)
  webinar_proof_path text,                     -- bukti ikut webinar (bucket payment-proofs)
  access_token       text,                     -- link tanpa-login: /read/<slug>?t=<token>
  access_devices     text[] not null default '{}',  -- perangkat terikat (maks 2)
  verified_by        text,
  verified_at        timestamptz,
  rejection_note     text,
  paid_at            timestamptz,
  created_at         timestamptz not null default now()
);

create unique index if not exists orders_access_token_uniq
  on public.orders (access_token) where access_token is not null;
create index if not exists orders_status_idx on public.orders (status);

-- 3. entitlements (kalau nanti pakai jalur login by-email) ----------------------
create table if not exists public.entitlements (
  id          uuid primary key default gen_random_uuid(),
  buyer_email text not null,
  product_id  uuid references public.products(id) on delete cascade,
  order_id    uuid references public.orders(id) on delete cascade,
  granted_at  timestamptz not null default now(),
  unique (buyer_email, product_id)
);

-- 4. RLS -----------------------------------------------------------------------
alter table public.products     enable row level security;
alter table public.orders       enable row level security;
alter table public.entitlements enable row level security;

-- Produk aktif boleh dibaca publik (untuk halaman /ebook).
drop policy if exists "products public read" on public.products;
create policy "products public read" on public.products
  for select using (is_active = true);

-- orders: TIDAK ada policy → hanya service-role (backend) yang akses.
-- entitlements: pemilik boleh lihat miliknya (kalau pakai auth Supabase).
drop policy if exists "entitlements owner read" on public.entitlements;
create policy "entitlements owner read" on public.entitlements
  for select to authenticated using (buyer_email = auth.email());

-- 5. Storage buckets (privat) --------------------------------------------------
insert into storage.buckets (id, name, public) values ('ebooks', 'ebooks', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('payment-proofs', 'payment-proofs', false)
  on conflict (id) do nothing;
-- Tak ada policy storage untuk anon/authenticated: semua baca/tulis lewat
-- service-role (signed URL) dari Route Handler.
