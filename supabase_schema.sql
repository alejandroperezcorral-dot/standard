-- ============================================
-- FW26 Buying Tool — Supabase Schema
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- ============================================

-- Main negotiation rows table
create table if not exists negotiation_rows (
  id bigint primary key,
  fecha date,
  modelo text,
  description text,
  supplier text,
  origin text,
  transport text,
  temporada text,
  dept text,
  cat text,
  pvp_rub numeric,
  fob1 numeric,
  fob2 numeric,
  fob3 numeric,
  fob_closed numeric,
  weight numeric,
  units integer,
  target_imu numeric,
  notes text,
  status text default 'PENDING',
  fsd date,
  ch_off numeric,
  ch_mkt numeric,
  ch_onl numeric,
  sell_thru numeric,
  lc_weeks integer,
  photo text,
  photo2 text,
  cust_profile text,
  capsule text,
  fashionability text,
  n_colours integer,
  updated_at timestamptz default now()
);

-- Shared app state: settings, duties, freight, seasons, dept/cat tree, global params
create table if not exists app_state (
  key text primary key,
  value jsonb,
  updated_at timestamptz default now()
);

-- Enable Row Level Security
alter table negotiation_rows enable row level security;
alter table app_state enable row level security;

-- Allow anyone with the anon key to read/write (internal tool, no auth required)
-- This is suitable for an internal team tool. Tighten later with Supabase Auth if needed.
create policy "allow all negotiation_rows" on negotiation_rows
  for all using (true) with check (true);

create policy "allow all app_state" on app_state
  for all using (true) with check (true);

-- Enable realtime so all users see live updates instantly
alter publication supabase_realtime add table negotiation_rows;
alter publication supabase_realtime add table app_state;
