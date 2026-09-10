---
id: T3-m1-agent-doorway
plan_kind: thematic
tier: 3
t2_parent: T2-agent-distribution
milestone: M1-working-instrument
status: draft
---

# T3 — M1 agent doorway: one catalogue, two doors, parity by test

## 0. Human summary (plain language)

**Let an AI assistant do everything a signed-in person can do here, through
the same code, seeing no more than that person could.** Every action the
product offers is written down once, in a list; the website and the two
machine doors (MCP for assistants, plain HTTP for scripts) all call that
list, and a test fails the build if any of the three drifts from it. An
assistant gets in with a key its owner mints on the account page; the key
*is* that person, so the database's who-sees-what rules apply unchanged.
Directory listings, `llms.txt` and `.md` twins wait for M3.

> Parent: `T2-agent-distribution` (§2.1 one catalogue, §2.2 structural
> exclusions, §2.3 casual exception, §2.4 credential contract, §2.5 MCP and
> HTTP are the same door, §2.6 derived discovery, §2.7 rate-limit classes;
> §4 verification; §6 R2, R3). Milestone: `M1-working-instrument` §2 item 6,
> §4 DoD 8. Depends on: `T3-m1-casual-mode` (`handleCasualReconcile`,
> shipped), `T3-m2-domain-terms` §2–§3 (ruled; the vocabulary below),
> `T3-m1-platform-naive-auth` (request-scoped client, `/account`),
> `T3-m1-data-core` (guarded functions, RLS, `withAuthenticatedCaller`).
> Vocabulary: reconciliation · buyer / seller sides · broker seat with
> `acts_for` · offer · vertical (`src/lib/domain/terms.ts`).

## 1. Why this shape

- **The pattern already exists once.** `src/lib/server/casual/casualRoute.ts`
  (`createCasualReconcileHandler(deps)` over `handleCasualReconcile`) plus
  the three-line `src/routes/api/casual/reconcile/+server.ts` is the shape;
  this brief generalises it. Every capability is one object (id, zod input
  and output, seat, rate-limit class, handler); every door — page action,
  MCP tool, HTTP operation — parses, calls the handler, serialises.
- **The database is the only blindness authority** (T2 §2.2, §2.4). An agent
  key resolves to a Supabase auth user; the adapter builds a `SupabaseClient`
  bound to that user's claims and hands it to the same server functions the
  pages hand `locals.supabase`. Nothing in `catalogue/` decides visibility.
- **Grants are participant rows, not a new credential kind.** T2 §2.4's
  session-party grant is obtained by redeeming an invite exactly as a human
  does; `redeem_invite` inserts the `participants` row RLS keys on, and the
  grant dies with the reconciliation (`state <> 'open'`) in SQL.
- **Discovery is derived** (T2 §2.6): OpenAPI 3.1 is a prerendered endpoint
  built from the catalogue; MCP schemas come from the same zod objects via
  zod 4's `z.toJSONSchema`. No generator script to forget.
- **The parity law is a static test** (T2 §6 R3) over `src/routes/**`.

## 2. Environment facts

- Local Node `v25.9.0`; deploy runtime `nodejs22.x` (`vite.config.ts`).
  Vitest `server` project (`src/**/*.{test,spec}.ts`, node); Playwright
  e2e under `tests/e2e/`. Commands: `npm run check`, `npm run lint`,
  `npm run test:unit -- --run`, `npm run test:e2e`.
- New dependencies, pinned exactly: `@modelcontextprotocol/sdk@1.30.0`
  (checked `npm view` 10 Sep 2026), `zod@4.6.1` (its peer; also our schema
  language). Nothing else. **VERIFY AT EXECUTION** that 1.30.0 exports
  `WebStandardStreamableHTTPServerTransport` from
  `@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js` (the
  `Request`/`Response` transport). If only the Node `req`/`res` transport
  exists, STOP and report; do not write a shim.
- Auth: `event.locals.supabase` is anon key + cookies (`src/hooks.server.ts`,
  `src/lib/server/auth/supabaseServer.ts`); `src/lib/server/data/db.ts`
  `withAuthenticatedCaller` runs SQL as `authenticated` with
  `request.jwt.claims` set, and `brokerFullResult` / `sideResult` already
  take `{ sub, email }` claims.
