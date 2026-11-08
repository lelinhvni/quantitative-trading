# BPSQuant — project status

Last updated: 8 November 2026. Live at **www.bpsquant.com**, served from `main`
via GitHub Pages. The working branch is `claude/website-perfection-c9jctk`;
publishing is a fast-forward of `main` to it.

---

## Waiting on you

Nothing below is broken. Each item is built and live but dormant until
someone with the right dashboard access, or the right judgement call,
finishes it.

### Run these two, in the Supabase SQL editor

| | File | Turns on |
|---|---|---|
| 1 | `supabase/migrations/2026-11-07-distributions.sql` | The investor portal's Monthly income section, and the admin **Income** tab. Until then the Income tab tells you it is missing. |
| 2 | `supabase/migrations/2026-11-08-trade-pnl.sql` | Per-trade profit and the **Realised P&L** panel. Additive and safe on a live table. |

### Add two GitHub secrets

**Settings → Secrets and variables → Actions.** About two minutes, no new account.

| Secret | Where to get it |
|---|---|
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API → **service_role** |
| `GMAIL_APP_PASSWORD` | Google Account → Security → **App passwords** (needs 2-step verification) |

Turns on enquiry emails from info@bpsquant.com, every 15 minutes.

### Decide three numbers

| | What | Where |
|---|---|---|
| 1 | **% of fees** paid into investors' reserves. 25–50% is a credible commitment. | Clause 6.5A, and §2 of the FY2027 letter |
| 2 | **Minimum subscription** | §3 of the FY2027 letter |
| 3 | **Currency** for that minimum | §3 of the FY2027 letter |

### Two contract readings a lawyer should confirm

The waterfall engine had to resolve these to compute anything. Both are
coded the investor-favourable way and shown in the Income tab, but the
agreement does not state either explicitly:

1. **Shortfalls are repaid before the Company keeps anything.** Order is:
   pay target → repay what is owed → fill the investor's reserve → the rest
   is the Company's.
2. **A shortfall repayment counts toward the 12-month annual cap.** An
   investor catching up on a previous year's shortfall uses this year's room.

### Have the agreement reviewed

It is a capped-participation security. Every document still carries the
DRAFT FOR LEGAL REVIEW banner, and should until an attorney clears it.

### Before any real investor

Run `supabase/seeds/test-investor-remove.sql` and delete the
`test.investor@bpsquant.com` login, if you created it.

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

## Admin portal

Eight tabs: Dashboard, Investors, Capital, **Income**, Cash Flow, Trading,
Messages, Inbox.

- **Income** — enter the fund's net trading profit for a month and the whole
  Clause 6 waterfall is computed for every investor: share by units, target,
  reserve, anything owed, the Company's share. Previewed before anything is
  written, upserted on `(investor_id, period)` so a correction replaces a
  month rather than duplicating it, and Save is disabled if the figures do
  not balance. `scripts/waterfall.js`, 35 tests.
- **Trading** — paste trades from any broker or spreadsheet. Columns are
  detected rather than dictated; profit is read from the file when it is
  there and otherwise computed by netting each group. Every import is tagged
  so it can be undone. `scripts/tradeimport.js`, 32 tests.

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
