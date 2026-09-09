---
id: T3-m2-hiring-workspace
plan_kind: thematic
tier: 3
t2_parent: T2-product-surfaces
milestone: M1-working-instrument
status: draft
---

# T3 — The hiring workspace: candidates, recruiters and employers as one shared vertical

> **Draft for the operator, 9 Sep 2026.** Written in answer to the
> questions raised in review: can a candidate log back in, do they get a
> record, what happens when they have several roles on the go, could they
> bring recruiters in, and whether "for recruiters", "for employers hiring
> directly" and "for candidates" are one vertical or three. Nothing here
> is built; the recommendation is in §2 and the rest is how it would land.

## 0. Human summary

A salary check always has three seats: the side paying (a client via a
recruiter, or an employer hiring directly), the side being paid (the
candidate), and sometimes a broker in the middle (the recruiter). Today
the product treats the recruiter as the only account holder and the
candidate as a visitor who arrives by link. That is right for the first
sale, but the candidate is the person who might use the instrument
across many roles, and the employer-direct case is the same shape with
one seat removed. The recommendation is **one vertical, "Hiring", with
three views of the same check**, rather than three verticals.

## 1. What is true today

- A candidate reaches their page by a one-time link. On the same
  device the link brings them back (the redeemer is recognised); from
  anywhere else, signing in with the same email at `/signin` and
  opening `/s/<id>/party` works, but nothing lists their checks for
  them. There is no printout or export; the page itself is the record.
- A candidate who answers several roles has several unrelated sessions
  under one email. Nothing joins them.
- The recruiter's account home lists verticals; "Recruiting" is the only
  live one. The scope tag says "Recruiting" on every recruiting route,
  including the candidate's page, which is wrong for a candidate.

## 2. Recommendation

**One vertical: Hiring.** Three roles inside it, each with its own home:

| Seat | Who | Home | Sees |
|---|---|---|---|
| Broker | recruiter | roles → links → results (built) | client budget, both sets of figures (host-full) |
| Payer | employer hiring directly | the same roles page, minus the "client" framing | its own budget, both sets of figures |
| Paid | candidate | "Your applications": every check they have answered, by role title, with outcome and date | own figures, fair salary, overlap; never the other side's numbers |

Why one vertical and not three:

- The engine composition is identical for recruiter-led and
  employer-direct checks: creator-as-host with the low-preferring side
  entered by the creator. The only difference is copy ("the client's
  budget" vs "your budget") and, later, who pays.
- A candidate would otherwise have to look in two places for the same
  kind of thing. They should see one list, with a column that says who
  ran the check (an agency name, or the employer).
- Tags and future organisation ownership (§4) are simpler with one
  vertical key.

The scope tag becomes "Hiring" and the candidate's pages carry it too.
"For recruiters" stays as the marketing entry point for the broker seat;
"For employers" is a second entry point into the same vertical when
employer-direct is switched on.

## 3. The candidate's side, in order

1. **Sign-in that remembers them.** Already naive-possible; make it
   visible: the candidate page gains "Sign in to keep this" (the same
   email) and the account home shows a "Your applications" card when the
   signed-in email has any candidate sessions.
2. **Your applications.** A list: role title (from `roles`), who ran it,
   answered on, fair salary, overlap word. Each row opens the existing
   candidate result page. Data: sessions where `session_role_for` is
   `high-preferring` for the caller, joined to `role_candidates` →
   `roles` for the title. No new tables.
3. **Record.** A print stylesheet on the candidate result page (fair
   salary, overlap, own figures, date) covers "do they get a printout"
   without email. A PDF export can wait for billing.
4. **Bringing a recruiter in.** A candidate who has a recruiter but no
   link could send them an invitation to run a check. This is the
   reverse of today's flow and is worth doing only once employer-direct
   exists (it is the same "invite the paying side" mechanism). Defer;
   record as an inbox item.

## 4. Data architecture notes for organisations

- `tags` already carry `owner_kind` (`'user'` only) and `owner_id`;
  adding `'org'` is a check-constraint change plus a membership table.
- `roles.creator_auth_uid` should become an owner pair the same way
  (`owner_kind`, `owner_id`) before any organisation work; a role owned
  by an org is visible to its members. Do this at the same time as tags
  gain `'org'`, in one migration.
- Verticals are a string key (`'recruiting'` today). Rename to
  `'hiring'` when the vertical is renamed; keep the old key readable.

## 5. Verification when built

- A candidate who answered two roles for two recruiters sees both in
  "Your applications" with the right titles, and cannot open either
  recruiter's page.
- An employer-direct role reads "your budget", never "the client's".
- The scope tag reads "Hiring" on recruiter, employer and candidate
  routes alike.
