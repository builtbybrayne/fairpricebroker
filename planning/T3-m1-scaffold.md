---
id: T3-m1-scaffold
plan_kind: thematic
tier: 3
t2_parent: T2-platform
milestone: M1-working-instrument
status: draft
---

# T3 — M1 scaffold: the app skeleton, locally green

## 0. Human summary (plain language)

**Build the empty-but-working app skeleton in this repo:** the SvelteKit
application, the test tooling, and a local database — everything runnable
on this machine with one command each, all tests green. No cloud accounts
are touched (Vercel/Supabase-cloud/domain wiring is a separate,
operator-assisted brief).

---

> Parent: `T2-platform` (one deployable, §2.1; environments, §2.9).
> Milestone: `M1-working-instrument` item 1. Principles are inherited by
> reference — this brief states only what to do.
>
> Revised 20 Aug 2026 addressing Codex audit r1 (verdict: revise;
> 3 high / 1 medium / 1 low). Every command in §2 was executed verbatim
> against the pinned tool versions on 20 Aug 2026 in a clean directory;
> "verified" below means exit 0 was observed, not inferred from docs.

## 1. Environment facts (pinned, verified 20 Aug 2026)

- Machine: macOS (Darwin 23.6), zsh. Machine Node at time of writing:
  v25.9.0 (passes the floor below).
- **Node floor** (from Vite 8's `engines.node`, read from the installed
  package): `^20.19.0 || >=22.12.0`. Asserted mechanically in the
  preflight below — if it fails, STOP and report; do not install Node.
- **Toolchain pins.** Every generator is invoked with an exact version —
  never bare `@latest`:
  - Svelte CLI: `npx -y sv@0.17.0`
  - Supabase CLI: `npx -y supabase@2.115.0`
  - What those generate (observed): SvelteKit ^2.63, Svelte ^5.56,
    Vite ^8.0 (resolves 8.0.16), Vitest ^4.1, @playwright/test ^1.60,
    @sveltejs/adapter-vercel ^6.3.3 (resolves 6.3.4). `package-lock.json`
    is committed by this brief, so these resolutions are frozen at
    execution time.
- **Config layout fact:** the sv 0.17.0 minimal template emits **no
  `svelte.config.js`** — SvelteKit is configured inside `vite.config.ts`
  via the `sveltekit({ ... })` plugin, and the `sveltekit-adapter`
  add-on writes `adapter: adapter()` importing `@sveltejs/adapter-vercel`
  there. No hand edit of any config file is required by this brief.
- **Generated test topology (observed):** Vitest runs two projects —
  `client` (browser mode via `@vitest/browser-playwright`, matching only
  `src/**/*.svelte.{test,spec}.{js,ts}`, excluding `src/lib/server/**`)
  and `server` (node environment, matching all other
  `src/**/*.{test,spec}.{js,ts}`). Playwright e2e matches
  `**/*.e2e.{ts,js}` and its `webServer` builds and previews on :4173.
  The `test:unit` script is watch-mode `vitest` — non-interactive runs
  MUST pass `-- --run`. The `test:e2e` script runs `playwright install`
  itself (first run downloads browsers; that is expected, not an error).
- Working directory for every step: the checkout root —
  `cd "$(git rev-parse --show-toplevel)"`. The repo is APV-tracked:
  capture-before-commit applies to the commit this brief makes (§2 step 8).
- Docker Desktop is required only for step 6 (local Supabase) and was
  NOT running at authoring time; step 6 defines the skip protocol.

**Preflight assertions (run first; any failure = STOP and report):**

```bash
cd "$(git rev-parse --show-toplevel)"
test ! -f package.json || { echo "ABORT: package.json already exists"; exit 1; }
test ! -f vite.config.ts || { echo "ABORT: vite.config.ts already exists"; exit 1; }
test -d planning && test -f CLAUDE.md && test -d .apv || { echo "ABORT: not the fairprice checkout root"; exit 1; }
node -e 'const [M,m]=process.versions.node.split(".").map(Number); process.exit(((M===20&&m>=19)||(M===22&&m>=12)||M>22)?0:1)' \
  || { echo "ABORT: Node $(node --version) outside ^20.19.0 || >=22.12.0"; exit 1; }
```

## 2. Steps (exact, in order)

1. **Scaffold + add-ons in a staging directory** (verified sequence —
   both commands ran non-interactively to exit 0; the add-on option
   syntax is `addon=opt:val`, and all options must be set explicitly to
   suppress prompts):
   ```bash
   cd "$(git rev-parse --show-toplevel)"
   npx -y sv@0.17.0 create .scaffold-tmp --template minimal --types ts --no-add-ons --no-download-check --install npm
   cd .scaffold-tmp
   npx -y sv@0.17.0 add "vitest=usages:unit,component" playwright eslint prettier "sveltekit-adapter=adapter:vercel" --no-git-check --no-download-check --install npm
   cd ..
   ```
2. **Move the finished project into the root, then install:**
   ```bash
   rsync -a --ignore-existing --exclude node_modules .scaffold-tmp/ ./
   rm -rf .scaffold-tmp
   npm install
   ```
   `--ignore-existing` protects the repo's `.gitignore` and `CLAUDE.md`;
   `--exclude node_modules` keeps the move cheap (`npm install` at the
   root rebuilds it from the copied `package-lock.json`).
3. **Merge the generated ignore entries** into the existing `.gitignore`
   (the generated file was blocked by `--ignore-existing`; append
   exactly this block):
   ```bash
   cat >> .gitignore <<'EOF'

   # App — SvelteKit scaffold (appended by T3-m1-scaffold)
   node_modules
   .output
   .vercel
   /.svelte-kit
   /build
   .env
   .env.*
   !.env.example
   !.env.test
   vite.config.js.timestamp-*
   vite.config.ts.timestamp-*
   test-results
   Thumbs.db
   EOF
   ```
