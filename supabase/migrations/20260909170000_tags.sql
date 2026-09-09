-- 9 Sep 2026 (operator): recruiters tag candidates with tags they invent.
-- Tags belong to a vertical and to an OWNER whose kind is typed so an
-- organisation can own a collection later; 'user' is the only kind for
-- now (owner_id = the auth uid).
create table tags (
  id uuid primary key default gen_random_uuid(),
  owner_kind text not null default 'user' check (owner_kind in ('user')),
  owner_id uuid not null default auth.uid(),
  vertical text not null,
  name text not null check (length(trim(name)) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (owner_kind, owner_id, vertical, name)
);
alter table tags enable row level security;
grant select, insert (vertical, name), delete on tags to authenticated;
create policy tags_own on tags for all to authenticated
  using (owner_kind = 'user' and owner_id = auth.uid())
  with check (owner_kind = 'user' and owner_id = auth.uid());

create table candidate_tags (
  session_id uuid not null references sessions(id),
  tag_id uuid not null references tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, tag_id)
);
alter table candidate_tags enable row level security;
grant select, insert, delete on candidate_tags to authenticated;
create policy candidate_tags_own on candidate_tags for all to authenticated
  using (
    exists (select 1 from tags t where t.id = tag_id and t.owner_kind = 'user' and t.owner_id = auth.uid())
    and is_session_host(session_id)
  )
  with check (
    exists (select 1 from tags t where t.id = tag_id and t.owner_kind = 'user' and t.owner_id = auth.uid())
    and is_session_host(session_id)
  );
