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
UPDATE public.profiles SET role = 'manager', name = 'Kevin' WHERE id = 'PASTE-YOUR-UUID';
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

## 8. Going public — launch checklist

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
