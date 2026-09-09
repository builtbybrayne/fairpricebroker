---
id: T3-m2-domain-terms
plan_kind: thematic
tier: 3
t2_parent: T2-product-surfaces
milestone: M1-working-instrument
status: active
---

# T3 — One domain vocabulary under every vertical

> **Planning assessment, 9 Sep 2026. No code changes.** Written in answer
> to the operator's direction that every reconciliation is the same
> mechanism, that recruiter / candidate / hiring company are display
> names for underlying seats, and that ownership must be typed from the
> start. §1 is what exists, §2 assesses the proposed terms, §3 is the
> recommended model, §4 the access model, §5 the blast radius, §6 the
> decisions still open. This plan supersedes the naming parts of
> `T3-m2-hiring-workspace` (its candidate-side product thinking stands).

## 0. Human summary

The product already has one underlying vocabulary; it is just not the
one we want. Today the record is a *session*, its people are *parties*
with a mathematical *direction*, the broker is a *host*, and the
recruitment tables added this week (*roles*, *role_candidates*) are
vertical words that leaked into the schema. The proposal is to name the
underlying things once, in words true of any monetary exchange, and to
let each vertical carry a small dictionary that says what to call them
on screen. The proposal holds up. The one place it needs sharpening is
ownership, where a typed owner record is right but the shape of that
record decides how much re-plumbing organisations will cost later.

## 1. What exists today

| Concept | Today's word | Where it lives |
|---|---|---|
| the record of one two-party reconciliation | `session` (row), "reconciliation" in copy and PRODUCT.md | `sessions`, everywhere in code |
| the two sides | `party` with `direction` ∈ low-preferring / high-preferring | `session_participants.direction`, engine `Role` |
| the person in the middle | `host` (`is_host`) | `session_participants`, `is_session_host()`, payload class *host-full* |
| who created it and in which seat | `composition` ∈ creator-as-party / creator-as-host, plus `creator_direction` | `sessions`, `create_invited_session` |
| the vertical's configuration | `template` (`template_id`, `recruitmentTemplate`) | `sessions.template_id`, `src/lib/templates/` |
| the container for many responses | `role` (recruitment-specific) | `roles`, `role_candidates`, added 9 Sep |
| who may see what | payload classes party / blind-host / host-full / developer, `host_visibility` per template | `payloadConstructor.ts`, `sessions.host_visibility` |
| a way in | `invite` (grant, token, email-bound or not) | `invites` |
| ownership | `creator_identity_id`, `creator_auth_uid`, `owner_kind` + `owner_id` on tags only | scattered |

Two real ambiguities already bite: `session` collides with the auth
session (`safeGetSession` sits next to `readSession` in the same files),
and `role` will collide with auth roles the moment teams exist.

## 2. The proposed terms, assessed

**Reconciliation.** Keep; it is already the canonical word in PRODUCT.md
and the plans. Make it the row name too (`sessions` → `reconciliations`)
so the code stops saying session for two different things.

**Buyer / seller.** Right, and it maps exactly onto the engine's
low-preferring / high-preferring: the buyer is the side that prefers a
lower price, by definition, in every vertical. Recommendation: the
domain and schema say `buyer` / `seller`; the engine keeps
low-preferring / high-preferring because it is a maths library with
golden vectors and property tests written in those words, and the
mapping is a one-line constant at the boundary. Casual mode already
frames its sides as "Buying it" / "Selling it", so nothing changes
there beyond the internal names.

**Offerer.** This is the missing noun, and it is the same object as this
week's *role*: the standing thing that many others respond to. Call it
an **offer**. An offer is *offered by* one side (`offered_by` ∈ buyer /
seller) and collects reconciliations, one per respondent. Recruitment
is a buyer-offered offer with many seller responses; a freelancer
quoting a day rate to several clients is a seller-offered offer with
many buyer responses. The rule the operator named falls out directly:
**the offerer sees every response; each responder sees only their own
reconciliation.** Nothing else needs a special case.

**Broker.** Keep the word, drop *host*. A broker is a seat, not a side,
and may *act for* a side: the recruitment consultant enters the hiring
company's figures. So a participant has a `seat` ∈ buyer / seller /
broker, and a broker participant may carry `acts_for` ∈ buyer / seller.
Whether the broker sees figures stays a vertical setting
(`broker_sees_figures`, today `host_visibility`).

