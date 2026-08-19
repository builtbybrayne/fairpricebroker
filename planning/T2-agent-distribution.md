---
id: T2-agent-distribution
plan_kind: thematic
tier: 2
status: draft
---

# T2-agent-distribution — the agent doorway

## 0. Human summary (plain language)

**This is the blueprint for making AI assistants first-class users** — so
when someone asks their AI "help me agree a rate with this contractor", the
assistant can run the whole thing through Fair Price Broker rather than
just mentioning us. It covers the machine doorway (the same actions humans
get, exposed to agents), the credentials and speed limits that keep agents
from misbehaving, and the discoverability work (machine-readable docs and
directory listings) that makes assistants find and trust us. The hardest
rule: an agent acts for ONE side of a negotiation and must never be able to
peek at the other side — enforced by what the doorway can return, not by
politeness. Two decisions need Alastair — at the bottom.

Everything below this line is the detailed version, written for the agents
doing the work.

---

> Spawned from `T1-top-level` §3 theme 3 (19 Aug 2026). Inherits T1 §2 by
> reference — especially §2.3 (agent-native, with exclusions). Owns the
> agent-credential and rate-limiting security surface (T1 §3). Venture
> ambition on record: "most agent-trusted source of price reconciliation".

## 1. Why (theme intent)

Agents are a distribution channel, not a revenue line (free tier is what
agents invoke), and an empty niche: incumbents cite, we let agents DO the
job. The doorway must therefore be trivially discoverable, boringly
standard, and blindness-safe even against a curious agent.

## 2. How — architectural principles

1. **Parity with humans, per tier.** Every *public product capability* has
   an agent-invocable equivalent with the same reach a human has at that
   auth tier (T1 §2.3). One shared handler per capability serves both the
   human-facing route and the agent surface (pattern re-adopted, T1 Q4) —
   capability drift between the two is a defect.
2. **Exclusions are structural.** Privileged, cross-party, and raw-data
   operations are not exposed to agents — not as hidden endpoints, but as
   absent ones. An agent surface can only return payload classes its
   caller's role may see (T2-engine §2.2 / T2-data-layer construction).
3. **An agent acts for one party.** Agent credentials attach to exactly
   one role in one session (or one user/org identity for lifecycle
   operations). There is no credential shape that can address both sides
   of a blind session. Party invites are the join mechanism for agents
   exactly as for humans.
4. **MCP is the front door; HTTP is the same door.** The MCP server and
   the plain HTTP API expose the same shared handlers with the same auth
   and limits; MCP tool descriptions are written for cold agents (state
   the blindness rules in the tool text — an agent should learn the
   product's ethics from the tool list alone).
5. **Discoverability is shipped, not hoped for:** machine-readable API
   description, agent-readable docs, `.md` twins of public pages,
   `llms.txt`, and listings in MCP registries/directories. The
   methodology page doubles as the agents' citation source.
6. **Rate limits and abuse controls sized for agents:** per-credential and
   per-IP limits on session creation, invite issuance, and email sends;
   invite-URL guessing throttled; free-tier quotas enforced at the shared
   handler so both doors share one budget.

## 3. What — components

1. **Agent credential system**: issuance (per user/org; per-party session
   grants via invites), scoping, revocation, usage visibility to the
   owning account.
2. **MCP server**: full free-tier lifecycle — create/configure a session
   from a template, issue invites, submit/recall a party's meter (as that
   party only), poll status, fetch role-safe results, run casual
   reconciliations, commission and respond to surveys ("fillable by
   humans, agents, or API" is a venture commitment). Tool set generated
   from the same capability registry as the HTTP routes.
3. **HTTP API**: the same capabilities, conventional REST-ish shape, for
   integrators who don't speak MCP.
4. **Discovery artefacts**: OpenAPI-style description, `.md` page twins,
   `llms.txt`, agent docs page, registry/directory submissions.
5. **Abuse and quota layer**: limits above, plus anomaly flags surfaced
   to the ops scorecard.

## 4. Verification approach (binding on T3s)

- Cross-door parity test: the capability registry is enumerated and each
  entry asserted to exist and behave identically via MCP and HTTP.
- Blindness adversarial tests: an agent credential for party A attempts
  every discoverable operation to reach party B's inputs/distance — all
  must fail with authorisation errors, including on casual-mode endpoints
  invoked against blind sessions.
- Rate-limit tests: throttle behaviour on session creation, invites,
  join-URL enumeration.
- Discovery lint: `.md` twins and `llms.txt` present for every public
  page; MCP tool descriptions carry the party-scoping statement.

## 5. Open questions (HITL)

- **Q1 — registry targets and order.** Which MCP registries/directories
  to submit to first (and whether the ChatGPT Apps SDK entrypoint from the
  prototype design is in scope for v1 or a fast-follow)? Leaning:
  registries at launch; Apps SDK fast-follow.
- **Q2 — agent respondents in surveys.** Venture docs say survey tables
  are fillable by agents. Any constraint (labelling agent-submitted
  responses as such in the commissioner's table)? Leaning: yes, flag
  agent-submitted rows — honesty-of-data cheap now, painful to retrofit.
