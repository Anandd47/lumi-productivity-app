-- The admin-users Edge Function only reads membership to authorize requests.
-- Keep all client roles unprivileged and grant the server role SELECT only.
revoke all on table public.lumi_admin_users from public, anon, authenticated, service_role;
grant select on table public.lumi_admin_users to service_role;
