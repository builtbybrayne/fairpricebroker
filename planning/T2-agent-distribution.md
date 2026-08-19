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
just mentioning us. It defines one master list of everything the product
can do, so the human site, the AI doorway, and the plain API can never
drift apart; the credentials and speed limits that keep agents from
misbehaving; and the discoverability work (machine-readable docs and
directory listings) that makes assistants find and trust us. The hardest
rule: an agent acts for ONE side of a negotiation and can never reach the
other side — the only both-sides operation is the casual "we're in the same
room" calculator, which never touches stored blind sessions at all. One
decision needs Alastair — at the bottom.

Everything below this line is the detailed version, written for the agents
doing the work.

---

> Spawned from `T1-top-level` §3 theme 3 (19 Aug 2026). Inherits T1 §2 by
> reference — especially §2.3 (agent-native, with exclusions). Owns the
> agent-credential and rate-limiting security surface (T1 §3). Venture
> ambition on record: "most agent-trusted source of price reconciliation".
>
> Revised 19 Aug 2026 addressing Codex audit round 1 (verdict: revise;
> 1 high / 4 medium / 2 low — return at
> `.exfu/returns/t2-agent-distribution-audit-r1.json`).

## 1. Why (theme intent)

Agents are a distribution channel, not a revenue line (free tier is what
agents invoke), and an empty niche: incumbents cite, we let agents DO the
job. The doorway must therefore be trivially discoverable, boringly
standard, and blindness-safe even against a curious agent.

## 2. How — architectural principles

1. **One authoritative capability catalogue.** A single registry of every
   public product capability, keyed by: capability name, auth tier,
   session types it applies to, invoking role, payload class returned, and
   rate-limit class. The human routes, the MCP tools, and the HTTP API are
   all *adapters over this catalogue* — none may define a capability the
   catalogue lacks, and a catalogue entry missing from any adapter is a
   defect. Parity is therefore testable as set equality plus behavioural
   equivalence, not adapter-vs-adapter comparison.
2. **Exclusions are structural.** Privileged, cross-party, and raw-data
   operations are absent from the catalogue's public tiers — not hidden,
   absent. An adapter can only return payload classes the caller's
   authenticated role may see (constructed by T2-data-layer).
