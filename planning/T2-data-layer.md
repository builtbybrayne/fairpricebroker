---
id: T2-data-layer
plan_kind: thematic
tier: 2
status: draft
---

# T2-data-layer — the vault and the ledger

## 0. Human summary (plain language)

**This is the blueprint for the data: what we store, who may see what, and
how today's entries become tomorrow's valuable dataset.** It enforces the
product's core promise in the database itself — nobody, including a curious
programmer or an AI agent, can read the other side's numbers — and it makes
sure every entry is tagged (industry, role, region, currency, date) so the
anonymous statistics we may one day publish or sell are being collected
correctly from day one. It also covers the privacy-law mechanics (people
can export or erase their own data) and the boring-but-vital nightly
routine: aggregate, export for the scorecard, back up. Two decisions need
Alastair — at the bottom.

Everything below this line is the detailed version, written for the agents
doing the work.

---

> Spawned from `T1-top-level` §3 theme 4 (19 Aug 2026). Inherits T1 §2 by
> reference — especially §2.1 (blindness), §2.4 (metadata + disclosure
> boundary), §2.7 (measure the loop). Owns authorisation/blindness
> enforcement and role-safe payload construction (T1 §3; T2-engine §2.2).
> Datastore ruled: Postgres via Supabase (T1 §5 Addendum 3).

## 1. Why (theme intent)

Two assets live here: the trust (blindness that is true in the schema, not
promised in the UI) and the option on a data business (expectation data
that exists nowhere else — worthless unless the metadata is captured from
row one). Both are day-one schema decisions that cannot be retrofitted.

## 2. How — architectural principles

1. **Blindness is a database property.** Party inputs are isolated by
   row-level security so a party's credential can only ever select its own
   rows; the engine runs under a service role server-side; **role-safe
   payloads are constructed here** — this layer consumes the engine's
   field classification (party-safe / host-safe / internal-only) and emits
   per-role payload objects; surfaces and agent doors receive only those.
   The no-deal contract (own distance only) is enforced at construction.
2. **Money is NUMERIC.** All prices stored as arbitrary-precision decimals
   (T2-engine §2.6): no floats in schema, no rounding at rest; display
   transforms happen in surfaces.
3. **Metadata at entry** (T1 §2.4): every session/response row carries
   vertical (template), role, region, currency, date. Templates supply
   defaults; entry flows may refine. Absent metadata is stored as
   explicitly-unknown, never guessed.
4. **The aggregate boundary is N≥20 and one-way.** Published/benchmark
   data comes only from aggregate views computed over ≥20 underlying rows
   per cell; raw rows never leave (disclosure boundary, T1 §2.4:
   data-subject access and controlled processing excepted). Aggregates are
   SQL views/materialised views — reviewable, versioned in the repo.
5. **Attribution is a first-class table:** share-link ref codes issued per
   shared artefact, joined at signup/session-creation, so loop→signup is a
   query, not an inference. Completed-reconciliation activation events are
   written here (the venture's activation metric).
6. **Events are rows** (T1 §2.7): product events into a plain events
   table; the scorecard agent reads via a read-only role or the nightly
   export (whichever proves simpler in practice — both remain available).
7. **The nightly routine** is one scheduled job: refresh aggregates,
   export events/aggregates snapshot to the library scope, `pg_dump` to
   the backup target (Supabase free tier carries no managed backups — the
   dump IS the backup until Pro). Job failure pages the scorecard, not a
   human inbox.
8. **GDPR mechanics distinguish records from identity:** sessions are
   never deleted, but PII is purgeable — personal identifiers live in
   referenced identity rows so purge/anonymise satisfies erasure without
   destroying the (anonymised) statistical record; per-user data export
   ships with v1; retention windows for quick-mode sessions enforced by
   scheduled cleanup.
9. **Separability:** everything lives in a product-owned Supabase project
   assignable to the Newco; the aggregate dataset is deliberately an exit
   asset (venture ruling).

## 3. What — components

1. **Schema**: identities (user/org), sessions (type, template, state,
   currency, metadata), party positions (NUMERIC tuples, RLS-isolated),
   results (engine payloads with field classes + version metadata),
   invites, credit-ledger (append-only, ready for the deferred paid
   layer), events, attribution refs, honesty-signal storage
   (developer-visible only).
2. **RLS policy set** per role (party, host, org member, developer,
   service) — the vwpa-era isolation approach re-adopted (T1 Q4).
3. **Payload constructor**: the single module that turns an engine result
   + role into a role-safe payload (consumed by surfaces and agent doors).
4. **Aggregate views** with the N≥20 rule and cell definitions (median
   expectation gap, deal-zone width, etc. by vertical × region × quarter).
5. **Nightly job**: aggregates, export, dump.
6. **GDPR toolset**: export bundle per user; PII purge routine; quick-mode
   retention sweeper.

## 4. Verification approach (binding on T3s)

- RLS adversarial suite: every role attempts counterparty reads by every
  route (direct select, view, function) — must fail at the database.
- Payload-construction golden tests per role/mode/deal-outcome, including
  the no-deal own-distance-only contract and the casual full-detail
  exception.
- Aggregate-boundary tests: cells with <20 rows never materialise; raw
  values unreachable through any published view.
- Precision round-trip: 4-d.p. values in and out unchanged.
- Purge test: after PII purge, the statistical row survives, the identity
  is gone, exports contain nothing personal.

## 5. Open questions (HITL)

- **Q1 — quick-mode retention window** (shared with T2-product-surfaces
  Q3): adopt the prototype's 30 days now? Leaning yes, revisit at paid
  layer.
- **Q2 — backup target for the nightly `pg_dump`.** The library scope
  (Dropbox) is convenient but holds business context; a separate
  product-owned bucket is cleaner for separability. Leaning: separate
  bucket (cheap object storage), scorecard confirms freshness.
