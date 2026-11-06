# BPSQuant — Go-live guide (real database + public launch)

Follow these steps once to connect the website to a real backend with live
auth, database, and realtime updates. Total time: about 20 minutes.

---

## 1. Create a free Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (free).
2. Click **New project**.
3. Name it (e.g. `bpsquant`), choose a region close to your investors, and set
   a strong database password. Save that password.
4. Wait ~2 minutes for the project to provision.

---

## 2. Run the schema

1. In your Supabase project, go to **SQL Editor** (left sidebar).
2. Click **New query**.
3. Open `supabase/schema.sql` from this repo and paste the **entire** contents.
4. Click **Run**.
5. Expect "Success. No rows returned."

This creates everything in one shot:

| Table | Purpose |
|---|---|
| `profiles` | one row per user, auto-created at signup; `role` = manager / investor |
| `nav_history` | daily NAV per unit (drives every balance on the site) |
| `investor_accounts` | units, lifecycle status, risk preference, phone, private notes |
| `capital_events` | every deposit / withdrawal with NAV + units at transaction |
| `trades` | execution log investors can see |
| `positions` | current open positions |
| `contact_leads` | homepage contact form |
| `messages` | investor ↔ manager message threads |
| `withdrawal_requests` | investor-initiated queue with approve/deny |

Plus server-side functions that keep the books consistent:

- **`record_capital_event(investor, type, amount, date, note)`** — the atomic
  deposit/withdrawal: looks up NAV on that date, computes units, writes the
  event, and updates the balance in a single transaction. Rejects overdrafts.
