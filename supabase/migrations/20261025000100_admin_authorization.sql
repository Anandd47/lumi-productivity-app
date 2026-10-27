-- Server-only authorization list for the read-only Auth user directory.
-- Do not add client policies or place the service-role key in Lumi's frontend.
create table public.lumi_admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null
);

alter table public.lumi_admin_users enable row level security;
revoke all on table public.lumi_admin_users from public, anon, authenticated;
grant select, insert, update, delete on table public.lumi_admin_users to service_role;
