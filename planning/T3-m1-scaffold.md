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
> Revised again same day addressing audit r2 (verdict: revise; 1 high /
> 3 medium): every remaining mutation is now a literal command (dirs,
> .env construction, staging allowlist, commit, clean-tree assertion);
> the dev probe uses `--strictPort` with a bounded readiness loop and a
> cleanup trap; verification is an explicitly numbered V1–V5 suite; a
> Docker-blocked run can no longer count as Done.
> Revised a third time addressing audit r3 (verdict: revise; 2 high /
> 1 medium / 1 low — the delegation round cap is now exhausted, so this
> revision is unaudited and goes to the operator with the full trail):
> two-phase capture/commit protocol removing the completion-ordering
> circularity; clean-worktree preflight plus a staged-path allowlist
> check making the commit contents mechanically closed; V4 accepts the
> probe only on bind-evidence from our own process and kills the whole
> process group; stale step references fixed.

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
  capture-before-commit applies to every commit this brief makes (§2
  step 9).
- Docker Desktop is required only for step 6 (local Supabase) and was
  NOT running at authoring time; step 6 defines the skip protocol.

**Preflight assertions (run first; any failure = STOP and report):**

```bash
cd "$(git rev-parse --show-toplevel)"
test ! -f package.json || { echo "ABORT: package.json already exists"; exit 1; }
test ! -f vite.config.ts || { echo "ABORT: vite.config.ts already exists"; exit 1; }
test -d planning && test -f CLAUDE.md && test -d .apv || { echo "ABORT: not the fairprice checkout root"; exit 1; }
test -z "$(git status --porcelain)" || { echo "ABORT: worktree not clean - resolve before scaffolding:"; git status --porcelain; exit 1; }
node -e 'const [M,m]=process.versions.node.split(".").map(Number); process.exit(((M===20&&m>=19)||(M===22&&m>=12)||M>22)?0:1)' \
  || { echo "ABORT: Node $(node --version) outside ^20.19.0 || >=22.12.0"; exit 1; }
```
(The clean-worktree assertion is what makes step 9's staging allowlist
sound: nothing pre-staged or stray can ride along into the commit.)

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
5. **Directory skeleton** — exact commands (`src/lib/server/**` is
   server-only by SvelteKit path convention, satisfying T2-engine §2.2's
   packaging rule; the Vitest `server` project covers tests there;
   Playwright matches `**/*.e2e.ts` anywhere, so `tests/e2e/` is the
   home for future non-demo e2e):
   ```bash
   mkdir -p src/lib/server/engine src/lib/server/data src/lib/server/catalogue src/routes/api tests/e2e
   touch src/lib/server/engine/.gitkeep src/lib/server/data/.gitkeep src/lib/server/catalogue/.gitkeep src/routes/api/.gitkeep tests/e2e/.gitkeep
   ```