- **`resolve_withdrawal(request, approve)`** — approves (executing the
  redemption at today's NAV) or denies a request.
- **`set_my_risk_pref(pref)`** — lets investors save their risk preference.

Realtime is enabled by the schema for `trades`, `messages`, `nav_history`,
and `withdrawal_requests` — no dashboard toggles needed.

---

## 3. Create your manager account

1. Go to **Authentication → Users → Add user → Create new user**.
2. Enter your real email and a strong password. Check **Auto Confirm User**.
3. Copy the new user's UUID from the list.
4. In the SQL editor, run:

```sql
UPDATE public.profiles SET role = 'manager', name = 'Kevin Le' WHERE id = 'PASTE-YOUR-UUID';
```

---

## 4. Invite investors

For each investor:

1. **Authentication → Users → Invite user** — enter their email. They receive
   a link to set their password. (Their profile row is created automatically
   with role `investor`.)
2. When their first deposit arrives, record it from the manager portal's
   Capital tab — units are computed automatically from that day's NAV, and a
   pending investor is activated by their first deposit.

No SQL needed for day-to-day operation.

---

## 5. Connect the website

1. **Settings → API** in Supabase: copy the **Project URL** and the
   **anon (public)** key.
2. Open `scripts/config.js` and paste them:

```javascript
supabase: {
  url:     "https://xxxx.supabase.co",
  anonKey: "eyJhbGci...",
},
```

3. Commit and push to `main`. GitHub Pages redeploys automatically.

> **Never put the `service_role` key in the website.** The anon key is safe to
> commit because Row Level Security decides what every request can touch.

---

## 6. First-day data

In the manager portal (or SQL editor), set your opening NAV — everything else
derives from it:

```sql
INSERT INTO public.nav_history (date, nav_per_unit, note)
VALUES (CURRENT_DATE, 1000.0000, 'Fund inception');
```

Then record each investor's opening deposit from the portal's Capital tab.

`supabase/seed.sql` has optional test data if you want a dry run first.

---

## 7. Daily operation

**After each trading day** — log in to the portal as manager:
- **Update NAV**: today's date + NAV per unit (fund value ÷ total units).
- Log trades manually or via CSV upload.

**Deposits** — Capital tab → Record deposit: pick investor, amount, date.
Units are computed and booked atomically.

**Withdrawals** — investors request from their portal; you approve/deny in
the Capital tab. Approval executes the redemption at today's NAV.

**Messages** — investor questions arrive in the Messages tab; replies appear
in their portal instantly (realtime).

---

## 8. Email alerts for new enquiries

Every contact-form submission lands in the portal's **Inbox** tab with an
unread badge. It is also emailed to `info@bpsquant.com`.

### The reliable way — your own Gmail, two secrets (recommended)

A GitHub Action (`.github/workflows/email-new-leads.yml`) checks for new
enquiries every 15 minutes and emails them from **info@bpsquant.com** using
your existing Google Workspace mailbox. No new vendor, no DNS, and no third
party ever sees an enquiry. It uses only the Python standard library, so
there is nothing from PyPI running against your data.

Add two repository secrets — **Settings → Secrets and variables → Actions →
New repository secret**:

| Secret | Where to get it |
|---|---|
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API → **service_role** key |
| `GMAIL_APP_PASSWORD` | Google Account → Security → **App passwords** (needs 2-step verification on) |

Then go to the **Actions** tab → *Email new enquiries* → **Run workflow** to
test it immediately rather than waiting for the schedule.

Until both secrets exist the job exits quietly, so nothing breaks in the
meantime. It tracks what it has already sent in `app_settings`
(`last_lead_notified_at`), so a re-run never emails the same enquiry twice,
and a send that fails halfway is retried on the next run rather than lost.

The `service_role` key bypasses Row Level Security. It is safe in GitHub
Actions secrets (never printed, never exposed to forks), but do not paste it
anywhere public — and never into `scripts/config.js`, which ships to browsers.

### The one-click way — FormSubmit (currently unreliable)

> **Status, 6 Nov 2026:** FormSubmit was returning HTTP 522 — their origin was
> unreachable, so no email could be relayed. It is a free service with no
> uptime guarantee and no status page. Treat it as a bonus, not the main path.

The site posts each enquiry to **FormSubmit**, which emails it on. No account,
no API key, no DNS.

**The only step:** the first time anyone submits the form, FormSubmit emails
`info@bpsquant.com` asking you to confirm the address. Open it and click the
button once. Every enquiry after that arrives automatically.

Submit the form on the live site yourself to trigger that email.

**Then hide the address.** After confirming, FormSubmit gives you a random
alias (like `a1b2c3d4e5f6…`). Put it in `scripts/formsubmit` in
`scripts/config.js` in place of `info@bpsquant.com`, so the inbox is not
sitting in the page source for spam crawlers to find. Nothing else changes.

Until you confirm, enquiries are still saved and still show in the Inbox tab —
nothing is lost, you just do not get the email.

### The private way — Resend (optional, ~10 min)

FormSubmit is a third party, so enquiries pass through their servers on the
way to you. For a fund taking investor enquiries that may matter. Resend keeps
delivery under your own domain instead.

Set it up and it takes over automatically: `notify-lead` sends, FormSubmit is
not called, and you never get two copies of the same enquiry. No page change.

**a. Get a Resend key** — sign up at [resend.com](https://resend.com) (free:
3,000 emails/month). You can skip domain verification at first and let it send
from Resend's test address; verify `bpsquant.com` later to send from your own.
Then create an API key.

**b. Deploy the function** — Edge Functions → Deploy a new function → name it
exactly `notify-lead` → paste `supabase/functions/notify-lead/index.ts` →
Deploy. Then under its **Secrets** add:

| Secret | Value |
|---|---|
| `RESEND_API_KEY` | `re_…` from step a |
| `ALERT_FROM` | `BPSQuant <alerts@bpsquant.com>` — must be on your verified domain |
| `ALERT_TO` | *optional* — only to override the default recipient |

**Where alerts are sent.** By default, to **`info@bpsquant.com`** — the fund's
Google Workspace inbox, which is built into the function. To send them
elsewhere instead, open `/ops.html`, unlock it, and fill in **Enquiry alerts →
Alert email address**. That's saved to the private `app_settings` table in your
database, so a personal address never appears in this public repo, and you can
change it any time without a redeploy. Clearing the field returns alerts to the
default. Priority: `ALERT_TO` secret → `app_settings.alert_to` → `info@bpsquant.com`.

**c. Test** — submit the contact form on the live site. The enquiry appears in
the Inbox tab within a second, and the email arrives at `info@bpsquant.com`
shortly after.

That is the whole setup. There is **no third step**: the website calls
`notify-lead` itself, straight after saving the enquiry, so nothing has to be
wired up in the database. The old `pg_net` trigger in `schema.sql` §17 is no
longer used and must stay dormant — with both paths active, every enquiry is
emailed twice. An untouched database is already safe, because the trigger does
nothing unless its two vault secrets exist. If you created them in an earlier
attempt, remove them:

```sql
select vault.delete_secret('notify_lead_url');
select vault.delete_secret('notify_lead_key');
```

**Until the Resend key is added**, the function answers "skipped" and the site
falls back to FormSubmit. Either way the enquiry is saved and shows in the
Inbox tab. The form never fails because of email.

### How the two fit together

Every enquiry is **always** saved to `contact_leads` and shown in the portal's
Inbox tab. That is the record; email is only the notification on top.

From the browser, on each submission, in order:

1. **`notify-lead`** — sends only if a Resend key is set, otherwise answers
   `skipped`;
2. **FormSubmit** — used only when step 1 did not send.

So exactly one email goes out, whichever is configured. Both run in the
background: the visitor is confirmed as soon as the enquiry is stored, and a
slow or dead relay never makes them wait.

Separately, from GitHub Actions every 15 minutes:

3. **Gmail** — emails anything that arrived since the last run.

Routes 1–2 are instant but depend on a service being up; route 3 is a few
minutes behind but depends only on things you own, so it catches anything the
others missed. Running Gmail alongside a working route 1 or 2 means two copies
of the same enquiry — pick one as the main path and leave the others as the
safety net, or just delete the duplicates.

If the database and every email route are unreachable at once, the form says
so and offers the visitor a prefilled `mailto:` rather than claiming the
message was received.

---

## 9. Going public — launch checklist

- [ ] Supabase project created, schema run, manager account set (steps 1–3)
- [ ] Keys pasted into `scripts/config.js`, pushed, Pages deploy green
- [ ] Opening NAV inserted; test investor invited; test deposit recorded
- [ ] Log in as the test investor: balance, chart, messages all correct
- [ ] Demo credentials removed from the login page (done) and `demoUsers`
      cleared from `config.js` once real auth is confirmed working
- [ ] Optional: custom domain — GitHub repo → Settings → Pages → Custom
      domain (e.g. `www.bpsquant.com`), plus a `CNAME` DNS record pointing
      to `lelinhvni.github.io`; HTTPS is automatic
- [ ] Optional: replace `corsproxy.io` with your own proxy for market data
      if traffic grows

---

## Security notes

- **RLS is the security boundary.** Investors see only their own rows
  (`investor_id = auth.uid()`); the manager role sees everything. The anon
  key cannot bypass this.
- **Money math happens server-side.** Unit issuance/redemption runs inside
  Postgres functions — the browser never computes balances, so a tampered
  client can't corrupt the books.
- **Supabase Auth** handles password hashing, sessions, JWTs, and reset
  emails. No passwords are stored in this repo (delete `demoUsers` from
  `config.js` at launch).

---

## What comes next (v3+)

- Automated NAV update from broker API
- Email notifications (Supabase Edge Functions + Resend)
- Two-factor authentication for the manager account
- Monthly PDF statements
- KYC document storage (Supabase Storage)