- One new secret, tenth Vercel variable per project (`T3-m1-platform-hosting`
  §2): `SUPABASE_JWT_SECRET`, the project's legacy HS256 secret, read only
  inside `src/lib/server/auth/` (extends naive-auth §5 V5). See Q1.
- `developer_grants` (`20260910000004` line 197) backs `is_developer()`, not
  agent keys; not repurposed. `src/lib/server/catalogue/` holds only
  `.gitkeep`. `src/lib/server/offers/sideView.ts` does not exist (only its
  test does): the side-view reads live in `offers/reconciliations.ts` and
  `offers/figures.ts`; wrap those, create nothing named `sideView.ts`.

## 3. Files and steps

### 3.1 Capability catalogue — `src/lib/server/catalogue/`

`catalogue.ts` exports `CAPABILITIES: readonly Capability[]` and the type:

```typescript
export interface Capability<I = unknown, O = unknown> {
  readonly id: CapabilityId;               // 'figures.submit'
  readonly seat: 'none' | 'account' | 'side' | 'broker';
  readonly rateLimitClass: 'create' | 'invite' | 'join' | 'submit' | 'read' | 'compute';
  readonly input: z.ZodType<I>;
  readonly output: z.ZodType<O>;
  readonly description: string;            // cold-agent text, states seat + blindness
  readonly http: { method: 'POST' | 'GET'; path: `/api/v1/${string}` };
  readonly humanSurfaces: readonly string[]; // 'app/o/[id]?/generate', 'rec/[id]:load'
  handler(ctx: CallerContext, input: I): Promise<O>;
}
export type CallerContext =
  | { kind: 'anon'; supabase: SupabaseClient; origin: string }
  | { kind: 'user'; supabase: SupabaseClient; claims: { sub: string; email: string | null }; origin: string };
```

`caller.ts` exports `callerFromLocals(locals, origin)` (pages) and
`callerFromAgentKey(key, origin)` (§3.2). `errors.ts` exports
`CapabilityError { code: 'unauthenticated' | 'forbidden' | 'not-found' |
'invalid-input' | 'state' | 'credits'; message }`; handlers map guarded
SQL messages through `friendlyError` (`offers/figures.ts`) into these.

The M1 catalogue (every human capability, from the route files read on
10 Sep 2026). Handlers are thin: they call the named server function.

| id | seat | class | human surface | server function | guarded SQL |
|---|---|---|---|---|---|
| `casual.reconcile` | none | compute | `/` → `POST /api/casual/reconcile` | `handleCasualReconcile` | none (`completeCasualPlay`, casual_writer) |
| `account.credits` | account | read | `/account`, `/app` layout | `rpc current_credit_balance` | `current_credit_balance`, `ensure_identity` |
| `offers.create` | account | create | `/app/offers/new` default | `createOffer` | `personal_map`, RLS insert |
| `offers.list` | account | read | `/app/offers`, `/app` | `listOffers` | RLS via `may_access` |
| `offers.read` | account | read | `/app/o/[id]` load | `readOffer`, `listResponses`, `listTags` | RLS, `is_broker`, `constructPayload` |
| `offers.update_figures` | account | submit | `/app/o/[id]?/figures` | `updateFigures` | `submit_figures`, `recall_figures` |
| `reconciliations.launch` | account | create | `/app/o/[id]?/generate` | `generateLinks` | `launch_reconciliation` |
| `reconciliations.tag` / `.untag` | account | submit | `/app/o/[id]?/tag`, `?/untag` | `tagReconciliation`, `untagReconciliation` | RLS |
| `invites.preview` | none | join | `/join/[token]` load | `rpc invite_preview` | `invite_preview` (anon) |
| `invites.redeem` | account | join | `/join/[token]` load + default | `rpc redeem_invite` | `redeem_invite` |
| `figures.submit` | side | submit | `/rec/[id]?/submit`, `/app/rec/[id]?/submit` | `saveFiguresAndSubmit` | `submit_figures` |
| `figures.recall` | side | submit | `/rec/[id]?/recall`, `/app/rec/[id]?/recall` | `recallFigures` | `recall_figures` |
| `reconciliations.read_side_view` | side | read | `/rec/[id]` load | `readReconciliation`, `sideFor`, `readOwnFigures`, `brokerSeesFiguresFor`, `sideResult`, `claimAndOrchestrate` | `side_for`, `broker_sees_figures_for`, `constructPayload` |
| `reconciliations.read_broker_view` | broker | read | `/app/rec/[id]` load | `readReconciliation`, `isBroker`, `readSeatInvite`, `sideSubmitted`, `offerOf`, `brokerFullResult` | `is_broker`, `constructPayload` |
| `reconciliations.cancel` | broker | submit | **none today** → add `/app/rec/[id]?/cancel` | `cancelReconciliation` | `cancel_reconciliation` |
| `account.keys.mint` / `.list` / `.revoke` | account | create / read / submit | `/account` (new panel, §3.2) | `mintAgentKey`, `listAgentKeys`, `revokeAgentKey` | `mint_agent_key`, RLS |

