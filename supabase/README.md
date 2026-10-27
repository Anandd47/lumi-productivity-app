# Lumi Supabase foundation

This directory contains Lumi's Supabase schema and additive migrations. Authentication is active. Signed-in task reads and writes use the Supabase `tasks` table and dated completion arrays in `daily_logs`; local tasks can be uploaded only after an explicit preview/confirmation. Habits, study sessions, sleep, health, settings, and their other dated records remain in IndexedDB and are not synced.

## Project setup

1. Create a Supabase project and keep its database password in a password manager.
2. In the Supabase SQL Editor, review and apply `migrations/20261021000100_multi_user_foundation.sql`.
3. Apply `migrations/20261022000100_profiles_self_insert_policy.sql` to allow an authenticated user to create only their own profile row if the signup trigger did not create it. This is an additive follow-up; do not rerun the foundation migration against an existing project.
4. Apply `migrations/20261022000200_task_write_functions.sql` to enable atomic, authenticated task writes and completion updates. These functions derive the owner from `auth.uid()` and remain subject to RLS.
5. In Authentication settings, configure the production Site URL and allowed redirect URLs. Enable email confirmation and set the password recovery redirect to the deployed Lumi origin.
6. Copy the project URL and **publishable** key from the project Connect dialog into a local `.env` copied from `.env.example`. The browser may use only the publishable key; never add a secret/service-role key to Vite variables.
7. Restart Vite after changing environment values.

The foundation SQL creates per-user tables with RLS policies based on `auth.uid()`, and creates a profile/settings row when Supabase Auth creates a user. The task RPC migration uses caller permissions and RLS, deriving ownership from `auth.uid()`. It intentionally does not establish a creator/admin. Other categories still need generated database types and repositories that map Lumi's camelCase IndexedDB records to these SQL columns before they are cloud-backed.

## Local data migration and sync

Do not migrate by replacing cloud rows. A future import flow should show a per-category preview and explicit opt-in for sleep and health records, snapshot and validate local IndexedDB data using Lumi's existing backup validator, then insert with the user's stable record IDs. It should detect same-ID/different-content conflicts, report partial failures by category, and retain the local records until the user explicitly chooses otherwise. Account switching must keep local caches separated by authenticated user ID. None of these migration/sync behaviors are implemented by this schema alone.

## Administration

No admin role or client-side admin bypass is defined here. Creator privileges must be provisioned by a trusted operator through a server-only role mechanism. User search, disable, or deletion must be exposed through a server-side function that verifies role membership and protects the last administrator; never use the publishable key with a service-role credential in the browser.