6. **Local Supabase** — gated on Docker:
   ```bash
   docker info >/dev/null 2>&1 || echo "DOCKER UNAVAILABLE"
   ```
   If `DOCKER UNAVAILABLE`: skip to step 7, still create `.env.example`
   as below, and record step 6 as blocked in the step-9 capture — a
   REVISE-state outcome that is never Done (§4). Otherwise:
   ```bash
   npx -y supabase@2.115.0 init
   npx -y supabase@2.115.0 start
   npx -y supabase@2.115.0 status -o env
   ```
   Construct `.env` (gitignored) mechanically from the env-format
   output — this script handles both CLI key eras (anon/service_role
   and publishable/secret) and aborts rather than guessing:
   ```bash
   npx -y supabase@2.115.0 status -o env > /tmp/sb-status.env
   getvar() { grep -E "^$1=" /tmp/sb-status.env | head -1 | cut -d= -f2- | tr -d '"'; }
   SB_URL="$(getvar API_URL)"
   SB_ANON="$(getvar ANON_KEY)"; [ -n "$SB_ANON" ] || SB_ANON="$(getvar PUBLISHABLE_KEY)"
   SB_SR="$(getvar SERVICE_ROLE_KEY)"; [ -n "$SB_SR" ] || SB_SR="$(getvar SECRET_KEY)"
   SB_DB="$(getvar DB_URL)"
   if [ -z "$SB_URL" ] || [ -z "$SB_ANON" ] || [ -z "$SB_SR" ] || [ -z "$SB_DB" ]; then
     echo "ABORT: unmapped supabase status variables; names present:"; cut -d= -f1 /tmp/sb-status.env; exit 1
   fi
   printf 'PUBLIC_SUPABASE_URL=%s\nPUBLIC_SUPABASE_ANON_KEY=%s\nSUPABASE_SERVICE_ROLE_KEY=%s\nSUPABASE_DB_URL=%s\n' \
     "$SB_URL" "$SB_ANON" "$SB_SR" "$SB_DB" > .env
   ```
   On the ABORT branch: STOP and report the printed variable NAMES (the
   values are secrets — never paste them into a report). Then create
   `.env.example` with names only:
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
8. **Verify.** One setup command, then five numbered checks; each check
   has a mechanical pass criterion, and `verification.tested` in step 9
   records exactly these five by number.
   Setup (not a check — downloads the browser the Vitest client project
   and Playwright both use):
   ```bash
   npx playwright install chromium
   ```
   - **V1 — unit tests:** `npm run test:unit -- --run` → PASS: exit 0.
   - **V2 — e2e tests:** `npm run test:e2e` → PASS: exit 0 (the script
     self-runs `playwright install`; builds + previews on :4173).
   - **V3 — lint:** `npm run lint` → PASS: exit 0.
   - **V4 — dev server serves:** strict port, bind evidence from OUR
     process, bounded readiness loop, guaranteed cleanup:
     ```bash
     set -m   # job control: the background pipeline gets its own process group
     npm run dev -- --port 5173 --strictPort > /tmp/fairprice-dev.log 2>&1 &
     DEV_PID=$!
     trap 'kill -- -"$DEV_PID" 2>/dev/null' EXIT
     DEV_OK=""
     for i in $(seq 1 30); do
       kill -0 "$DEV_PID" 2>/dev/null || break
       if grep -q "localhost:5173" /tmp/fairprice-dev.log; then
         curl -sf --max-time 2 -o /dev/null http://localhost:5173/ \
           && kill -0 "$DEV_PID" 2>/dev/null && { DEV_OK=1; break; }
       fi
       sleep 1
     done
     kill -- -"$DEV_PID" 2>/dev/null; wait "$DEV_PID" 2>/dev/null
     trap - EXIT; set +m
     if [ -n "$DEV_OK" ]; then echo "V4 PASS"; else echo "V4 FAIL"; tail -20 /tmp/fairprice-dev.log; exit 1; fi
     ```
     PASS: prints `V4 PASS`. The curl is accepted only after OUR
     process's log shows it bound `localhost:5173` and only while that
     process is still alive — an occupied port makes `--strictPort`
     exit, the loop sees the dead PID, and the failure branch exits
     nonzero (no cross-service false positive). With `set -m` the
     `kill -- -PGID` terminates the entire npm→sh→vite process group,
     and `wait` reaps it. On FAIL, report the tail; do not probe other
     ports.
   - **V5 — adapter wiring** (step 4's assertion, re-run now as part of
     the suite):
     ```bash
     grep -q "@sveltejs/adapter-vercel" vite.config.ts && ! grep -q "adapter-auto" package.json && echo "V5 PASS"
     ```
     PASS: prints `V5 PASS`.