Rules: (a) `seat: 'side'` handlers call `sideFor` first and throw
`forbidden` on null, the 403 `/rec/[id]` gives; (b) `figures.submit` takes
`{ reconciliationId, tuple }` — the side is *derived* from `sideFor`, never
read from input, so a broker acting for the buyer submits as the buyer as
`/app/rec/[id]` does; (c) `invites.redeem` takes `{ token }` only — the
caller's identity is the email, as `/join` after `naiveSignIn`; a bound
invite for another email fails `email-mismatch` in SQL; (d)
`reconciliations.launch` takes `{ offerId, requestKey, count }`, one credit
per link via `generateLinks`; (e) `casual.reconcile` is
`handleCasualReconcile` with `dbCasualPlayCompleter`, its description
carrying T2 §2.3: both tuples from one co-present caller, no
reconciliation, invite or stored figures, the only both-sides operation;
(f) every `description` states its seat and what the caller cannot see.
`CASUAL_RECONCILE_CAPABILITY` in `casualReconcile.ts` becomes a re-export
of the catalogue entry (one definition).

Rewiring: each listed `+page.server.ts` action or load calls
`capability.handler(callerFromLocals(locals, url.origin), input)` and keeps
its own form parsing and redirects; `parseTuple` stays, and the zod tuple
schema encodes the same grammar (`/^\d{1,9}(\.\d{1,4})?$/` after
comma/space stripping). Add the one missing human action, `cancel`, to
`/app/rec/[id]/+page.server.ts` with a button while `state = 'open'` (Q3).

