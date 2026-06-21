/*
# Restrict write policies — remove insecure anon write access

## Problem
Tables `paiements` and `virements` had INSERT/UPDATE/DELETE policies with
`USING (true)` / `WITH CHECK (true)` for the `anon` role, meaning any anonymous
internet visitor could insert, modify, or delete syndicate financial records.

## Fix
- DROP all write (INSERT/UPDATE/DELETE) policies for both tables.
- Keep SELECT open to `anon, authenticated` — all syndicate members can read.
- Writes are now entirely blocked for the anon/authenticated client roles.
  The admin Edge Function uses the service-role key (which bypasses RLS) to
  perform writes after validating the admin secret server-side.

## Tables affected
- `public.paiements` — DROP insert/update/delete anon policies
- `public.virements`  — DROP insert/update/delete anon policies

## Security model after this migration
| Operation | Who can do it                                    |
|-----------|--------------------------------------------------|
| SELECT    | anon + authenticated (any syndicate member)      |
| INSERT    | Service-role only (via admin Edge Function)      |
| UPDATE    | Service-role only (via admin Edge Function)      |
| DELETE    | Service-role only (via admin Edge Function)      |
*/

-- paiements: drop insecure write policies
DROP POLICY IF EXISTS "anon_insert_paiements" ON paiements;
DROP POLICY IF EXISTS "anon_update_paiements" ON paiements;
DROP POLICY IF EXISTS "anon_delete_paiements" ON paiements;

-- virements: drop insecure write policies
DROP POLICY IF EXISTS "anon_insert_virements" ON virements;
DROP POLICY IF EXISTS "anon_update_virements" ON virements;
DROP POLICY IF EXISTS "anon_delete_virements" ON virements;
