# Phase 2 context — for agent handover

## The product

**fairprice.broker** is a two-sided salary overlap tool for third-party recruitment.

### Three roles — keep these distinct

- **The broker** — the third-party agency or contingency recruiter. They earn commission only on completed placements. They are the primary user of the tool.
- **The hiring company** — the broker's client. They have an open role with a salary budget, which the broker knows because the client told them.
- **The candidate** — the person being placed.

### How it works

1. The broker enters the hiring company's salary budget into the tool.
2. The broker sends the candidate a private link.
3. The candidate answers Van Westendorp-style questions about their salary expectations — from "what I'd accept for a role I love" through to "what would feel suspiciously high."
4. Neither side sees the other's raw numbers in a way that feels exposing.
5. The broker gets a two-dimensional output:
   - How aligned or stretched the salary overlap is
   - Whether this placement can close on remuneration alone, or whether non-remuneration factors (equity, flexibility, culture, purpose) need to be meaningfully in play — on either side

### Why candidates answer honestly

Naming a lower salary floor signals openness and increases match chances. It doesn't hurt them — it helps them. This is the load-bearing incentive alignment argument.

### The problem it solves

Candidates are coached never to name a salary first. Early screening calls become a standoff. Brokers either push for a number (friction) or proceed blind (risk). Misalignment only surfaces too late — a declined offer, a reneged acceptance, wasted time, lost commission.

---

## The validation approach

Rather than an AI-mediated interview, we're using an interactive guided demo that steps through the full workflow. The recruiter plays both roles — first as the broker, then as the candidate — and experiences the product in situ. Directed questions and comment boxes are embedded at each stage. Form submissions happen progressively so abandoned flows still yield data.

### What we're trying to learn

- Is salary misalignment a real, recurring pain and at what stage does it hit?
- Does the two-sided privacy model feel important to them?
- Would they actually send a link to a candidate — and would candidates engage?
- Does the incentive alignment argument feel believable?
- Is the overlap output clear and actionable?
- Does the non-remuneration steer feel useful or gimmicky?
- Would they pay, and what model makes sense — per placement, monthly subscription, or credits?

---

## Target customer

**Beachhead:** Third-party / agency / contingency recruiters. Highest pain, clearest incentive to pay. They only earn on placement so every misaligned candidate is a direct financial cost.

**Second wave:** Startups hiring directly — same pain, smaller volume, more price-sensitive.

---

## Current status

A rough working version is live on the founder's own consultancy site. A standalone product could ship in approximately one week of focused work. The demo is being built on Netlify.

---

## Outreach

### Direct LinkedIn message (semi-warm contacts — recruiters who have previously placed or tried to place the founder)

> Hey [name], hope things are good. I'm building something aimed at the salary mismatch problem — the standoff where neither side wants to name a number first. I'd love to know if it resonates with how you work. It's a 3-minute interactive demo, no forms to fill in upfront. Would you be up for taking a look?

### LinkedIn post (targeting recruiters broadly)

> Salary mismatch kills placements. And the fix most recruiters use — asking the candidate what they're looking for — is broken. Candidates are coached not to answer.
>
> I'm building something that breaks the standoff without putting either side on the spot. Two minutes to try it and tell me what you think?
>
> [link]
