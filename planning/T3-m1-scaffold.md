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

## 1. Environment facts (pinned)

- Machine: macOS (Darwin 23.6), zsh; Node.js ≥ 20 required — verify with
  `node --version` (if missing/older, STOP and report; do not install
  system software).
- Repo root: `/Users/al/Studio/projects/fairprice` (git, APV-tracked:
  capture-before-commit applies to every commit this brief makes).
- The repo root currently contains no application code — only
  `planning/`, `docs/`, `reference/`, `.apv/`, `.exfu/`, `.claude/`,
  `CLAUDE.md`, `.gitignore`, `apv` symlink. The app is scaffolded INTO
  the root (root-level `package.json`), preserving all existing files.
- Docker Desktop may or may not be running — required only for step 5
  (local Supabase); if unavailable, complete steps 1–4 + 6–7 and record
  step 5 as blocked (see §4).

## 2. Steps (exact, in order)

1. **Scaffold into a staging dir, then move** (`sv create` refuses/naggs
   on non-empty dirs):
   ```bash
   cd /Users/al/Studio/projects/fairprice
   npx sv@latest create .scaffold-tmp --template minimal --types ts --no-add-ons --install npm
   rsync -a --ignore-existing .scaffold-tmp/ ./
   rm -rf .scaffold-tmp
   npm install
   ```
   (`--ignore-existing` protects `.gitignore` and `CLAUDE.md`; then APPEND
   the sv-generated ignore entries to the existing `.gitignore` by hand:
   `node_modules`, `/.svelte-kit`, `/build`, `.env`, `.env.*`,
   `!.env.example`, `/test-results`.)
2. **Add tooling add-ons non-interactively:**
   ```bash
   npx sv@latest add vitest playwright eslint prettier --install npm
   ```
   (If any add-on name is rejected, run `npx sv add` interactively and
   select exactly: vitest, playwright, eslint, prettier — nothing else.)
3. **Pin the Vercel adapter** (T2-platform R1):
   ```bash
   npm install -D @sveltejs/adapter-vercel
   ```
   Edit `svelte.config.js`: import and use `@sveltejs/adapter-vercel`
   in place of `adapter-auto`; remove `@sveltejs/adapter-auto` from
   `package.json` via `npm uninstall @sveltejs/adapter-auto`.
4. **Directory skeleton** (empty dirs carry a `.gitkeep`):
   `src/lib/server/engine/` (the pure engine — server-only by path
   convention: SvelteKit never bundles `src/lib/server/**` into the
   client; this satisfies T2-engine §2.2's packaging rule),
   `src/lib/server/data/`, `src/lib/server/catalogue/`,
   `src/routes/api/`, `tests/e2e/`.
5. **Local Supabase:**
   ```bash
   npx supabase@latest init
   npx supabase start
   ```
   Record the printed local anon/service keys into `.env` (gitignored);
   create `.env.example` with the variable NAMES only:
   `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`.
6. **Smoke test file** — `src/lib/server/engine/smoke.test.ts`:
   one Vitest test asserting `1 + 1 === 2` (placeholder proving the
   test wiring; the engine brief replaces it).
7. **Verify, capture, commit:**
   ```bash
   npm run dev -- --open=false &   # confirm it serves, then kill it
   npm run test:unit -- --run      # vitest green
   npx playwright install chromium
   npm run test:e2e                # the sv-generated demo e2e green
   npm run lint
   ```
   Then /apv-capture (entity.progressed or completed on THIS plan id) and
   commit with first line:
   `feat(scaffold): SvelteKit app skeleton with vitest/playwright/adapter-vercel`

## 3. Out of scope (do not touch)

- No cloud: no Vercel project, no Supabase cloud project, no DNS, no
  email provider, no B2 bucket (operator-assisted wiring brief follows).
- No engine code beyond the smoke test; no schema/migrations; no UI
  beyond what sv generates; no CI workflow yet (arrives with the cloud
  wiring); no MCP.
- Do not modify `planning/`, `docs/`, `reference/`, `CLAUDE.md`, `.apv*`,
  `.exfu/` (except: nothing), or the existing `.gitignore` lines.

## 4. Verification & failure protocol

Done = all four commands in step 7 green + `git status` clean after
commit + the dev server responded on :5173. If Docker is unavailable for
step 5: complete everything else, write `.env.example` anyway, and record
in the capture summary that local Supabase is pending Docker — that is a
REVISE-state completion, not silent success. Any other failure: stop,
capture what was done as entity.progressed, report the exact failing
command and output.
