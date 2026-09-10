---
id: T3-m1-platform-hosting
plan_kind: thematic
tier: 3
t2_parent: T2-platform
milestone: M1-working-instrument
status: draft
---

# T3 — M1 platform, hosting lane: dev and prod environments on Supabase + Vercel

## 0. Human summary (plain language)

**Put the site on the internet twice: once for trying things (dev), once
for real people (prod), kept completely apart.** The dev half went live on
10 Sep 2026 at fairprice-dev.vercel.app. This plan records how that was
done and what is left to do for prod and the real domain.

> Parent: `T2-platform` (§2 principle 9 environments; principle 8 cost
> ceiling; principle 4 deny-by-default roles). Milestone:
> `M1-working-instrument` items 1 and 7. Depends on: `T3-m1-scaffold`
> (adapter-vercel, `.env.example`), `T3-m1-data-core` (the four LOGIN roles
> and their local-dev passwords), `T3-m1-platform-naive-auth` (preview
> sign-in, Deviation D2).
>
> **Drafted retrospectively, 10 Sep 2026.** `T3-m1-scaffold` §4 left
> "Vercel/Supabase-cloud/domain wiring" as "a separate, later step" and no
> plan was ever written for it. The dev environment was built in-session
> on 10 Sep before this plan existed; §3 marks what is already done. The
> operator's ruling that this should have been planned first stands, and
> this document is the correction.

## 1. Why this shape

- **Two of everything** (operator ruling, 10 Sep 2026): a dev Supabase
  project + a dev Vercel project, and a prod Supabase project + a prod
  Vercel project. Staging work must never be able to touch real users'
  rows. One Vercel project with environment-scoped variables was
  considered and rejected: a mis-scoped variable is one click from prod.
- **Branches are the switch:** `main` deploys the dev site; a `prod`
  branch deploys the live site. Landing on `prod` is a deliberate act.
- **Credential isolation** (T2-platform §2.9): each Vercel project holds
  only its own Supabase project's secrets. Branch previews on the dev
  project use dev secrets; the prod project never receives dev secrets
  and vice versa.
- **The four LOGIN roles keep their per-role passwords in production**
  (T3-m1-data-core §2.5). Migrations create them with the local-dev
  constants; the hosted step rotates them once, outside migrations, with
  `ALTER ROLE … PASSWORD`, then builds the per-role connection strings.
- **Serverless needs the pooler.** Vercel functions connect through
  Supabase's transaction pooler (port 6543, user `<role>.<project-ref>`),
  never the direct port, and postgres-js runs with `prepare: false`
  because that pooler rejects named prepared statements.

## 2. Environment facts

| | dev | prod |
|---|---|---|
| Supabase project | `fairprice-dev`, ref `pdbwlzbwsqiiwpdnwlqi` | `fairprice-prod`, ref `lcevwtoeenpkyexqnhzg` |
| Region / plan | eu-west-2 (London) / Free | eu-west-2 (London) / Free |
| Supabase org | Fair Price Broker | Fair Price Broker |
| Vercel project | `fairprice-dev` (team `whaley-bear`, Hobby) | `fairprice-prod` (to create) |
| Deploys from | `main` | `prod` (to create) |
| URL | https://fairprice-dev.vercel.app | https://fairprice.broker (to attach) |
| Pooler host | `aws-0-eu-west-2.pooler.supabase.com:6543` | same |
| `PREVIEW_SIGNIN_ALLOWLIST` | `*@fairprice.broker` | operator decides; blank closes `/signin` |

Nine environment variables per Vercel project: `PUBLIC_SUPABASE_URL`,
`PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`,
`ORCHESTRATOR_DB_URL`, `PAYLOAD_READER_DB_URL`, `CASUAL_WRITER_DB_URL`,
`REF_WRITER_DB_URL`, `PREVIEW_SIGNIN_ALLOWLIST`.

Division of labour, binding: the agent drives dashboards and writes
templates; **the operator** runs `supabase login` / `link` / `db push`,
chooses and enters every password and key, and approves any OAuth grant
(GitHub → Vercel). The agent never sees a secret value.

## 3. Steps

### 3.1 Dev environment — DONE 10 Sep 2026

1. Supabase `fairprice-dev` created; seven migrations pushed
   (`20260910000001..7`); four role passwords rotated.
2. `/signin` gated by `PREVIEW_SIGNIN_ALLOWLIST` (`signinGate.ts`; full
   addresses or `*@domain`; `*` opens, blank closes). `/join` untouched
   (Deviation D1 stands). `db.ts` pools use `prepare: false`.
3. Vercel `fairprice-dev` imported from `builtbybrayne/fairpricebroker`,
   nine variables set for Production + Preview, first deploy green from
   `92a4898`.
4. Smoke on the live URL: homepage renders; `POST /api/casual/reconcile`
   returns a result and records its completion (proves pooler + rotated
   roles); `/signin` returns 403 for an address outside the allowlist.

### 3.2 Prod environment — TO DO

1. Create branch `prod` from the `main` commit the operator chooses.
2. Operator: `supabase link --project-ref lcevwtoeenpkyexqnhzg` then
   `supabase db push`; rotate the four role passwords in the prod SQL
   editor. (Re-link back to dev afterwards, or keep two checkouts.)
3. Vercel `fairprice-prod`: same repo, Production Branch = `prod`, nine
   variables from the prod Supabase project only. `PREVIEW_SIGNIN_ALLOWLIST`
   per operator ruling (recommendation: blank until real auth ships).
4. Attach `fairprice.broker` to `fairprice-prod` (A/CNAME at the
   registrar; Vercel issues TLS). Supabase prod Auth → URL Configuration:
   Site URL `https://fairprice.broker`. (Not load-bearing while sign-in
   is server-minted, but correct before real magic links arrive.)
5. Smoke on prod exactly as §3.1 step 4.

### 3.3 Hygiene — TO DO

- `supabase/config.toml` `project_id` still reads the scaffold worktree
  name; set it to `fairprice` (local-only, cosmetic).
- `package.json` `name` is still `scaffold-tmp`.
- CI: a GitHub Actions workflow running `npm run lint && npm run check &&
  npm run test:unit -- --run` on push (M1 item 1 says CI; Vercel's build
  is not a test run). Unit tests need a Postgres; start with lint + check
  and add the DB job when a service container is wired.
- The empty `WhaleyBear` Supabase org created by accident on 10 Sep may be
  deleted by the operator.

## 4. Out of scope

Email sending, legal pages, error tracking/backups, the agent doorway —
each is its own M1 item and gets its own T3 (inbox items raised 10 Sep
2026). Custom preview databases per branch (Supabase branching) — not
free-tier.

## 5. Verification (binding)

- V1 Each environment's live URL answers `POST /api/casual/reconcile`
  with `ok: true` and a completion row lands in *that* environment's
  `events` (proves role connections through the pooler).
- V2 `/signin` on prod refuses an address outside its allowlist (403), or
  the page shows "closed" when the allowlist is blank.
- V3 The prod Vercel project's variables contain the prod project ref
  only; the dev project's contain the dev ref only (eyeball both
  dashboards; record the check here).
- V4 `git log prod..main` is the only thing separating dev from prod.

## 6. Deviations (binding)

- **D1-hosting:** the dev environment was built before this plan existed
  (10 Sep 2026). Recorded here rather than re-done; the operator's
  standing instruction that work follows accepted plans applies from
  this point.