9. **Capture and commit — two phases** (capture is via the
   **apv-capture skill**, `exfu-agent-plan-visualiser:apv-capture`;
   `/apv-capture` is its Claude-Code alias — in a client without the
   alias, read and follow the skill source per CLAUDE.md; the capture
   appends to `.apv/events.jsonl`, the §3 guard's one sanctioned
   `.apv` write).

   **Phase 1 — the scaffold commit.** Capture `entity.progressed` on
   THIS plan id with `verification.tested` recording V1–V5 by number
   and result. Then stage the allowlist (conditionals handle the
   Docker-blocked run mechanically), verify nothing outside it is
   staged, and commit:
   ```bash
   git add package.json package-lock.json .gitignore vite.config.ts playwright.config.ts tsconfig.json eslint.config.js prettier.config.js .npmrc .prettierignore README.md .vscode src static tests .env.example .apv/events.jsonl
   [ -d supabase ] && git add supabase
   git diff --cached --name-only | grep -Ev '^(package\.json|package-lock\.json|\.gitignore|vite\.config\.ts|playwright\.config\.ts|tsconfig\.json|eslint\.config\.js|prettier\.config\.js|\.npmrc|\.prettierignore|README\.md|\.vscode/|src/|static/|tests/|\.env\.example|\.apv/events\.jsonl|supabase/)' \
     && { echo "ABORT: staged paths outside the allowlist (listed above)"; exit 1; } || true
   git status --porcelain | grep -Ev '^[AM]  ' \
     && { echo "ABORT: unstaged/untracked paths remain (listed above)"; exit 1; } || true
   git commit -m "feat(scaffold): SvelteKit app skeleton with vitest/playwright/adapter-vercel"
   test -z "$(git status --porcelain)" && echo "TREE CLEAN"
   ```
   PASS: commit succeeds and `TREE CLEAN` prints.

   **Phase 2 — completion, only if §4's Done condition now holds**
   (V1–V5 passed, phase 1 printed `TREE CLEAN`, Supabase ran green):
   capture `entity.completed` citing phase 1's commit in its summary,
   then make the APV-only follow-up commit:
   ```bash
   git add .apv/events.jsonl
   git commit -m "chore(scaffold): record scaffold completion (APV capture only)"
   test -z "$(git status --porcelain)" && echo "TREE CLEAN 2"
   ```
   PASS: `TREE CLEAN 2` prints. On a Docker-blocked run, SKIP phase 2
   entirely — the plan stays `progressed` (§4).

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
  apv-capture skill itself performs in step 9 (both phases) —
  capture-before-commit is repo law and does not conflict with this
  guard.
- No config edits: `vite.config.ts`, `playwright.config.ts`,
  `tsconfig.json`, `eslint.config.js`, `prettier.config.js` are used
  exactly as generated.

## 4. Verification & failure protocol

**Done** (= `entity.completed`, recorded in step 9 phase 2) requires
ALL of: V1–V5 pass, the phase-1 commit lands with `TREE CLEAN`, AND
step 6 ran green (local Supabase up, `.env` written). The ordering is
never circular: phase 1 records `entity.progressed` and lands the work;
phase 2 records completion only after phase 1's success is observed,
in its own APV-only commit. A Docker-blocked run is **never Done**: it
is an incomplete, REVISE-state outcome — phase 1 only, with the blocked
step named in the capture, `.env.example` still created, V1–V5 still
run, and M1 item 1 reported open pending Docker. Any other failure:
stop, capture what was done as `entity.progressed`, and report the
exact failing command and its output. Never mark this brief complete
with a failing or skipped check unreported.

## 5. Erratum (execution, 7 Sep 2026)

Two §1/§2 facts corrected by the first execution (orchestrator-run; the
Codex implement round returned honestly blocked — its sandbox has no
network for npx/npm):

1. **adapter-vercel has a build-time Node gate the plan missed.** The
   Vite engines floor (`^20.19.0 || >=22.12.0`) passes Node v25.9.0, but
   `@sveltejs/adapter-vercel` refuses to *infer a runtime* under a
   non-LTS local Node ("use Node 20, 22, or 24 ... or explicitly specify
   a runtime"). No installed Node satisfied both gates. Fix, sanctioned
   by the error message and now applied: `adapter({ runtime:
   'nodejs22.x' })` in `vite.config.ts` — an explicit production
   runtime pin, committed. §3's "no config edits" guard is amended
   accordingly: this one-line runtime option is part of the scaffold's
   deliverable; everything else in the generated configs stays
   untouched.
2. **Step 6 ran the Docker-blocked branch** (Docker Desktop not
   running): local Supabase pending, `.env.example` created, plan
   remains `progressed` per §4 — M1 item 1 stays open until a
   Supabase-green run.
3. **Lint needed scoping.** The generated `npm run lint` runs Prettier
   over the whole repo, which would reformat the planning corpus,
   reference archives, and delegation artifacts. `.prettierignore` now
   excludes `planning/`, `docs/`, `reference/`, `.exfu/`, `.apv/`,
   `.claude/`, and `CLAUDE.md` — the app is linted, the record is not
   touched. V3 passes with this scoping.