**Vertical dictionary.** Each vertical's template gains a dictionary:
the vertical's name, the buyer's name, the seller's name, the offer's
name, the broker's name, the default offerer, whether a broker is
allowed, and the multi-response rules. Recruitment, as ruled:

| Term | Recruitment display |
|---|---|
| vertical | Salary Negotiation |
| buyer | Hiring Company |
| seller | Candidate |
| offer | Opportunity |
| broker | Recruitment Consultant |
| default offerer | buyer |
| broker allowed | yes |
| many sellers | when buyer-offered |
| many buyers | when seller-offered |

One note on "Salary Negotiation": the product's thesis is that it
replaces the negotiation with a neutral signal, and the copy leans on
that. As a vertical name it is exactly what both sides search for, so it
is the right label; the copy inside should keep saying "before you
negotiate" rather than "negotiate here".

## 3. The recommended model

```
offer                     one standing offer, by one side, in one vertical
  id, vertical, offered_by (buyer|seller), title, currency,
  offerer_figures (v1..v4, nullable until entered),
  access_map_id, created_at

reconciliation            one two-party reconciliation (today: session)
  id, vertical, offer_id (nullable: casual and one-off reconciliations),
  state (open|locked|closed|cancelled), currency,
  broker_sees_figures, is_demo, visit_id, orchestration_*, created_at

participant               a seat at one reconciliation (today: session_participants)
  reconciliation_id, seat (buyer|seller|broker), acts_for (buyer|seller|null),
  invite_id, bound_auth_uid

figures                   a side's four points (today: party_positions)
  reconciliation_id, side (buyer|seller), v1..v4, status

invite                    a way into a seat (unchanged in shape)
  reconciliation_id, seat, acts_for, email (nullable, learned on redeem),
  token_hash, expires_at, redeemed_*

result, share_ref, visit, event, honesty_signal_storage   unchanged
tag, tag_link             unchanged in shape; owner becomes an access map
```

Payload classes rename with the seats: *party* → **side**, *blind-host*
→ **broker-blind**, *host-full* → **broker-full**, *developer* stays.
The disclosure rule R11 reads "every side in a broker-sees-figures
reconciliation is told before entry".

The engine boundary: `side === 'buyer' ? 'low-preferring' :
'high-preferring'`, in one function, tested once.

## 4. Ownership and access

The operator's instinct is right on both counts: an actor reference
must carry a kind as well as an id, and a definite owner record with
members is better than a bare owner column. The refinement I would make
is to separate the two questions the record answers:

- **Who owns this?** One actor, always. Billing, purge and transfer need
  a single answer.
- **Who may do what with it?** A list of actors with a role.

A record that holds both is the **access map** (the operator's name;
"permissions aggregation" says the same thing at three times the
length). Shape:

```
access_map          id, owner_kind (user|team|org), owner_id, created_at
access_member       map_id, actor_kind (user|team|org), actor_id,
                    role (owner|manager|member|viewer), added_at
```

Rules:

- Every owned object (offer, tag collection, later a credit account)
  carries `access_map_id`. A reconciliation inherits its offer's map;
  a casual or one-off reconciliation has none.
- Every user gets a personal map on first sign-in: owner = the user,
  one member row, role owner. Today's `creator_auth_uid` columns become
  that map's id. Nothing changes for a solo recruiter.
- Sharing is adding a member to a map, or pointing an object at a
  different map. Ad-hoc arrangements are just maps with unusual members.
- At least one member with role `owner` at all times, enforced by a
  trigger; the map's `owner_*` pair is the billing owner and must be a
  member with role `owner`.
- Membership of a team or org is a separate table (`actor_membership`)
  and is resolved at policy time: a user may act through a map if they
  are a member directly or through a team or org that is. This keeps
  RLS to one helper, `may_access(map_id, role)`, called from every
  policy.
- Credits stay on the identity for now; when orgs arrive, a credit
  account gains an `access_map_id` and debits resolve through it.

Alternative names considered: *custody*, *keyring*, *share*, *circle*,
*grant set*. Access map is the plainest; the only risk is confusion with
RLS "policies", which are the enforcement, not the record.

## 5. Blast radius

