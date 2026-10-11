-- Game sessions table
create table if not exists game_sessions (
  pin text primary key,
  called_numbers integer[] default '{}',
  status text default 'active',
  created_at timestamptz default now()
);

-- Claims table
create table if not exists game_claims (
  id uuid primary key default gen_random_uuid(),
  pin text not null,
  player_name text not null,
  claim_type text not null,
  ts bigint not null,
  created_at timestamptz default now()
);

-- Enable row level security but allow all for anon key
alter table game_sessions enable row level security;
alter table game_claims enable row level security;

create policy "allow all on game_sessions" on game_sessions for all using (true) with check (true);
create policy "allow all on game_claims" on game_claims for all using (true) with check (true);
