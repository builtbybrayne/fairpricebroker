---
id: T3-m1-platform-resilience
plan_kind: thematic
tier: 3
t2_parent: T2-platform
milestone: M1-working-instrument
status: draft
---

# T3 — M1 platform, resilience lane: error tracking, health + uptime, backups + restore, spend caps

## 0. Human summary (plain language)

**Four boring safety nets, all free.** When the site breaks we hear about
it — but the error tracker is only ever allowed to see *where* it broke,
never anyone's numbers, email or link. A robot checks every few minutes
that the site is up. Every night an encrypted copy of the database goes to
a storage bucket we own, and once before launch we prove we can bring it
back. Every account we use has its "no surprise bill" switch on.

> Parent: `T2-platform` (§2 principles 5, 6, 8; §3 component 5; §4 leakage
> fixtures + backup drill; §6 R4). Milestone: `M1-working-instrument` §2
> item 7; §4 DoD item 5. Depends on: `T3-m1-platform-hosting` (§2 facts;
> §3.2 prod still TO DO — the pipeline is proven against dev, then
> re-pointed); `T3-m1-data-core` §2.9 (dump/encrypt construction,
> `AGE_RECIPIENT`; not yet built — no `nightlyJob.ts`, no `scripts/`);
> `T2-data-layer` §2.8–§2.9 (dump interface, tombstone replay).

## 1. Why this shape

- **The tracker is bound, not trusted** (T2-platform §2.5): one module
  owns the SDK, an allowlist scrubber sits on egress, bodies/headers/
  cookies/breadcrumbs are never captured — fenced by a static importer
  test and a leakage fixture, as `src/lib/server/auth/serviceRoleKey.test.ts`
  fences the service-role key.
- **Supabase Free has no backups** — no PITR, no dumps, no spend cap. The
  product dumps itself (§2.6), so the runner must have `pg_dump`; a Vercel
  function does not (no binary, 10 s Hobby limit — VERIFY AT EXECUTION).
  A GitHub Actions scheduled workflow is recommended (§6 Q1).
- **Migrations are the schema; the dump is data.** Restore = `supabase db
  push`, then load a `--data-only` dump. Small artefact, honest schema.
- **Freshness is a heartbeat:** the dump job pings a heartbeat monitor on
  success; a missed ping is the stale-dump alert (§2.6), no app code.
- **Health says one word** — `ok` or `unavailable` (§3 item 5).

## 2. Environment facts

| | dev | prod |
|---|---|---|
| Supabase | `fairprice-dev`, ref `pdbwlzbwsqiiwpdnwlqi`, Free, eu-west-2 | `fairprice-prod`, ref `lcevwtoeenpkyexqnhzg`, Free, eu-west-2 |
| Vercel | `fairprice-dev` (Hobby) | `fairprice-prod` (Hobby; hosting §3.2) |
| Sentry project | `fairprice-dev` | `fairprice-prod` (one free org) |
| Health URL | `https://fairprice-dev.vercel.app/api/health` | `https://fairprice.broker/api/health` |
| Dump source | session pooler `aws-0-eu-west-2.pooler.supabase.com:5432`, user `postgres.<ref>` | same |
| B2 bucket | `fairprice-backups-dev` (private) | `fairprice-backups-prod` (private) |
| Workflow | `.github/workflows/backup-nightly.yml` in `builtbybrayne/fairpricebroker` | same file, prod secrets |