This is a breaking change to every layer, but there is no production
data, every migration is a week old, and the test suites are the safety
net. Two ways to do it:

1. **Rebaseline.** Rewrite the migration set as one clean baseline in
   the new words, reset the local database, rename in code and tests in
   one pass. Cleanest result; one large commit; the audit trail is the
   plan plus the commit.
2. **Rename chain.** Add migrations that rename tables, columns and
   enum values and replace the guarded functions and policies. Keeps
   the history readable at the cost of a schema that carries its old
   names in the migration log for ever.

Recommendation: **rebaseline**, because the guarded SQL functions and
the RLS policies are where blindness lives and they are far safer
rewritten whole than patched by rename.

What moves, by layer:

- Schema: tables `sessions`, `session_participants`, `party_positions`,
  `roles`, `role_candidates`, `tags` (owner), all guarded functions
  (`create_invited_session`, `redeem_invite`, `submit_position`,
  `recall_position`, `cancel_session`, `is_session_host`,
  `session_role_for`, `request_visibility_disclosure`), every policy,
  the new `access_map` tables and helper.
- Data core: `db.ts` roles unchanged; `principal.ts`,
  `payloadConstructor.ts`, `orchestrator.ts`, `visits/events` (session
  id fields), payload class names.
- Server modules: `recruitment/*` become `offers/*` with the vertical
  dictionary driving copy; `casual/*` renames A/B to buyer/seller.
- Templates: `recruitmentTemplate` gains the dictionary; the casual
  scenarios already fit.
- Routes: `/app/roles` → `/app/offers`, `/app/r/[id]` → `/app/o/[id]`,
  `/app/s/[id]` → `/app/o/[id]/[reconciliation]` or a flat
  `/app/rec/[id]`; the candidate surface `/s/[id]/party` →
  `/r/[id]/side`. Display copy uses the dictionary.
- Tests: 172 unit (engine untouched; data core and templates renamed),
  20 e2e (selectors and copy), the join fixtures.
- Documents: PRODUCT.md terminology line, T2-product-surfaces roles
  table, T3-m1-data-core §2.2, DESIGN.md's One Meaning Rule ("you /
  them" stays; the seats map onto it), the surface briefs, README.

Estimate: one focused session with the suites green at the end; the
risk sits in the guarded functions and policies, which is why the
rebaseline route is preferred.

## 6. Decisions for the operator

> **Ruled 9 Sep 2026 (operator, in chat):** all eleven as recommended.
> Core words reconciliation / buyer / seller / offer; the access map as
> shaped in §4; rebaseline the schema; the rest taken as read.

| # | Decision | Recommendation |
|---|---|---|
| 1 | Row name for one reconciliation | `reconciliation` (drop *session*) |
| 2 | Side names | `buyer` / `seller`; engine keeps low/high-preferring behind a one-line map |
| 3 | The standing container | `offer`, with `offered_by`; each response is a reconciliation, no extra noun |
| 4 | The middle seat | `broker`, with `acts_for`; `broker_sees_figures` per vertical |
| 5 | Vertical dictionary fields | vertical, buyer, seller, offer, broker names; default offerer; broker allowed; multi-response rules |
| 6 | Recruitment dictionary | as ruled: Salary Negotiation, Hiring Company, Candidate, Opportunity, Recruitment Consultant, buyer-offered |
| 7 | Ownership record | `access_map` + `access_member`, typed actors, one owner enforced, personal map per user |
| 8 | Credits | stay on the identity now; move to a map-owned credit account with orgs |
| 9 | Migration route | rebaseline the schema, not a rename chain |
| 10 | Route slugs | generic in code (`/app/offers`, `/app/o/[id]`), vertical words only in copy |
| 11 | Casual mode | Party A / B become buyer / seller internally; on-screen titles come from the scenario |

## 7. Verification when built

- Engine golden vectors unchanged and green (the maths did not move).
- Blindness suite: a seller never receives buyer figures; a broker
  without `broker_sees_figures` receives the broker-blind class; a
  responder never sees another response on the same offer.
- Access: a user reaches an offer only through a map they are a member
  of; a personal map is created on first sign-in; removing the last
  owner is refused.
- Every recruitment screen reads the dictionary: no literal "candidate"
  or "client" in a shared component.
