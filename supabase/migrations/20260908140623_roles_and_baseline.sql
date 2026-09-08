-- T3-m1-data-core §2.3/§2.4/§2.5: roles FIRST (before any function or
-- policy names them), then the deny-by-default grants baseline, then the
-- JWT-claim helpers every SECURITY DEFINER body reads.
--
-- Role creation is guarded with IF NOT EXISTS because roles are
-- cluster-level: `supabase db reset` recreates the database but not the
-- roles, so an unguarded CREATE ROLE would fail the second reset.
--
-- Passwords: the Supabase CLI applies migrations over its own connection
-- (no psql variable substitution), so the four LOGIN roles are created
-- with a clearly named LOCAL-DEV-ONLY constant password. Production
-- rotates them with `ALTER ROLE ... PASSWORD` outside migrations; the
-- matching *_DB_URL entries live in .env, never in this file's callers.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'schema_owner_internal') then
    -- BYPASSRLS: SECURITY DEFINER bodies run as this role; it is NOT the
    -- table owner, so without the attribute RLS (deny-by-default, no
    -- policy names it) would silence every read inside the guarded
    -- functions. Its table GRANTs (§2.4) remain the least-privilege
    -- boundary — bypassing RLS grants nothing a GRANT did not.
    create role schema_owner_internal nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'orchestrator') then
    create role orchestrator login password 'local-dev-only-orchestrator' noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'payload_reader') then
    create role payload_reader login password 'local-dev-only-payload_reader' noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'casual_writer') then
    create role casual_writer login password 'local-dev-only-casual_writer' noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'ref_writer') then
    create role ref_writer login password 'local-dev-only-ref_writer' noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'scorecard_reader') then
    create role scorecard_reader nologin noinherit;
  end if;
end $$;

-- The migration runner (postgres) must be able to ALTER ... OWNER TO
-- schema_owner_internal; membership (with admin option, PG16+) is what
-- permits that for a non-superuser runner.
grant schema_owner_internal to postgres;

grant create on schema public to schema_owner_internal; -- required to become owner of objects in public
grant usage on schema public to schema_owner_internal, orchestrator, payload_reader,
  casual_writer, ref_writer, scorecard_reader;
grant usage on schema extensions to schema_owner_internal, casual_writer, orchestrator;

-- §2.3 deny-by-default baseline (this database is empty of our tables at
-- this point; the default-privilege lines are what bind every table and
-- function the following migrations create).
revoke all on all tables in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from public, anon, authenticated;
revoke execute on all functions in schema public from public;
alter default privileges in schema public revoke execute on functions from public;
-- Supabase also installs default privileges granting anon/authenticated/
-- service_role on new public objects FOR the postgres role; retract those
-- so a new table/function is reachable only through an explicit grant.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, service_role;

-- JWT-claim helpers (VERIFY-AT-EXECUTION finding): auth.uid()/auth.jwt()
-- live in schema `auth`, whose USAGE is granted only to anon/
-- authenticated/service_role/postgres and cannot be re-granted by the
-- migration runner. A SECURITY DEFINER body running as
-- schema_owner_internal therefore cannot call them. These two read the
-- same `request.jwt.claims` setting PostgREST/GoTrue populate, so the
-- functions below see exactly what auth.uid()/auth.jwt() would.
create function jwt_uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;
create function jwt_email() returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email'
  );
$$;
revoke execute on function jwt_uid(), jwt_email() from public;
grant execute on function jwt_uid(), jwt_email() to authenticated, anon, schema_owner_internal;