New env: Vercel `SENTRY_DSN` (per project, Production only; blank = SDK
inert, which is what previews and local get), `ERROR_PROBE_ENABLED` (dev
only). GitHub secrets `BACKUP_DB_URL`, `B2_KEY_ID`, `B2_APPLICATION_KEY`,
`BACKUP_HEARTBEAT_URL`; GitHub *variable* `AGE_RECIPIENT` (public half —
the private half lives only in the operator's password manager). Add
`SENTRY_DSN=` and `ERROR_PROBE_ENABLED=` to `.env.example`.

Division of labour, binding (hosting §2 convention): the agent writes
code, tests, the workflow and dashboard *instructions*; **the operator**
creates every account (Sentry, B2, uptime vendor), sets GitHub secrets,
runs `age-keygen`, runs any `supabase link` / `db push` / `db reset
--linked`, and accepts vendor terms. The agent never sees a secret. No DNS.

Free-plan facts relied on (VERIFY AT EXECUTION, record here): Sentry 5k
errors/month hard quota; B2 10 GB free with "Caps and Alerts"; GitHub
Actions 2,000 min/month private, spending limit defaults to $0; Supabase
Free pauses after seven idle days; Vercel Hobby hard limits, no overage.

## 3. Files and steps

### 3.1 Error tracking under the scrubbing contract

1. `npm i @sentry/sveltekit` (current major; pin in `package-lock.json`).
   Server-side only at M1: no `hooks.client.ts`, no source-map plugin in
   `vite.config.ts` (§6 Q5).
2. **`src/lib/server/observability/scrub.ts`** — pure, SDK-free.
   `scrubEvent(event)` rebuilds the event from an allowlist: `event_id`,
   `timestamp`, `level`, `platform`, `environment`, `release`,
   `exception.values[].{type, value→scrubText, stacktrace.frames[].
   {filename, function, lineno, colno, in_app}}` (no `vars`, no context
   lines), `tags.{route_id, method, status}`. Everything else — `request`,
   `user`, `breadcrumbs`, `contexts`, `extra`, unknown keys — is dropped.
   `scrubText` replaces emails with `<email>`, digit runs (with `.`/`,`)
   with `<n>`, 20+ char `[A-Za-z0-9_-]` tokens with `<token>`; cuts at 512.
3. **`src/lib/server/observability/errorTracker.ts`** — the ONLY importer
   of `@sentry/sveltekit`. Module top: `Sentry.init({ dsn: env.SENTRY_DSN
   || undefined, environment, sendDefaultPii: false, tracesSampleRate: 0,
   maxValueLength: 512, beforeBreadcrumb: () => null, beforeSend:
   scrubEvent, integrations: (d) => d.filter((i) => i.name !==
   'RequestData') })`. Exports `errorTrackingHandle` (wraps
   `Sentry.sentryHandle()`) and `handleError` (wraps
   `handleErrorWithSentry`, returning `{ message: 'Something went wrong' }`
   to the browser). `route_id` = `event.route.id` (`/join/[token]`, the
   pattern, never the URL).
4. **`src/hooks.server.ts`** — `handle = sequence(errorTrackingHandle,
   supabaseHandle)` via `@sveltejs/kit/hooks`, `supabaseHandle` being the
   current body; re-export `handleError` from `errorTracker`.
5. **`src/routes/api/_probe/error/+server.ts`** — `POST {marker}` throws
   `Error('probe ' + marker + ' 12345.67 a@b.co')` only when
   `ERROR_PROBE_ENABLED === 'true'`; otherwise 404. Never set on prod.
6. Tests: `scrub.test.ts` (§5 V2); `sentryImport.test.ts` (§5 V1) —
   `grep -rl "@sentry/" src`, drop `*.test.ts`, expect exactly
   `['src/lib/server/observability/errorTracker.ts']`.
7. Operator: Sentry org + two projects, spike protection on, each DSN into
   its Vercel project's Production env only; accept Sentry's DPA (§6 Q5).

### 3.2 Health route + external uptime

1. **`src/routes/api/health/+server.ts`** — `GET`: `select 1` on
   `roleDb('payload_reader')` (`src/lib/server/data/db.ts`) raced against
   a 2 s timeout. 200 `{"status":"ok"}` or 503 `{"status":"unavailable"}`;
   `Cache-Control: no-store`; no other keys, ever. The probe also keeps
   Supabase Free from idle-pausing the project.
2. `health.test.ts`: body keys are exactly `['status']` on both branches
   (inject a failing `sql` stub).
3. Operator: uptime vendor (§6 Q4) — two HTTP monitors on the §2 health
   URLs (expect 200, 3–5 min) and one heartbeat monitor
   `backup-nightly-prod`, 26 h grace, alerts to the operator's inbox; the
   heartbeat URL becomes GitHub secret `BACKUP_HEARTBEAT_URL`.

### 3.3 Backup pipeline + restore rehearsal

1. **`scripts/backup-dump.sh`** (the hosted form of data-core §2.9 step 3):
   `set -euo pipefail`; needs `BACKUP_DB_URL`, `AGE_RECIPIENT`, `OUT_DIR`.
   `pg_dump "$BACKUP_DB_URL" --data-only --schema=public --schema=auth
   --no-owner --no-privileges | tee >(wc -c > "$OUT_DIR/.bytes") | age -r
   "$AGE_RECIPIENT" -o "$part"`; check both `PIPESTATUS`; refuse if
   `.bytes` < 1024; atomic `mv` to `fairprice-dump-<UTC date>.sql.age`;
   `trap` removes `.part`. Second artefact: `psql -c "\copy (select * from
   purge_tombstone_log) to stdout csv header" | age …` →
   `tombstones-<date>.csv.age`. Plaintext never touches disk. VERIFY AT
   EXECUTION: `auth.users` rows present (`identities.auth_user_id` needs
   them); `select version()` on the source — `pg_dump` major must be ≥ it.
2. **`.github/workflows/backup-nightly.yml`** — `schedule: '17 2 * * *'`
   + `workflow_dispatch` (input `target: dev|prod`). Steps: apt-install
   `postgresql-client-<major>` (PGDG) and `age`; run the script; `b2 file
   upload fairprice-backups-<target> <file> <target>/<date>/<file>` for
   both artefacts; on success `curl -fsS "$BACKUP_HEARTBEAT_URL"`. About
   2 min/day. Session pooler (5432) because runners are IPv4-only and the
   direct host is IPv6; the transaction pooler cannot serve `pg_dump`.
3. Operator: B2 account; two private buckets; per-bucket application key
   with `listBuckets, listFiles, writeFiles` only (no read, no delete — a
   leaked CI key can neither exfiltrate nor destroy); lifecycle "keep only
   last version, delete 30 days after upload" (§6 Q3 — matches the 30-day
   PII sweeper, T2-data-layer §2.8, so purged identity ages out of every
   copy); `age-keygen` → public half to the repo variable, private half to
   the password manager; §2 secrets. `BACKUP_DB_URL` points at dev until
   hosting §3.2 lands — re-pointing is a secret edit, not a code change.
