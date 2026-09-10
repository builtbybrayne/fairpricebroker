---
id: T3-m1-platform-email-invites
plan_kind: thematic
tier: 3
t2_parent: T2-platform
milestone: M1-working-instrument
status: draft
---

# T3 — M1 platform, email lane: sending the invite link from the product domain

## 0. Human summary (plain language)

**Let the person who generated a private link also have us email it, from
fairprice.broker, without losing the copy-and-paste option.** Today the
broker copies each link and sends it themselves. This plan adds a small
"send by email" box beside each link, sent through a transactional
provider on our own domain so it lands in a normal inbox. The server keeps
count: at most 50 recipients per offer, a daily limit per account, and
sending pauses itself if anyone marks us as spam. Opening the link works
exactly as it does now.

> Parent: `T2-platform` (§2.7 email and guardrails; §2.8 cost ceiling;
> §3 component 4; §4 deliverability bullets). Milestone:
> `M1-working-instrument` §2 item 5, §4 DoD 6. Depends on:
> `T3-m1-platform-hosting` (prod + fairprice.broker per its §3.2),
> `T3-m1-platform-naive-auth` (§3.6 copy-link, Deviation D1),
> `T3-m1-data-core` §2.5 (per-role LOGIN connections).

## 1. Why this shape

- **Email is additive** (operator ruling, 10 Sep 2026: the broker always
  needs copy-link). Copy stays; "Send" sits beside it. Minting and
  redemption are untouched.
- **The invite stays unbound; the address is a delivery record.**
  `create_reconciliation` (`20260910000006_guarded_functions.sql` lines
  99–103) keeps `plaintext_token` only for unbound invites, and Copy reads
  that column. Binding to the typed address would null the token and break
  the ruling, so the address lives in a new `invite_sends` table and
  `/join` keeps asking the opener for their email (naive-auth §3.7). Q2.
- **Caps decide in SQL** (T2 §3.4): one function, `invite_send_permit`,
  under an advisory lock; TypeScript only calls it. T2 §2.7's "per
  session" is read as **per offer** — the thing with many recipients.
- **One provider module, one LOGIN role.** The SDK is imported by
  `src/lib/server/email/provider.ts` only, asserted by a static test in the
  shape of `src/lib/server/auth/serviceRoleKey.test.ts`. Sending tables are
  written through a new `email_writer` role via `roleDb`
  (`src/lib/server/data/db.ts`): the webhook has no user session.
- **Resend, free tier** (Q1): 3,000/month, 100/day, one domain, signed
  webhooks, £0. Postmark's free tier is 100/month — one offer half-consumes it.
- **Dev never mails strangers:** `EMAIL_RECIPIENT_ALLOWLIST` (grammar of
  `PREVIEW_SIGNIN_ALLOWLIST`) gates real sends; blank = log only, so dev,
  CI and e2e exercise the whole path without mail.

## 2. Environment facts

- Domain `fairprice.broker`; From `FairPrice <invites@fairprice.broker>`;
  Reply-To the broker's account email (Q6).
- New dependency `resend` (pin in `package-lock.json`); nothing in
  `package.json` sends mail today. No SMTP library, ever.
- New env (add to `.env.example`; set per Vercel project, hosting §2):
  `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM`,
  `EMAIL_RECIPIENT_ALLOWLIST`, `EMAIL_WRITER_DB_URL`.
- Vercel serverless: the send is one HTTP call inside the form action;
  the webhook is a plain `+server.ts`. No worker, no queue (T2 §2.1).
- Migration number `20260911000001` (next after `20260910000007`).

### Operator actions (prerequisites for V7; not agent steps)

1. Create the Resend account (personal-but-transferable until the Newco
   exists, as B2 in T2 §6 R4); add domain `fairprice.broker`.
2. DNS at the registrar as Resend lists them: DKIM TXT under
   `resend._domainkey`; return-path subdomain MX + SPF TXT (default
   `send.fairprice.broker`); `_dmarc` TXT `v=DMARC1; p=quarantine;
   rua=mailto:<operator>` (Q4). Wait for "verified".
3. Separate dev and prod API keys into their own Vercel projects. Register
   webhook `https://<env host>/api/email/events` for `email.delivered`,
   `email.bounced`, `email.complained`; each signing secret into that
   project's `RESEND_WEBHOOK_SECRET`.
4. After `supabase db push`, rotate `email_writer`'s password per hosting
   §3.2 step 2; set `EMAIL_WRITER_DB_URL` (pooler, 6543,
   `email_writer.<project-ref>`).
5. `EMAIL_RECIPIENT_ALLOWLIST`: operator's own addresses on dev; `*` on
   prod once V7 passes.

## 3. Files and steps

### 3.1 `supabase/migrations/20260911000001_invite_email_sends.sql`

