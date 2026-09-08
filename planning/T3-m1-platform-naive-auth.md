---
id: T3-m1-platform-naive-auth
plan_kind: thematic
tier: 3
t2_parent: T2-platform
milestone: M1-working-instrument
status: active
---

# T3 — M1 platform, naive-auth lane: sign-in, credits, invite delivery without email

## 0. Human summary (plain language)

**Let people sign in and get free credits, without building real login or
sending any email yet.** For this build run, "sign in" means: type your
email, you're in. Invites are links the recruiter copies and sends
themselves. Under the hood we still mint real Supabase sessions, so the
database's who-can-see-what rules work exactly as designed and nothing has
to be rebuilt when proper magic-link email and Google sign-in arrive
later. Everyone signing in gets twenty free launch credits, once.

---

> Parent: `T2-platform` (§2.2 principal contract, §2.3 credit lifecycle,
> §2.7 email). Milestone: `M1-working-instrument` items 5 and 7. Depends
> on: `T3-m1-scaffold` (local Supabase running, `.env` written) and
> `T3-m1-data-core` (the `identities` table and `redeem_invite`).
>
> **Operator ruling (8 Sep 2026, in-chat), scoping this lane:** "naive
> auth workflows and magic-link-based invitations; proper auth and email
> sending deferred." Confirmed: sign-in = type any email, no password, no
> email sent; invite = link shown on screen for the creator to copy and
> send themselves; the invitee opens it, no account needed. Drafted under
> the operator's same-session pre-acceptance of draft plans; council-
> reviewed by Claude sub-agents, no Codex audit.

## 1. Why this shape (and the deviation it records)

T2-platform §2.2 says the invitee principal is "a one-time email-link
principal bound to one role in one session" and `T3-m1-data-core` §1 D1
proves email control with a magic-link OTP before binding. This lane
keeps the **mechanism** (a real Supabase Auth session whose JWT email is
compared in SQL against `invites.email`) and removes only the **proof of
possession**: the server mints the session for the invite's bound email
itself when the link is opened. Consequence, recorded as **Deviation
D1-naive:** a forwarded `/join/{token}` link is redeemable by whoever
holds it. This is the deferred-auth cost the operator accepted; the fix
later is to replace one function (`naiveSignIn`) with a real
magic-link send + verify, nothing else.

## 2. Environment facts

- Supabase local (`npx -y supabase@2.115.0 start`), `.env` carries
  `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`.
- New dependencies (pin resolved versions in `package-lock.json`):
  `@supabase/supabase-js@^2`, `@supabase/ssr@^0.6`.
- The service-role key is used ONLY inside `src/lib/server/auth/` for
  the admin API (`auth.admin.createUser`, `auth.admin.generateLink`).
  No other module imports it. A static test asserts this (§5 V5).

## 3. Files and steps

### 3.1 `src/hooks.server.ts` — per-request Supabase client and session