4. **Confirm adapter wiring mechanically** (no config edit — the add-on
   did it):
   ```bash
   grep -q "@sveltejs/adapter-vercel" vite.config.ts && ! grep -q "adapter-auto" package.json && echo "ADAPTER OK"
   ```
   Pass criterion: prints `ADAPTER OK`.
5. **Directory skeleton** (empty dirs carry a `.gitkeep`):
   `src/lib/server/engine/` (the pure engine — server-only by path
   convention: SvelteKit never serves `src/lib/server/**` to the client,
   satisfying T2-engine §2.2's packaging rule; note the Vitest `server`
   project covers tests here), `src/lib/server/data/`,
   `src/lib/server/catalogue/`, `src/routes/api/`, `tests/e2e/`
   (Playwright matches `**/*.e2e.ts` anywhere; this dir is the home for
   future non-demo e2e).
6. **Local Supabase** — gated on Docker:
   ```bash
   docker info >/dev/null 2>&1 || echo "DOCKER UNAVAILABLE"
   ```
   If `DOCKER UNAVAILABLE`: skip to step 7, still create `.env.example`
   as below, and record step 6 as blocked in the step-8 capture (that is
   a REVISE-state completion, not silent success). Otherwise:
   ```bash
   npx -y supabase@2.115.0 init
   npx -y supabase@2.115.0 start
   npx -y supabase@2.115.0 status -o env
   ```
   Write `.env` (gitignored) by mapping the printed variables BY NAME:
   the API/project URL variable → `PUBLIC_SUPABASE_URL`; the anon —
   or, in the newer key era, publishable (`sb_publishable_…`) — key →
   `PUBLIC_SUPABASE_ANON_KEY`; the service_role — or secret
   (`sb_secret_…`) — key → `SUPABASE_SERVICE_ROLE_KEY`; the Postgres
   connection URL → `SUPABASE_DB_URL`. If the output matches neither
   naming era, STOP and report the literal variable names printed —
   do not guess a mapping. Then create `.env.example` with names only:
   ```bash
   cat > .env.example <<'EOF'
   PUBLIC_SUPABASE_URL=
   PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   SUPABASE_DB_URL=
   EOF
   ```
7. **Smoke test** — create `src/lib/server/engine/smoke.test.ts` with
   exactly (the generated Vitest config sets
   `expect: { requireAssertions: true }`; this satisfies it):
   ```typescript
   import { describe, expect, it } from 'vitest';

   describe('test wiring', () => {
   	it('runs a trivial assertion in the server project', () => {
   		expect(1 + 1).toBe(2);
   	});
   });
   ```
   Leave the sv-generated example tests (`src/lib/vitest-examples/`,
   `src/routes/demo/`) in place — they are part of proving the wiring;
   the engine brief replaces the smoke test, not these.
8. **Verify, capture, commit.** Five checks, each with a mechanical pass
   criterion:
   ```bash
   npm run test:unit -- --run     # PASS: exit 0
   npx playwright install chromium
   npm run test:e2e               # PASS: exit 0 (self-installs browsers; builds + previews on :4173)
   npm run lint                   # PASS: exit 0
   npm run dev > /tmp/fairprice-dev.log 2>&1 & echo $! > /tmp/fairprice-dev.pid
   sleep 8
   curl -sf --max-time 10 -o /dev/null -w "%{http_code}\n" http://localhost:5173/   # PASS: prints 200
   kill "$(cat /tmp/fairprice-dev.pid)"
   ```
   (If :5173 is occupied, the dev server picks another port and the curl
   fails — check `/tmp/fairprice-dev.log` for the actual port, re-curl
   it, and note the substitution in the capture.)
   Then capture via the **apv-capture skill**
   (`exfu-agent-plan-visualiser:apv-capture`; `/apv-capture` is its
   Claude-Code alias — in a client without the alias, read and follow
   the skill source per CLAUDE.md). Event: `entity.progressed` (or
   `entity.completed` if step 6 also ran) against THIS plan id, with
   `verification.tested` recording the five checks. Commit first line:
   `feat(scaffold): SvelteKit app skeleton with vitest/playwright/adapter-vercel`

## 3. Out of scope (do not touch)

- No cloud: no Vercel project, no Supabase cloud project, no DNS, no
  email provider, no B2 bucket (operator-assisted wiring brief follows).
- No engine code beyond the smoke test; no schema/migrations; no UI
  beyond what sv generates; no CI workflow yet (arrives with the cloud
  wiring); no MCP.
- Do not modify `planning/`, `docs/`, `reference/`, `CLAUDE.md`, or the
  pre-existing lines of `.gitignore` (step 3 appends only).
- **APV boundary, precisely:** never hand-edit `.apv/` or
  `.apv-config.toml`. The ONE sanctioned write is the event append the
  apv-capture skill itself performs in step 8 — capture-before-commit is
  repo law and does not conflict with this guard.
- No config edits: `vite.config.ts`, `playwright.config.ts`,
  `tsconfig.json`, `eslint.config.js`, `prettier.config.js` are used
  exactly as generated.

## 4. Verification & failure protocol

Done = all five step-8 checks pass + `git status` clean after the commit
+ step 6 either green or explicitly recorded as Docker-blocked in the
capture. Any other failure: stop, capture what was done as
`entity.progressed`, and report the exact failing command and its
output. Never mark this brief complete with a failing check
unreported.
