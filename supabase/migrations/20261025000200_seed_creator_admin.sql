-- Seed the one initial Lumi creator by immutable Supabase Auth user ID.
-- Apply only after 20261025000100_admin_authorization.sql.
-- This migration intentionally aborts if the Auth user is missing or another
-- admin membership already exists; it never deletes or silently replaces grants.
do $$
declare
  creator_id constant uuid := '14831da5-6f18-4ae3-9e38-ea44c0118deb';
begin
  if not exists (
    select 1
    from auth.users
    where id = creator_id
  ) then
    raise exception 'Lumi creator Auth UUID % does not exist; no membership was granted.', creator_id;
  end if;

  if exists (
    select 1
    from public.lumi_admin_users
    where user_id <> creator_id
  ) then
    raise exception 'Unexpected Lumi admin membership exists; review the membership table before seeding the initial creator.';
  end if;

  insert into public.lumi_admin_users (user_id)
  values (creator_id)
  on conflict (user_id) do nothing;
end
$$;
