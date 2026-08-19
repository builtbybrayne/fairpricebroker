# fairprice

The technical repo for the **Pricing Meter** venture: a two-party blind Van
Westendorp price-reconciliation tool (WhaleyBear Ltd / proposed Newco).
Company thesis: own the software implementation of the Van Westendorp Price
Sensitivity Meter as a suite of tools — horizontal core, verticals as templates.

**The project is split across two locations — agents here must know both exist:**
- **This repo = technical work only.** Git-backed and APV-tracked
  (capture-before-commit; event log `.apv/events.jsonl`). Do not manage
  business/GTM work here.
- **Business/GTM state (source of truth):** the ExFu library scope at
  `/Users/al/Dropbox/ExFu Library/scopes/pricing-meter/` — `context/` notes and
  `context/research/` updates (later docs supersede earlier). That folder is
  Dropbox-managed and does NOT use APV (yet) — don't look for an event log
  there. Load the `exfu-library` skill before working there. The split itself
  is recorded in that scope's
  `context/Project Split -- Repo and Library -- 19 Aug 2026.md`.
- **Founding conversation:** `reference/Pricing Meter -- Conversation Transcript (16-18 Aug 2026).md`
- **Algorithm + prior design (reference only, not a starting point):**
  `/Users/al/Studio/projects/vwpa/` — working prototype `product/vwpa.jsx`
  (full convergence engine) and `docs/plans/2026-03-17-fairpricebroker-design.md`.
  Good on algorithm, auction lifecycle, and the server-side-only constraint;
  superseded on GTM/pricing by the Aug 2026 scope docs.

**Standing frame:** this venture is explicitly *practice* at an
agentically-enabled startup, not an identity project. Capture new ideas into
the library scope where they can exist without becoming promises; planning
convergence (milestones, direction) is always Alastair's own deliberate act.

<!-- apv:orientation -->
## agent-plan-visualiser (APV) tracking

This repository is tracked by agent-plan-visualiser. The append-only event
log at `.apv/events.jsonl` is the source of truth for planning state;
plans and status prose are secondary. After each logical unit of work and
**before committing**, run /apv-capture to append a sealed event block —
the pre-commit guard rejects uncaptured commits (`git commit --no-verify`
is the sanctioned hatch for capture-free trivia). Land branches on main via
/apv-merge; the gate hooks refuse a main that fails the integrity check.
Sub-projects registered under `[projects]` in `.apv-config.toml` share
this one log — membership is derived from location at creation (or an
operator's `project.assigned`), never a fork of the record.

This project REQUIRES the agent-plan-visualiser plugin (the version floor is
pinned in `.apv-config.toml` `[requires]`). The **skill**
`exfu-agent-plan-visualiser:apv-capture` is the cross-client primitive;
`/apv-capture` is only its Claude-Code slash alias and may be absent in
Cowork/Desktop even when the skill is loaded. Before any work, confirm that
skill is available. If NEITHER the skill nor the command is present, this
session did not load the plugin (typical in worktree checkouts that lack a
committed `.claude/settings.json`, or in Cowork/Desktop before install) — do
NOT fabricate captures by hand. Load it:
`/plugin marketplace add https://github.com/ExFu/exfu-marketplace` then
`/plugin install exfu-agent-plan-visualiser@exfu`; or read the skill source and
follow it directly — the newest
`~/.claude/plugins/cache/*/*agent-plan-visualiser/*/skills/apv-capture/SKILL.md`
(same pattern for apv-merge and using-agent-plan-visualiser).

Fresh clone or new worktree? The git hooks live in `.git/` and are not
committed — run /apv-init once here to install the capture-guard and gate
adapters. It is idempotent: it repairs only what is missing.
<!-- /apv:orientation -->
<!-- exfu-agent-planning-and-delegating:orientation -->
## exfu-agent-planning-and-delegating (ExFu Agent Planning & Delegating)

This project depends on the **exfu-agent-planning-and-delegating** plugin: the ExFu Planning
Methodology and grounded multi-model delegation. Its skills — `exfu-delegate`
(hand well-specified work to a subscription-billed CLI delegate under enforced
contracts), `exfu-grounding` (compose handoff grounding from the tiered plan
corpus), and `exfu-planning-methodology` (the tiered-planning doctrine) — manage
planning and delegation here. Provider wiring lives in `.exfu/providers.toml`.

Confirm at session start that these skills are available (they may be
plugin-namespaced, e.g. `exfu-agent-planning-and-delegating:exfu-delegate`). If NONE are available,
this session did not load the plugin (typical in worktree checkouts lacking
`.claude/settings.json`, or a surface where the global enable did not
propagate) — resolve the skill source directly, in order:

1. Prefer the enabled install path reported by `claude plugin list --json`.
2. Else read the highest-version match under
   `${CLAUDE_CONFIG_DIR:-~/.claude}/plugins/cache/*/exfu-agent-planning-and-delegating/*/skills/<name>/SKILL.md`.
3. Else the plugin is not installed —
   `claude plugin marketplace add https://github.com/ExFu/exfu-marketplace.git`
   then `claude plugin install exfu-agent-planning-and-delegating@exfu`.
<!-- /exfu-agent-planning-and-delegating:orientation -->