`EXCLUSIONS` in `parity.ts`: `signin`, `signout`, the unbound `/join` email
form (auth is T2-platform's; agents authenticate by key), `account/billing`
(placeholder), `demo/*`, `api/demo/*`, `recruitment/demo` (guided marketing
demo; `DEMO_*_CAPABILITY` stays put), `method`, `recruitment` (content).

### 3.2 Agent credentials — key = identity

Migration `supabase/migrations/20260910000008_agent_keys.sql`:

```sql
create table agent_keys (
  id uuid primary key default gen_random_uuid(), auth_uid uuid not null, email text,
  key_hash text not null unique,   -- sha256 hex of the plaintext
  prefix text not null,            -- first 12 chars, for display
  label text not null check (length(trim(label)) between 1 and 60),
  created_at timestamptz not null default now(), expires_at timestamptz not null,
  last_used_at timestamptz, revoked_at timestamptz);
-- RLS on; select and update (revoke) policies: auth_uid = jwt_uid().
create function mint_agent_key(p_key_hash text, p_prefix text, p_label text, p_expires_at timestamptz)
  returns uuid ...;   -- security definer; inserts (jwt_uid(), jwt_email(), ...); raises not-authenticated
create function resolve_agent_key(p_key_hash text) returns table (auth_uid uuid, email text) ...;
  -- security definer; one row iff revoked_at is null and expires_at > now(); sets last_used_at
-- revoke both from public; grant mint to authenticated, resolve to anon; owner schema_owner_internal,
-- which gains select, insert, update on agent_keys (pattern: 20260910000005 line 10).
```

`src/lib/server/auth/agentKeys.ts`:

```typescript
export function mintPlaintextKey(): { plaintext: string; hash: string; prefix: string }; // 'fpb_' + 32 random bytes base64url
export async function mintAgentKey(supabase: SupabaseClient, label: string, ttlDays: 30 | 90 | 365): Promise<{ id: string; plaintext: string }>;
export async function listAgentKeys(supabase: SupabaseClient): Promise<AgentKeyRow[]>;   // never the hash
export async function revokeAgentKey(supabase: SupabaseClient, id: string): Promise<void>;
export async function supabaseForAgentKey(plaintext: string): Promise<{ supabase: SupabaseClient; claims: { sub: string; email: string | null } } | null>;
```

`supabaseForAgentKey`: sha256 → `rpc resolve_agent_key` on an anon client
→ sign `{ sub, email, role: 'authenticated', aud: 'authenticated', exp:
now+10min }` HS256 with `SUPABASE_JWT_SECRET` (`crypto.createHmac`, no jwt
library) → `createClient(url, anonKey, { global: { headers: { Authorization:
`Bearer ${jwt}` } } })`. PostgREST validates it, so `jwt_uid()`, `jwt_email()`
and every policy see the key's owner; revocation is checked on every call
(T2 §2.4). Plaintext is shown once at mint on `/account` (new "Agent keys"
panel: label, expiry, list of prefix/created/expires/last used, revoke) via
actions `mintKey`, `revokeKey` in a new `src/routes/account/+page.server.ts`.

### 3.3 HTTP adapter — `src/routes/api/v1/[...capability]/+server.ts`

One catch-all route. `POST` (`GET` for the `read` class) → entry by
`http.path` → `callerFromRequest(request)`: `Authorization: Bearer fpb_…`
→ `supabaseForAgentKey`; absent → anon; cookies ignored on this door.
`capability.input.safeParse` failure → 400 `{ error: 'invalid-input',
issues }`; `CapabilityError` maps `unauthenticated` 401, `forbidden` 403,
`not-found` 404, `state`/`credits` 409; anything else 500, no message.
Success: 200 `capability.output.parse(result)` — the output schema is the
door's second guard against leaking outside the declared payload class.
`Cache-Control: no-store` always.

### 3.4 MCP adapter — `src/routes/api/mcp/+server.ts`

Stateless per request (Vercel functions share nothing): each `POST` builds
`new McpServer({ name: 'fair-price-broker', version })`, registers one tool
per entry — `server.registerTool(id, { description, inputSchema:
capability.input, outputSchema: capability.output }, handler)` — with the
same `callerFromRequest`, then `new
WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined })`,
`await server.connect(transport)`, `return transport.handleRequest(request)`.
`GET`/`DELETE` → 405 (no sessions, no server streams). Results carry
`structuredContent` plus a one-line `text`; `CapabilityError` → `isError:
true` with code and message. Tools register in catalogue order so the list
reads as a walkthrough: casual, account, offers, launch, invites, figures,
views, cancel, keys.

### 3.5 OpenAPI 3.1 — `src/routes/api/v1/openapi.json/+server.ts`

`export const prerender = true;` `GET` returns
`buildOpenApi(CAPABILITIES)` from `src/lib/server/catalogue/openapi.ts`:
`openapi: '3.1.0'`, one path per entry, schemas from
`z.toJSONSchema(schema, { target: 'openapi-3.0' })` (**VERIFY AT
EXECUTION** the option name in zod 4.6.1), `securitySchemes.agentKey`
(`http` / `bearer`), `security: []` on `seat: 'none'` entries, and each
`description` as the operation description so the blindness statements
ship. The build emits it as a static file; P6 asserts the served JSON
equals the builder, so drift is impossible. `static/openapi.json` is not
used: a prerendered endpoint is the same artefact with no script to forget.

### 3.6 Parity suite — `src/lib/server/catalogue/parity.test.ts`

- **P1 static human sweep.** Glob `src/routes/**/+page.server.ts` and
  `**/+server.ts`; collect exported `actions` keys and `load` presence;
  every `(route, action|load)` must be in some entry's `humanSurfaces` or
  in `EXCLUSIONS`, and every listed surface must exist on disk.
- **P2 door set equality.** MCP `tools/list` names = catalogue ids =
  OpenAPI operation ids, no extras either way.
- **P3 behavioural equivalence (DoD 8).** Two users via `tests/helpers/db.ts`
  `createAuthUser`, one key each. With A's key over HTTP: `offers.create` →
  `reconciliations.launch` (count 1); with B's key: `invites.redeem`
  (returned token) → `figures.submit` → `read_side_view` shows B's tuple,
  `fair`, `zone`, nothing of A's; A's `read_broker_view` shows both tuples
  (salary-negotiation is broker-sees-figures). Repeat over MCP with the SDK
  `Client` + `StreamableHTTPClientTransport` against the dev server; the two
  runs' bodies deep-equal modulo ids, timestamps and share refs.
- **P4 blindness adversarial.** B's key tries every `side`/`broker` entry
  on a reconciliation B is not in → `forbidden`/`not-found` on both doors;
  `casual.reconcile` uses `z.strictObject`, so a `reconciliationId` is rejected.
- **P5 credential lifecycle.** Revoked → 401 next call; expired → 401; A
  cannot list or revoke B's keys (RLS).
- **P6 OpenAPI sync.** `GET /api/v1/openapi.json` deep-equals
  `buildOpenApi(CAPABILITIES)`.

## 4. Out of scope

Registry/directory submissions, `llms.txt`, `.md` twins, agent-docs page
(M3); survey capabilities (M2, with survey per T2 §6 R3); the ChatGPT Apps
SDK adapter (T2 §6 R1: a third adapter seam, not built); rate-limit
**enforcement** (Q2 — every entry carries its class, so T2 §2.7's total
function holds as metadata); org/team or sub-account-scoped keys; real
email or Google sign-in; any change to guarded functions, RLS or the
payload constructor beyond §3.2's one table and two functions.

## 5. Verification (binding)

- **V1** `npm run check`, `npm run lint`, `npm run test:unit -- --run`
  exit 0 with P1–P6 named and green.
- **V2** DoD 8 by hand on dev: an MCP client (Claude Desktop or the SDK
  inspector) given only `https://fairprice-dev.vercel.app/api/mcp` and one
  key completes launch → redeem (second key) → submit → side view → casual
  from tool descriptions alone; transcript attached to the capture.
- **V3** `curl -s https://fairprice-dev.vercel.app/api/v1/openapi.json | jq
  '.paths | keys | length'` equals the catalogue's entry count.
- **V4** Deleting one entry's `humanSurfaces` line, or adding a dummy
  action to any `+page.server.ts`, turns P1 red (once each, then revert).
- **V5** `grep -rl SUPABASE_JWT_SECRET src/` lists only `src/lib/server/auth/`.
- **V6** Existing suites hold or grow: 176 unit, 20 e2e.

## 6. Open questions (HITL)

- **Q1 — JWT signing.** §3.2 signs with the project's legacy HS256 secret;
  2026 Supabase projects may default to asymmetric keys with it disabled.
  Operator: confirm dev and prod (Project Settings → JWT Keys) show a usable
  legacy secret. Fallback: `auth.admin.generateLink` + `verifyOtp` per key
  (the `naiveSignIn` mechanism), cached until expiry — proven here, two
  GoTrue calls per cold call. Leaning: HS256 if available, else fallback.
- **Q2 — rate-limit enforcement in M1?** Classes are declared, nothing
  enforces them; enforcement needs shared per-key-and-IP budgets across
  both doors (T2 §2.7). Leaning: out of M1, enforce in M3 before listings.
- **Q3 — `reconciliations.cancel`.** No human surface exists. Add the
  `cancel` action to `/app/rec/[id]` (leaning) or drop the entry from M1?
- **Q4 — one identity in both seats.** Nothing stops one `bound_auth_uid`
  redeeming both sides' invites (a human with both links has the same
  reach). Leaning: add a unique `(reconciliation_id, bound_auth_uid)` index
  — one line that makes T2 §2.4's "no credential addresses both parties" a
  database fact.
- **Q5 — key TTL and count.** Proposed 30/90/365-day expiry, at most ten
  live keys per account. Confirm or set.

## 7. Deviations

None at drafting. Expected at execution: the Q1 fallback, if taken, is
recorded here as **D1-doorway** with the GoTrue path it used.
