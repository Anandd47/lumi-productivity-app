-- Allow an authenticated user to create only their own profile row.
-- This supports first-login profile initialization while preserving RLS.
drop policy if exists profiles_insert_self on public.profiles;

create policy profiles_insert_self
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);
