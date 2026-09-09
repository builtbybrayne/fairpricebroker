-- 9 Sep 2026 (operator ruling): a recruitment check is for a ROLE and admits
-- many candidates, distinguished by email. A role holds the client budget
-- once; each candidate is still one invited session (engine, payload and
-- blindness rules unchanged), joined to its role here. Nothing below is
-- reachable by the internal roles; the recruiter reads and writes their own
-- roles through RLS on the request-scoped client.

create table roles (
  id uuid primary key default gen_random_uuid(),
  creator_auth_uid uuid not null default auth.uid(),
  title text not null check (length(trim(title)) between 1 and 120),
  currency text not null,
  -- the client budget, set once and copied into each candidate's session
  v1 numeric, v2 numeric, v3 numeric, v4 numeric,
  check (
    (v1 is null and v2 is null and v3 is null and v4 is null)
    or (v1 > 0 and v1 < v2 and v2 < v3 and v3 < v4)
  ),
  created_at timestamptz not null default now()
);
alter table roles enable row level security;
grant select, insert (title, currency, v1, v2, v3, v4), update (title, v1, v2, v3, v4)
  on roles to authenticated;
create policy roles_own_select on roles
  for select to authenticated using (creator_auth_uid = auth.uid());
create policy roles_own_insert on roles
  for insert to authenticated with check (creator_auth_uid = auth.uid());
create policy roles_own_update on roles
  for update to authenticated
  using (creator_auth_uid = auth.uid()) with check (creator_auth_uid = auth.uid());

create table role_candidates (
  role_id uuid not null references roles(id),
  session_id uuid not null references sessions(id) unique,
  email text not null,
  created_at timestamptz not null default now(),
  primary key (role_id, session_id),
  unique (role_id, email)
);
alter table role_candidates enable row level security;
grant select, insert on role_candidates to authenticated;
create policy role_candidates_select on role_candidates
  for select to authenticated using (
    exists (select 1 from roles r where r.id = role_id and r.creator_auth_uid = auth.uid())
  );
-- Only the role's owner may attach a session, and only one they host.
create policy role_candidates_insert on role_candidates
  for insert to authenticated with check (
    exists (select 1 from roles r where r.id = role_id and r.creator_auth_uid = auth.uid())
    and is_session_host(session_id)
  );
