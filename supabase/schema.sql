-- ============================================================
-- ShortAI — Supabase Schema
-- Supabase SQL Editor で実行してください
-- ============================================================

-- profiles テーブル（auth.users を拡張）
create table if not exists public.profiles (
  id                  uuid        primary key references auth.users(id) on delete cascade,
  email               text,
  plan                text        not null default 'free',  -- 'free' | 'pro' | 'business'
  stripe_customer_id  text,
  stripe_sub_id       text,
  generation_count    integer     not null default 0,
  reset_at            timestamptz not null default date_trunc('month', now()),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- generations テーブル（生成履歴）
create table if not exists public.generations (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  count      integer     not null default 1  -- 1回の生成で何本作ったか
);

-- Row Level Security
alter table public.profiles    enable row level security;
alter table public.generations enable row level security;

-- 自分のプロフィールのみ参照・更新可能
create policy "profiles: own read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: own update" on public.profiles for update using (auth.uid() = id);

-- 自分の生成履歴のみ参照可能
create policy "generations: own read"   on public.generations for select using (auth.uid() = user_id);
create policy "generations: own insert" on public.generations for insert with check (auth.uid() = user_id);

-- 新規ユーザー登録時に profiles を自動作成するトリガー
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 月次リセット用関数（毎月1日に generation_count をリセット）
create or replace function public.reset_monthly_generations()
returns void language plpgsql security definer as $$
begin
  update public.profiles
  set generation_count = 0,
      reset_at = date_trunc('month', now())
  where reset_at < date_trunc('month', now());
end;
$$;
