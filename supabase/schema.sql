create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  sleep numeric(4, 1) not null check (sleep between 0 and 24),
  water integer not null check (water >= 0),
  steps integer not null check (steps >= 0),
  screen_time numeric(4, 1) not null check (screen_time between 0 and 24),
  mood text not null check (mood in ('Great', 'Good', 'Okay', 'Low', 'Stressed')),
  energy smallint not null check (energy between 1 and 10),
  stress smallint not null check (stress between 1 and 10),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  sleep numeric(4, 1) not null check (sleep between 0 and 24),
  water integer not null check (water >= 0),
  steps integer not null check (steps >= 0),
  screen_time numeric(4, 1) not null check (screen_time between 0 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.checkins enable row level security;
alter table public.goals enable row level security;

grant select, insert, update, delete on public.checkins to authenticated;
grant select, insert, update, delete on public.goals to authenticated;

drop policy if exists "Users manage their own checkins" on public.checkins;
create policy "Users manage their own checkins"
  on public.checkins
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage their own goals" on public.goals;
create policy "Users manage their own goals"
  on public.goals
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);