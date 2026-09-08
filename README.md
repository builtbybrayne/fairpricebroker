# Fair Price Broker

The software implementation of the Van Westendorp Price Sensitivity Meter,
applied to two-party reconciliation: each side privately enters four price
points, the server-side engine finds the fair price and whether a deal zone
exists, and neither side ever sees the other's raw numbers.

- Product name: **Fair Price Broker** · domain: https://fairprice.broker
- Planning corpus: `planning/` (T1 → T2 → T3, milestones; APV-tracked)
- Design language: "The Instrument" (`docs/design-brief.md`, `PRODUCT.md`,
  `.impeccable/`)
- Business/GTM state lives in the ExFu library scope, not here (see `CLAUDE.md`).

## Run it locally

Prerequisites: Node 22+ (24 recommended), Docker Desktop (for local Supabase).

```bash
npm ci
npx -y supabase@2.115.0 start      # local Postgres + Auth on 127.0.0.1:54322 / :54321
npx -y supabase@2.115.0 db reset   # applies supabase/migrations (creates roles, RLS, functions)
```

Create `.env` from `.env.example`. The four `PUBLIC_SUPABASE_*` /
`SUPABASE_*` values come from `npx -y supabase@2.115.0 status -o env`; the
four per-role `*_DB_URL` values use the local-dev passwords created by the
roles migration (`supabase/migrations/*roles_and_baseline*.sql`).

```bash
npm run dev            # http://localhost:5173
```

What works in this build:

- **Homepage = casual mode.** Two people, one phone: set your meter, seal it,
  hand over, both look, reveal. Nothing typed is stored; the only trace is an
  anonymous completion event and a share ref.
- **Recruitment vertical** at `/recruitment`, with a guided demo at
  `/recruitment/demo` (answers are saved as demo-flagged events).
- **Invited reconciliation** for recruiters at `/app` (preview sign-in: type
  an email, you're in; invite links are copied, not emailed — real auth and
  email sending are deferred).

## Verify

```bash
npm run test:unit -- --run   # engine, data core (needs local Supabase), server contracts
npm run lint && npm run check
npx playwright test -c playwright.dev.config.ts   # e2e against a running dev server
npm run test:e2e             # e2e against a production build + preview (:4173)
```

## Layout

- `src/lib/server/engine/` — the pure reconciliation engine (golden vectors + property tests)
- `src/lib/server/data/` — schema access, authorisation, payload constructor, orchestrator
- `src/lib/server/casual/`, `src/lib/server/demo/`, `src/lib/server/auth/`, `src/lib/server/platform/`
- `src/lib/templates/` — vertical templates (configuration and copy, never engine logic)
- `src/lib/client/` — the meter, the reveal canvas, the casual flow, demo and recruitment surfaces
- `supabase/migrations/` — the database, deny-by-default