4. **`scripts/replay-tombstones.ts`** (`npx tsx`): reads a decrypted
   tombstone CSV; for each `identity_id` not yet purged in the restored DB
   applies the data-core §2.2 placeholder (`email`/`display_name` →
   placeholder, `purged_at` set, that identity's `invites.email` nulled)
   and upserts the tombstone with `replayed_on_restore_at = now()`.
   Idempotent. No erasure routine writes tombstones yet (data-core §3), so
   the rehearsal seeds one synthetic row (§5 V7).
5. **Restore rehearsal** (`docs/runbooks/restore.md`; agent writes,
   operator runs, clock starts at a):
   a. `b2 ls` → download the newest dump and tombstone artefacts.
   b. Target per §6 Q2: dry run on local `supabase start`; binding run on
      `fairprice-dev` after `supabase link --project-ref
      pdbwlzbwsqiiwpdnwlqi && supabase db reset --linked` (wipes dev,
      re-applies `supabase/migrations/`).
   c. `age -d -i <private key> <dump> | psql "$TARGET_DB_URL" -v
      ON_ERROR_STOP=1 --single-transaction`.
   d. `age -d … <tombstones> > /tmp/t.csv && npx tsx
      scripts/replay-tombstones.ts /tmp/t.csv`.
   e. Smoke: row counts of `reconciliations`, `identities`, `events` equal
      the source's at dump time; `POST /api/casual/reconcile` on the
      restored environment returns `ok`.
   f. `rm /tmp/t.csv`; stop the clock; record RPO/RTO in §5 V7.

### 3.4 Spend caps and billing alerts

Operator, ticked as a dated checklist here at verification. Supabase Free:
no spend-cap control exists (Pro feature); protection = hard quotas and no
card on file. Vercel Hobby: hard limits, no overage; enable usage
notifications. Sentry: 5k/month hard quota, spike protection on, per-key
rate limit 100/min. B2 "Caps and Alerts": daily download/transaction caps
at the free allowance, alerts at 80 %. GitHub: Actions spending limit
stays $0. Uptime vendor: free plan, no card. Anything crossing £10/month
is an operator decision (§2.8).

## 4. Out of scope

Client SDK and source maps (§6 Q5); traces, performance, log shipping;
the erasure routine and PII sweeper that *write* tombstones; PITR;
scheduled dev backups (dev is a `workflow_dispatch` target only);
scorecard dump-age queries (the heartbeat is M1's freshness check); Umami;
email; anything under `src/lib/server/engine/` or the authorisation
matrix. Vercel cron (`vercel.json` `crons`): considered, not used — Hobby
allows daily crons but a 10 s function has nothing to run for a dump.

## 5. Verification (binding)

- **V1** static: `sentryImport.test.ts` — the only non-test file under
  `src/` importing `@sentry/` is `errorTracker.ts`.
- **V2** leakage fixture: `scrub.test.ts` passes a synthetic event carrying
  `alice@example.com`, `42000`, `37,500.50`, a 32-char invite token, a
  JWT-shaped string, a cookie header and a JSON body through `scrubEvent`;
  the stringified output contains none of them and only allowlisted keys.
- **V3** live probe on dev: `POST /api/_probe/error` with a seeded marker
  → one Sentry event whose downloaded JSON contains neither marker, email
  nor number; `tags.route_id` = `/api/_probe/error`. Same POST on prod →
  404. Record the event id here.
- **V4** health: `curl -si` on dev → 200, body exactly `{"status":"ok"}`,
  `cache-control: no-store`; `health.test.ts` proves the 503 branch has
  the same single key.
- **V5** uptime: both HTTP monitors green; the vendor's test alert lands
  in the operator's inbox.
- **V6** backup: a dispatch run against dev is green; `b2 ls` shows both
  artefacts under today's prefix, dump > 1 KB; heartbeat shows a ping.
  Negative: a run with a broken `BACKUP_DB_URL` (operator edits, then
  restores) is red, uploads nothing, and the heartbeat alerts after grace.
- **V7** restore (DoD item 5): §3.3 step 5 completed with one synthetic
  tombstone seeded before the dump; afterwards that identity's email is
  the placeholder and `replayed_on_restore_at` is set; RPO ≤ 24 h, RTO ≤
  1 working day, values and date recorded here.
- **V8** spend caps: §3.4 checklist ticked with a dated note per vendor.
- PASS: `npm run lint && npm run check && npm run test:unit -- --run`
  exit 0 with V1, V2, V4 named; V3, V5–V8 are dated entries in this file.

## 6. Open questions (HITL)

- **Q1 — dump runner.** GitHub Actions (recommended: real `pg_dump`, free
  minutes, secrets already a GitHub concept) vs a Supabase Edge Function
  on `pg_cron` (Deno, no `pg_dump`, hand-rolled export of unproven restore
  fidelity). Needs a ruling: it puts prod DB credentials in GitHub.
- **Q2 — rehearsal target.** Free caps the org at two projects, both
  taken. Recommended: local dry run, then `fairprice-dev` reset as the
  binding rehearsal (wipes dev). Alternative: a temporary project on a
  second free org, deleted after.
- **Q3 — retention.** 30 days in B2, aligned to the PII sweeper.
  Recommend 30.
- **Q4 — uptime vendor.** Better Stack free (HTTP + heartbeat in one) vs
  UptimeRobot + healthchecks.io. Recommend Better Stack if its free plan
  still includes heartbeats at execution.
- **Q5 — Sentry as processor, and scope.** Sentry (free, SvelteKit SDK,
  DPA) vs self-hosted/lighter; client SDK + source maps at M1 or M2.
  Recommend Sentry, server-only at M1.
- **Q6 — dump credential.** `postgres.<ref>` via session pooler (works,
  broad) vs a `backup_reader` LOGIN role with `pg_read_all_data` (VERIFY
  Supabase's `postgres` can grant it). Recommend `postgres` for the first
  green run, the dedicated role before launch.

## 7. Deviations (binding)

- **D1-resilience:** data-core §2.9's decrypt self-check needs the private
  `age` key on the runner; this brief keeps that key out of CI and
  substitutes an in-memory byte-count gate plus the rehearsed restore as
  the proof of decryptability.
- **D2-resilience:** data-core's `scripts/nightly-job.ts` stays the local
  skeleton; the hosted dump is `scripts/backup-dump.sh` under the
  workflow. Two entry points, one construction (pipe → `age` → atomic mv).
- **D3-resilience:** T2-data-layer §2.9 names one artefact per day; this
  brief adds a tiny tombstone artefact so a restore can replay purges that
  happened after the dump it restores from.
