# Supabase setup guide for BPSQuant

Follow these steps once to connect the web app to a real backend.
Total time: about 15 minutes.

---

## 1. Create a free Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (free).
2. Click **New project**.
3. Give it a name (e.g. `bpsquant`), choose a region close to you, and set a strong database password. Save the password — you'll need it for the SQL editor.
4. Wait ~2 minutes for the project to provision.

---

## 2. Run the schema

1. In your Supabase project, go to **SQL Editor** (left sidebar).
2. Click **New query**.
3. Open `supabase/schema.sql` from this repo and paste the entire contents.
4. Click **Run** (or press `Ctrl+Enter`).
5. You should see "Success. No rows returned." — the tables, RLS policies, and trigger are all set up.

---

## 3. Enable Realtime on the trades table (for live feed)

1. In Supabase, go to **Database → Replication**.
2. Under "supabase_realtime", toggle ON the **trades** table.

---

## 4. Create user accounts

### Create your manager account (Kevin)

1. Go to **Authentication → Users → Add user**.
2. Enter your own email and a strong password. Click **Create user**.
3. Note the UUID shown for your account (it looks like `xxxxxxxx-xxxx-...`).

### Set your role to manager

In the SQL editor, run:
```sql
UPDATE public.profiles SET role = 'manager', name = 'Kevin' WHERE id = 'YOUR-MANAGER-UUID-HERE';
```

### Create investor accounts

For each investor:
1. Go to **Authentication → Users → Invite user**.
2. Enter their email. Supabase will send them a sign-up link.
3. Once they sign up, note their UUID from the Users list.
4. In the investor portal (after you log in as manager), use the "Update investor units" form to assign their units.

Or you can create investors directly in SQL — see `supabase/seed.sql` for the pattern.

---

## 5. Add seed / test data (optional)

If you want to populate the app with realistic test data:

1. First complete Step 4 and collect the UUIDs for your test users.
2. Open `supabase/seed.sql` and replace the placeholder UUIDs at the top.
3. Run it in the SQL editor.

---

## 6. Get your API keys

1. Go to **Settings → API** in your Supabase project.
2. Copy the **Project URL** (e.g. `https://xxxx.supabase.co`).
3. Copy the **anon (public)** key — the long `eyJhbGci...` string.

> **Never use the `service_role` key in the web app.** The anon key is safe to
> put in client-side code because Row Level Security (RLS) controls everything.

---

## 7. Configure the web app

Open `scripts/config.js` and paste your keys:

```javascript
supabase: {
  url:     "https://xxxx.supabase.co",
  anonKey: "eyJhbGci...",
},
```

Save and push to GitHub. Done — the web app will now use real auth and your database.

---

## 8. Daily operation as fund manager

### After each trading day:

1. Log in to the **Investor Portal** at `yourdomain.com/portal.html`.
2. In the **Update NAV** panel: enter today's date, NAV per unit (total fund value ÷ total units), and optionally the AUM.
3. If you want to record trades, use the **Log a trade** form.

### When an investor deposits:

1. Receive their funds.
2. Calculate the units they receive: `amount ÷ current NAV per unit`.
3. In the portal's "Update investor units" form: enter their Supabase User ID and their new total units.
4. In Supabase SQL editor, add a capital event:
   ```sql
   INSERT INTO public.capital_events (investor_id, type, amount, units, nav_at_txn, date, note)
   VALUES ('INVESTOR-UUID', 'deposit', 10000.00, 8.2507, 1212.00, CURRENT_DATE, 'Initial deposit');
   ```

### What investors see

Investors log in at `/portal.html` with their email/password and see:
- Current value (their units × latest NAV)
- Net invested, total gain/loss, total return
- Capital events (deposit/withdrawal history)
- Account value chart over time

---

## Security notes

- **RLS is the security boundary** — every table has Row Level Security enabled. Investors can only see their own data; the manager can see everything.
- **The anon key is safe to commit** to this repo. It can only do what RLS allows.
- **Supabase Auth** handles password hashing, sessions, and JWTs. You never store passwords yourself.
- **Investor data** (amounts, units, returns) is never visible to other investors — enforced by `investor_id = auth.uid()` policies.

---

## What comes next (v3+)

- Automated NAV update from broker API (instead of manual entry)
- Trade import from broker execution reports
- Email statements to investors (Supabase Edge Functions + Resend)
- Two-factor authentication
- Compliance / KYC documents storage