1. Role `email_writer` (LOGIN, local-dev constant password, shape of the
   four roles in `20260910000001_db_roles_and_baseline.sql`).
2. `alter table offers add column send_cap integer` — null = default 50;
   an operator raises it by SQL (T2 §3.4's "operator-granted setting").
3. `invite_sends`: `id uuid pk`, `invite_id` → invites, `reconciliation_id`,
   `offer_id` → offers, `account_identity_id` → identities, `to_email text`,
   `status` in (`queued`,`sent`,`failed`,`delivered`,`bounced`,`complained`),
   `provider text default 'resend'`, `provider_message_id text unique`,
   `error text`, `created_at`, `updated_at`. RLS on; `invite_sends_select`
   for `authenticated` using `may_access_offer_of(reconciliation_id,
   'viewer')`. Indexes `(offer_id)`, `(account_identity_id, created_at)`.
4. `email_events` (`provider_event_id text pk`, `provider_message_id`,
   `kind`, `received_at`): the webhook's idempotency ledger.
5. `sending_state` (single row, `id boolean pk default true check (id)`):
   `paused_at`, `paused_reason`, `released_at`, `released_by`. Seed it.
6. `invite_send_permit(p_offer_id uuid, p_account uuid, p_to_email text)
   returns text` — SECURITY DEFINER, owner `schema_owner_internal`, EXECUTE
   to `email_writer` only. `pg_advisory_xact_lock(hashtextextended(
   p_offer_id::text, 0))`; `'paused'` if `paused_at` set and not released
   since; `'offer-cap'` if `count(distinct lower(to_email))` on the offer
   plus this address would exceed `coalesce(send_cap, 50)` (a repeat
   address is not a new recipient); `'daily-cap'` if the account's
   non-failed sends in 24h are at or over 200 (Q3); else `'ok'`.
7. `apply_sending_pause()`: complained ÷ non-failed sends over 30 days;
   if > 0.001, set `paused_at`. SQL comment: at M1 volumes the first
   complaint pauses; release is a manual update (Q5).
8. Grants to `email_writer`: `select` on `invites`, `offers`,
   `reconciliations`, `identities`; `select, insert, update` on the three
   new tables. Nothing on `figures`, `results`, `payloads`.

### 3.2 `src/lib/server/email/provider.ts` — the only provider import

`import { Resend } from 'resend'` here and nowhere else. Exports
`sendEmail({ to, from, replyTo, subject, text, html })` →
`{ ok: true; messageId } | { ok: false; error }` and
`verifyWebhook(rawBody, headers)` → parsed event or null (Svix-style
signature with `RESEND_WEBHOOK_SECRET`; verify at execution whether the SDK
exposes this or `svix` is needed — if so, it is imported here too and
covered by the same test). If `EMAIL_RECIPIENT_ALLOWLIST` does not admit
`to` (reuse `isPreviewSigninAllowed` from `src/lib/server/auth/signinGate.ts`,
a pure matcher), skip Resend: return `ok: true`, `messageId: 'log:<uuid>'`,
`console.info` subject and recipient only. Never log the link.

### 3.3 `src/lib/server/email/templates/inviteEmail.ts`

Pure `inviteEmail({ offerTitle, respondentNoun, joinUrl, brokerEmail,
expiresAt })` → `{ subject, text, html }`. Subject `"{offerTitle}: your
private link"`. Body: who invited you, what the link does (answer once,
privately; the other side never sees your figures), the link, the expiry,
"if you weren't expecting this, ignore it". No figures or amounts. Plain
one-column HTML, inline styles.

### 3.4 `src/lib/server/platform/inviteDelivery.ts` — the send path

Keep `buildJoinUrl`. Add `sendInviteEmail({ offer, reconciliationId,
inviteId, plaintextToken, toEmail, brokerEmail, accountIdentityId, origin })`:
1. `normaliseEmail` (`src/lib/server/auth/naiveSignIn.ts`); invalid →
   `{ ok: false, reason: 'invalid-email' }`.
2. `roleDb('email_writer')`: `select invite_send_permit(...)`; not `'ok'`
   → `{ ok: false, reason }`.
3. Insert `invite_sends` `queued`; `sendEmail` with §3.3 and
   `buildJoinUrl(origin, plaintextToken)`; update to `sent` +
   `provider_message_id`, or `failed` + `error`. Return `{ ok: true, sendId }`.
Add `'email_writer'` to `InternalRole` and `ENV_KEY` in
`src/lib/server/data/db.ts`.

### 3.5 `src/routes/app/o/[id]/+page.server.ts` and `+page.svelte`

- `load`: read `invite_sends` for the offer via `locals.supabase` (RLS);
  attach `lastSend: { toEmail, status, at } | null` per response; return
  `sending: { paused, recipientsUsed, recipientCap }` via `roleDb('email_writer')`.
- Action `send`: `guard`; `reconciliationId` + `email` from the form; the
  response must have `link` and `copyable`; call `sendInviteEmail`. Copy:
  `offer-cap` → "This offer has reached its 50 recipients."; `daily-cap` →
  "You've sent today's limit; try tomorrow."; `paused` → "Email sending is
  paused; copy the link instead."; `invalid-email` → "Enter a valid email address."
- Svelte: in each `response-row`, after Copy, a compact form
  (`data-testid="send-form"`: email input, "Send") while `r.copyable`;
  "Sent to {email} · {time}" when `lastSend` exists, with "Send again".
  Copy is never removed. One-line notice above the table when paused.

### 3.6 `src/routes/api/email/events/+server.ts` — the webhook

`POST` only; raw body → `verifyWebhook`; invalid → 401. Under
`roleDb('email_writer')`: insert `email_events` `on conflict do nothing`;
nothing inserted → 200, stop (replay). Update `invite_sends` by
`provider_message_id` to `delivered` / `bounced` / `complained`; on
`complained`, `select apply_sending_pause()`. Always 200 `{ ok: true }`;
unknown message ids ignored. Log kind and id only.

### 3.7 Tests

`src/lib/server/email/providerContainment.test.ts` (copy
`serviceRoleKey.test.ts`: `grep -rl "from 'resend'" src` and `grep -rl
RESEND_API_KEY src`, non-test, both equal
`['src/lib/server/email/provider.ts']`);
`src/lib/server/email/templates/inviteEmail.test.ts`;
`src/lib/server/platform/inviteSendPermit.test.ts` (DB via
`tests/helpers/db.ts`); `src/routes/api/email/events/events.test.ts`;
extend `tests/e2e/offers.e2e.ts` and `src/lib/server/data/rls.test.ts`.

## 4. Out of scope

Real magic-link sign-in or binding invites to the sent address (Q2);
results notifications and lifecycle nudges; marketing email; an operator
UI for `send_cap` or pause release; per-account pausing; retry queues;
address suppression beyond recording status; any change to
`create_reconciliation`, `redeem_invite` or `/join`; attaching the prod
domain (hosting §3.2 step 4).

## 5. Verification (binding)

- **V1** static: the containment test passes; `grep -rn "smtp\|nodemailer"
  src` is empty.
- **V2** template: no seeded figure or amount in subject, text or html;
  the link appears exactly once in text.
- **V3** caps: 50 distinct recipients → `ok`; the 51st → `offer-cap`; a
  repeat address → `ok`; `update offers set send_cap = 60` admits the 51st.
- **V4** daily: 200 non-failed sends for one identity in 24h → `daily-cap`;
  a `failed` row does not count.
- **V5** pause: one `complained` row → `apply_sending_pause()` sets
  `paused_at` and permit returns `paused`; `released_at = now()` → `ok`.
- **V6** webhook: bad signature → 401, no row; valid `bounced` → status
  `bounced`; the same event id twice changes nothing; unknown id → 200.
- **V7** live (operator, prod, after §2 actions): a send to a Gmail
  address lands in the inbox; "Show original" shows SPF, DKIM, DMARC PASS
  with `fairprice.broker` in the DKIM signature; Copy still shows for that
  link; the link opens and asks for the opener's email as before.
- **V8** e2e (log-only): generate, send to `someone@example.com`, row
  shows "Sent to someone@example.com", Copy remains, one `sent` row with a
  `log:` message id.
- **V9** role: `email_writer` `select` on `figures`, `results`, `payloads`
  denied (three rows in `rls.test.ts`).
- PASS: `npm run lint && npm run check && npm run test:unit -- --run &&
  npm run test:e2e` exit 0 with V1–V6, V8, V9 named; V7 dated in this file.

## 6. Open questions (HITL)

- **Q1 — provider: Resend (recommended) or Postmark?** Resend: 3,000/month
  free with webhooks. Postmark: stronger reputation, but 100/month free and
  the next tier is a recurring cost above the £10 line (T2 §2.8).
- **Q2 — should sending bind the invite to the address?** Recommend no
  for M1: binding nulls `plaintext_token` and removes Copy, and under
  D1-naive it is not actually safer. Revisit when real magic-link
  redemption replaces `naiveSignIn`.
- **Q3 — per-account daily cap.** Recommend 200; Resend's free 100/day
  bites first anyway.
- **Q4 — DMARC at launch: `p=quarantine` (recommended) or `p=none`?**
  `none` is gentler while records settle; move to `quarantine` after V7.
- **Q5 — release from auto-pause.** Recommend a manual SQL update by the
  operator for M1, recorded in `released_by`; a screen is a later lane.
- **Q6 — Reply-To the broker?** Recommend yes: reads as from a person and
  gives recipients someone to answer. Alternative: a "do not reply" line.

## 7. Deviations

None at drafting. Anything at execution departing from §3 is recorded
here before the branch lands.