3. **The casual exception, precisely** (T1 §2.1's sole exception): casual
   reconciliation is a *separate, unauthenticated, stateless-by-default
   operation* that accepts BOTH tuples directly from its one caller
   (co-present parties) and returns the full-detail casual payload class.
   It cannot accept, resolve, or reference blind-session identifiers,
   invites, or any stored counterparty input — there is no code path from
   a blind session to full-detail output. MCP tool text states this.
4. **An agent acts for one party — the credential contract.** Two
   credential kinds, and only two:
   - *Account credentials*: issued to a user/org; scope = that account's
     own lifecycle operations (create sessions, issue invites, list own
     sessions, commission surveys). Least-privilege scopes at issuance;
     expiry by default; rotation supported; revocation immediate (checked
     per request, not per token lifetime).
   - *Session-party grants*: obtained by redeeming an invite, exactly as a
     human does; scope = ONE role in ONE session (submit/recall that
     party's tuple, read that party's payload class). No credential shape
     can address both parties of a blind session; grants die with the
     session's close.
   Seams: T2-platform authenticates principals; this theme issues and
   manages agent credentials/grants; T2-data-layer enforces what any
   authenticated role may read. Storage of grants follows the invite
   model (T2-product-surfaces §2.10).
5. **MCP is the front door; HTTP is the same door.** Both adapters serve
   the same catalogue with the same auth and limits. MCP tool descriptions
   are written for cold agents — each tool states its party-scoping and
   blindness consequences in its own text, so an agent learns the
   product's ethics from the tool list alone.
6. **Discovery is derived, not written twice:** the machine-readable API
   description is **OpenAPI 3.1**, generated from the capability
   catalogue (single source of truth); MCP tool schemas generate from the
   same source. Every public page has a `.md` twin; `llms.txt` at root;
   an agent-docs page; registry/directory listings. Verification checks
   semantic synchronisation with the catalogue (names, auth scopes,
   blindness statements), not mere file presence.
7. **Rate limits are a total function over the catalogue.** Every
   catalogue entry carries one of the named rate-limit classes — none
   exempt: `create` (sessions, surveys), `invite` (issuance + email
   sends), `join` (invite redemption; enumeration-throttled), `submit`,
   `read/poll` (status + results), `compute` (casual reconciliations —
   engine-intensive), `discovery` (docs, cheap). Budgets are shared per
   credential AND per IP across both doors (one budget, two doors);
   free-tier quotas enforced in the shared handler; exhaustion returns
   typed retry-after errors; anomaly flags surface to the ops scorecard.

## 3. What — components

1. **The capability catalogue**: the registry itself, versioned in-repo;
   adapters and docs generate from it.
2. **Agent credential system**: issuance, scoping, expiry/rotation,
   immediate revocation, usage visibility to the owning account;
   invite-redemption grant flow for session parties.
3. **MCP server**: full free-tier catalogue — create/configure sessions
   from templates, issue invites, redeem an invite into a party grant,
   submit/recall as that party, poll status, fetch role-safe results, run
   casual reconciliations (per §2.3), commission surveys, submit survey
   responses ("fillable by humans, agents, or API" is a venture
   commitment).
4. **HTTP API**: the same catalogue, conventional REST-ish shape.
5. **Discovery artefacts**: generated OpenAPI 3.1 description, `.md`
   twins, `llms.txt`, agent-docs page, registry/directory submissions.
6. **Abuse and quota layer**: the class policy of §2.7 plus anomaly
   surfacing.

## 4. Verification approach (binding on T3s)

- Catalogue parity: enumerate the catalogue; assert set equality of
  capabilities across human routes, MCP, and HTTP at each auth tier, and
  behavioural equivalence per entry (same inputs → same payload class and
  effects through every door).
- Human-capability sweep: every user-facing action in
  T2-product-surfaces' components maps to a catalogue entry or an
  explicit, documented exclusion — no unlisted capabilities.
- Blindness adversarial tests: a party-A grant attempts every catalogue
  operation against party B's data — all fail with authorisation errors;
  the casual operation refuses any session/invite identifier.
- Credential lifecycle tests: expiry, rotation, immediate revocation
  mid-session, scope-escalation attempts, grant death at session close.
- Rate-limit tests per class and per door, including read/poll and
  compute classes, shared credential+IP budget accounting, exhaustion and
  reset behaviour.
- Discovery sync tests: OpenAPI and MCP schemas regenerate cleanly from
  the catalogue and match the deployed adapters; `.md` twins exist for
  every public page; tool texts carry the party-scoping statement.

## 5. Open questions (HITL)

- **Q1 — is a ChatGPT Apps SDK adapter an owned doorway?** Architecturally:
  is the Apps-SDK-style entrypoint (from the prototype design) a third
  adapter over the same catalogue that this theme owns, or out of scope
  until a partner integration demands it? Leaning: in-scope as a defined
  adapter seam, built only when scheduled by the milestone plan. (Registry
  submission priority and launch timing are milestone-plan matters, not
  architecture — removed from this question per audit.)

*(Resolved out of round 1: agent-submitted survey responses are recorded
with two separate fields — immutable submission channel (human UI / API /
MCP) and declared response origin (human / agent / unknown) — storage
belongs to T2-data-layer, commissioner-facing presentation to
T2-product-surfaces.)*

## 6. Rulings (19 Aug 2026, operator, in-chat)

- **R1 (Q1 — Apps SDK): RULED as leaning.** The ChatGPT-Apps-style
  entrypoint is an owned adapter seam over the capability catalogue,
  designed now, built only when the milestone plan schedules it.
- **R2 — casual statelessness confirmed** (data-layer ruling): the casual
  operation persists nothing but an anonymous completion event; §2.3's
  "stateless-by-default" is now stateless, full stop.