Per `@supabase/ssr`'s SvelteKit pattern: `createServerClient(url, anonKey,
{ cookies: { getAll, setAll } })` into `event.locals.supabase`;
`event.locals.safeGetSession()` returns `{ session, user }` after
`getUser()` validation (never trust `getSession()` alone). Types in
`src/app.d.ts`. Cookies are `path: '/'`, `sameSite: 'lax'`,
`httpOnly` where the library allows.

### 3.2 `src/lib/server/auth/naiveSignIn.ts`

```typescript
export async function naiveSignIn(
  event: RequestEvent,
  email: string
): Promise<{ userId: string }>;
```
1. Normalise: trim, lowercase; reject anything not matching a plain
   `^[^\s@]+@[^\s@]+\.[^\s@]+$` grammar (400).
2. Admin client (service role): `auth.admin.generateLink({ type:
   'magiclink', email })` — creates the user if absent (Supabase does
   this for magic links; if the pinned GoTrue refuses, call
   `auth.admin.createUser({ email, email_confirm: true })` first —
   **VERIFY AT EXECUTION**, record which path was needed).
3. Take `properties.hashed_token` from the result and, on the
   **request-scoped** client (`event.locals.supabase`, anon key +
   cookies), call `auth.verifyOtp({ token_hash, type: 'magiclink' })`.
   This sets the session cookies for the browser. No email is sent
   because the link is never delivered — it is consumed server-side.
4. Call `ensure_identity()` (§3.4) and `grant_launch_credits()` (§3.5)
   via the request-scoped client (both SECURITY DEFINER, granted to
   `authenticated`).
5. Return the user id.

### 3.3 Routes

- `src/routes/signin/+page.svelte` + `+page.server.ts`: one email field,
  one button ("Continue"), plain copy stating this is a preview sign-in
  with no password. Action calls `naiveSignIn` then redirects to `/app`
  (or `?next=`, same-origin only).
- `src/routes/signout/+server.ts`: POST → `supabase.auth.signOut()` →
  redirect `/`.
- `src/routes/app/+layout.server.ts`: requires a session, else redirect
  to `/signin?next=<path>`; exposes `{ email, identityId, balance }`.

### 3.4 `ensure_identity()` — migration (this brief owns it)

```sql
create function ensure_identity() returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from identities where auth_user_id = auth.uid();
  if v_id is null then
    insert into identities (kind, auth_user_id, email)
    values ('user', auth.uid(), auth.jwt()->>'email') returning id into v_id;
  end if;
  return v_id;
end $$;
revoke execute on function ensure_identity() from public;
grant execute on function ensure_identity() to authenticated;
alter function ensure_identity() owner to schema_owner_internal;
```
Requires `schema_owner_internal` to hold `insert` on `identities`
(data-core §2.4 already grants it).

### 3.5 Launch credits — the platform seam data-core is blocked on

Implements `T2-platform` §2.3's provider-independent credit lifecycle
for the free-launch phase only (promotional grant + reserve-then-debit;
no purchases, no refunds, no org pools).

```sql
create table credit_ledger (
  id bigserial primary key,
  account_identity_id uuid not null references identities(id),
  delta integer not null,
  reason text not null check (reason in ('launch-grant', 'reconciliation-debit', 'release')),
  request_key text not null,
  created_at timestamptz not null default now(),
  unique (account_identity_id, request_key)
);
alter table credit_ledger enable row level security;
create view credit_balances as
  select account_identity_id, coalesce(sum(delta), 0)::integer as balance
  from credit_ledger group by account_identity_id;

create function grant_launch_credits() returns integer
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_bal integer;
begin
  v_id := ensure_identity();
  insert into credit_ledger (account_identity_id, delta, reason, request_key)
  values (v_id, 20, 'launch-grant', 'launch-grant:' || v_id::text)
  on conflict (account_identity_id, request_key) do nothing;
  select balance into v_bal from credit_balances where account_identity_id = v_id;
  return coalesce(v_bal, 0);
end $$;

create function reserve_and_debit_launch_credit(p_request_key text) returns text
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_bal integer; v_existing bigint;
begin
  v_id := ensure_identity();
  perform pg_advisory_xact_lock(hashtextextended(v_id::text, 0));
  select id into v_existing from credit_ledger
    where account_identity_id = v_id and request_key = p_request_key;
  if v_existing is not null then return 'already-debited'; end if;
  select coalesce(sum(delta), 0) into v_bal from credit_ledger where account_identity_id = v_id;
  if v_bal < 1 then raise exception 'insufficient-credits'; end if;
  insert into credit_ledger (account_identity_id, delta, reason, request_key)
  values (v_id, -1, 'reconciliation-debit', p_request_key);
  return 'debited';
end $$;

create function release_launch_credit(p_request_key text) returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  v_id := ensure_identity();
  insert into credit_ledger (account_identity_id, delta, reason, request_key)
  select v_id, 1, 'release', 'release:' || p_request_key
  where exists (select 1 from credit_ledger
                where account_identity_id = v_id and request_key = p_request_key and delta = -1)
  on conflict (account_identity_id, request_key) do nothing;
