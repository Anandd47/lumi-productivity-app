-- Lumi multi-user foundation. Apply only to a new Supabase project after review.
-- User data is private by default: every app table is keyed to auth.uid() and has RLS.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 48),
  avatar_color text not null default 'orange' check (avatar_color in ('orange', 'violet', 'blue', 'rose')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  time text not null check (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  local_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_user_date_idx on public.tasks (user_id, local_date);

create table if not exists public.habits (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 48),
  icon text not null,
  color text not null check (color in ('orange', 'violet', 'blue')),
  target_per_week smallint not null check (target_per_week between 1 and 7),
  kind text not null check (kind in ('core', 'optional')),
  created_on date not null,
  archived_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (archived_on is null or archived_on >= created_on)
);
create index if not exists habits_user_created_idx on public.habits (user_id, created_on);

create table if not exists public.daily_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  completed_habit_ids uuid[] not null default '{}',
  completed_task_ids uuid[] not null default '{}',
  focus_minutes integer not null default 0 check (focus_minutes >= 0),
  study_minutes integer not null default 0 check (study_minutes >= 0),
  sleep_minutes integer check (sleep_minutes is null or sleep_minutes >= 0),
  health_checks integer not null default 0 check (health_checks >= 0),
  completed_priority_ids text[] not null default '{}',
  note text,
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

create table if not exists public.grace_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  used_on date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, month),
  check (date_trunc('month', used_on)::date = month)
);

create table if not exists public.focus_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  subject text not null default 'General',
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds > 0),
  kind text not null check (kind in ('pomodoro', 'countdown', 'stopwatch')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at > started_at)
);
create index if not exists focus_sessions_user_date_idx on public.focus_sessions (user_id, local_date);

create table if not exists public.timer_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  study_target_seconds integer not null default 21600 check (study_target_seconds between 3600 and 86400),
  sleep_target_minutes integer not null default 480 check (sleep_target_minutes between 60 and 1440),
  water_goal_glasses integer not null default 8 check (water_goal_glasses between 1 and 30),
  notification_preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(notification_preferences) = 'object'),
  updated_at timestamptz not null default now()
);

create table if not exists public.sleep_records (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  start_time text not null check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  wake_time text not null check (wake_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_date),
  check (ended_at > started_at)
);
create index if not exists sleep_records_user_date_idx on public.sleep_records (user_id, local_date desc);

create table if not exists public.water_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  glasses integer not null check (glasses between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists water_entries_user_date_idx on public.water_entries (user_id, local_date desc);

create table if not exists public.activity_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  activity_type text not null check (activity_type in ('Walking', 'Running', 'Cycling', 'Strength training', 'Yoga', 'Other')),
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists activity_entries_user_date_idx on public.activity_entries (user_id, local_date desc);

-- Profiles are created by a trusted trigger. Clients can update only their own
-- display fields; account IDs, role grants, and administrative state are absent.
create or replace function public.create_lumi_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  insert into public.app_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_lumi_user_created on auth.users;
create trigger on_lumi_user_created
  after insert on auth.users
  for each row execute function public.create_lumi_profile();

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.habits enable row level security;
alter table public.daily_logs enable row level security;
alter table public.grace_days enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.timer_states enable row level security;
alter table public.app_settings enable row level security;
alter table public.sleep_records enable row level security;
alter table public.water_entries enable row level security;
alter table public.activity_entries enable row level security;

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists tasks_manage_self on public.tasks;
create policy tasks_manage_self on public.tasks for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists habits_manage_self on public.habits;
create policy habits_manage_self on public.habits for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists daily_logs_manage_self on public.daily_logs;
create policy daily_logs_manage_self on public.daily_logs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists grace_days_manage_self on public.grace_days;
create policy grace_days_manage_self on public.grace_days for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists focus_sessions_manage_self on public.focus_sessions;
create policy focus_sessions_manage_self on public.focus_sessions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists timer_states_manage_self on public.timer_states;
create policy timer_states_manage_self on public.timer_states for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists app_settings_manage_self on public.app_settings;
create policy app_settings_manage_self on public.app_settings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists sleep_records_manage_self on public.sleep_records;
create policy sleep_records_manage_self on public.sleep_records for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists water_entries_manage_self on public.water_entries;
create policy water_entries_manage_self on public.water_entries for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists activity_entries_manage_self on public.activity_entries;
create policy activity_entries_manage_self on public.activity_entries for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- No admin role is granted here. Admin privileges and user-management APIs must
-- be added only after deploying a trusted server-side authorization boundary.
