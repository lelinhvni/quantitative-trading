# BPSQuant — project status

Last updated: 7 November 2026. Live at **www.bpsquant.com**, served from `main`
via GitHub Pages. The working branch is `claude/website-perfection-c9jctk`;
publishing is a fast-forward of `main` to it.

---

## Waiting on you

Nothing below is broken. Each item is live but dormant until someone with the
right dashboard access finishes it.

| # | What | Where | Why it matters |
|---|---|---|---|
| 1 | Run `supabase/migrations/2026-11-07-distributions.sql` | Supabase SQL editor | Until then the portal's Monthly income section shows the target and "no distributions recorded yet". Everything else works. |
| 2 | Add `SUPABASE_SERVICE_KEY` and `GMAIL_APP_PASSWORD` | GitHub → Settings → Secrets → Actions | Turns on the enquiry emails. Takes about two minutes and needs no new account. |
| 3 | Decide the **%** of fees paid into the reserve | Clause 6.5A, and §2 of the FY2027 letter | The one blank in the agreement. 25–50% is a credible commitment. |
| 4 | Decide minimum subscription and currency | §3 of the FY2027 letter | Two more blanks. |
| 5 | Have a licensed securities attorney review the agreement | — | It is a capped-participation security. Every document still carries the DRAFT FOR LEGAL REVIEW banner. |

---

## Contact-form email

An enquiry is **always** saved to `contact_leads` and shown in the portal's
Inbox tab. Email is the notification on top, and three routes are wired:

1. **`notify-lead`** Edge Function → Resend. Not deployed (returns 404). Sends
   only if a `RESEND_API_KEY` secret exists, otherwise answers `skipped`.
2. **FormSubmit** relay, from the browser. Was returning Cloudflare 522 all of
   6–7 Nov — their outage, not ours. Recovers by itself; the first enquiry
   after that triggers a one-time confirmation email to info@bpsquant.com that
   must be clicked once.
3. **Gmail via GitHub Actions** (`.github/workflows/email-new-leads.yml`),
   every 15 minutes, from info@bpsquant.com. Dormant until item 2 above.

Exactly one email goes out: each route runs only if the one before it did not
send. If every route fails, the form says so and offers a prefilled `mailto:`
rather than claiming the message was received.

---

## Investor portal

Reading level is Flesch-Kincaid grade 3.8. Units and NAV appear nowhere in the
investor's view — they remain the accounting engine, nothing more.

- **Hero** — balance, what you put in, what you earned ("every $100 you put in
  has earned $20"), income paid.
- **Where your money went** — a statement that reconciles line by line.
- **Monthly income** — last month in one plain sentence, the reserve pot as a
  bar against its six-month cap, cards for target / this year so far / last
  payment / anything owed, and twelve months of history.
- **How your balance is worked out** — three short items, collapsed.

`accountMaths()` in `scripts/portal.js` derives every figure once, so the
headline, the statement and the explanation cannot disagree.

### Test account

`supabase/seeds/test-investor.sql` populates a demonstration investor; create
the login first (Authentication → Users → Add user,
`test.investor@bpsquant.com`, auto-confirm). It is idempotent, and
`seeds/test-investor-remove.sql` takes it back out without touching real data.
**Remove it before any real investor is on the system.**

---

## The agreement

Monthly Income Participation Agreement, bilingual EN/VI, 15pp (21 with the EIN
and Arizona exhibits). It is **not in this repository** — it carries the EIN,
ACC business ID and street address, and this repo is public. The rendered PDFs
and DOCX files were delivered in conversation.

Key terms as they now stand:

- Target **1.70% a month**, stated throughout as a target, never a guarantee.
- **Capped**: the most an investor can receive is 12 × Target (20.40% a year),
  plus their reserve filling to six months (10.20%). Profit beyond that is the
  Company's (6.4A). Clause 6.4B states the consequence plainly — gains limited,
  losses not.
- **Smoothing Reserve is per-investor** (6.5). Nobody can draw on another
  investor's pot. A later subscriber starts at nil.
- **Shortfall Ledger is per-investor** (6.6) and repaid from that investor's own
  future profit, before any performance fee.
- No management fee in a losing month (11.5); no performance fee on profit
  already taken under 6.4(a) (11.2).

---

## Open design questions

- **The cap is asymmetric.** Capped up, uncapped down. Two years of +40% then
  −20% nets +12% uncapped but −3.7% capped. That is the structure working as
  designed, but it is the first thing a sophisticated investor's adviser will
  find.
- **The portal is English only.** The investors are Vietnamese. Translating it
  would do more for comprehension than any further simplification.
- **No manager UI for distributions.** Recording a month's income means
  inserting rows by hand. A Distributions tab in the ops console that computes
  the waterfall for every investor from one profit figure is the obvious next
  piece of work.