end $$;
-- revoke from public, grant to authenticated, owner schema_owner_internal for all three;
-- grant select, insert on credit_ledger and select on credit_balances to schema_owner_internal.
```

TypeScript seam, satisfying data-core's declared interface exactly:
`src/lib/server/platform/launchCredits.ts` exports
`reserveAndDebitLaunchCredit(requestKey, accountId)` (calls the RPC on
the request-scoped client; `accountId` is asserted equal to the caller's
`ensure_identity()` result — a mismatch throws), `releaseLaunchCredit`,
and `getBalance`. The session-creation route (T3-m1-recruitment-core)
calls reserve → `create_invited_session` → on failure `release`.

### 3.6 Invite delivery without email

`src/lib/server/platform/inviteDelivery.ts` exports
`buildJoinUrl(origin, plaintextToken)` → `${origin}/join/${token}`. No
provider client exists in this lane; T2-platform §2.7's "only the email
component sends" holds vacuously and the recipient cap is not exercised
(one invite per recruitment session).

### 3.7 `/join/{token}` — naive redemption

`src/routes/join/[token]/+page.server.ts` `load`:
1. Look up the invite by `token_hash = sha256(token)` using a
   SECURITY DEFINER read `invite_preview(p_token text)` returning
   `{ session_id, role, email, email_bound, host_visibility, state,
   redeemable }` (this brief adds the function; it discloses only what
   the invitee is about to be told anyway). Invalid/expired/redeemed →
   render a plain "this link isn't live" page (no session details).
2. If the caller has no session, or has a session for a different
   email: `naiveSignIn(event, invite.email)` (D1-naive).
3. Call `redeem_invite(token)` (data-core §2.5). On `email-mismatch`
   (should not happen after step 2) show the same dead-link page.
4. Redirect to the party surface for that session
   (`/s/{session_id}/party`, owned by T3-m1-recruitment-core).
A second open of the same link after redemption: step 1 reports
`redeemable = false`; if the current session is the redeemer, redirect
to the party surface anyway (re-entry is legitimate); otherwise dead-link.

## 4. Out of scope

Real magic-link email, Google OAuth, account linking, org plumbing,
checkout, refunds, per-account daily caps, complaint webhooks, Umami,
Sentry, uptime, backups. Any change to the engine or to data-core's
authorisation matrix beyond the three grants this brief names.

## 5. Verification

- **V1** — sign in twice with the same email: one `auth.users` row, one
  `identities` row, one `launch-grant` ledger row, balance 20 both times.
- **V2** — `reserve_and_debit_launch_credit('k1')` twice → 'debited' then
  'already-debited', balance 19; after 19 more distinct keys the 21st
  distinct key raises `insufficient-credits`; `release('k1')` restores
  one and is itself idempotent.
- **V3** — `/join/{token}` for a fresh email-bound invite: signs the
  browser in as the invite email, `invites.redeemed_at` set,
  `session_participants` row exists, redirect to the party surface.
  Opening the same link from a second, different browser context after
  redemption shows the dead-link page (not the party surface).
- **V4** — an expired or revoked invite token shows the dead-link page
  and leaves `redeemed_at` null.
- **V5** — static: `grep -rl SUPABASE_SERVICE_ROLE_KEY src/` lists only
  files under `src/lib/server/auth/`.
- PASS: `npm run test:unit -- --run` and `npm run test:e2e` exit 0 with
  V1–V5 named.

## 6. Deviations (binding)

- **D1-naive** (§1): server-minted sessions for invite emails; forwarded
  links redeemable. Supersedes, for this lane only, data-core §1 D1's
  proof-of-possession step. Reverting = replacing `naiveSignIn` in
  `/join` with a real OTP send/verify.
- **D2** — a sign-in that any email address can complete is a preview
  affordance, stated on the sign-in page itself; not a launch surface.
