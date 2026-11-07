-- ============================================================
--  TEST INVESTOR — SEED DATA.  NOT REAL.
--
--  Creates a demonstration investor so you can sign in to the portal
--  and see every section populated: balance, money flow, monthly
--  income, the reserve pot and the annual cap.
--
--  ⚠  This writes fake deposits and distributions into your database.
--     Everything it creates is tagged so it can be removed cleanly —
--     run seeds/test-investor-remove.sql when you are done. Do not
--     leave it in place once you have real investors.
--
--  BEFORE RUNNING THIS
--  1. Supabase → Authentication → Users → "Add user"
--       Email:    test.investor@bpsquant.com
--       Password: pick one, write it down — you log in with it
--       Tick "Auto Confirm User" so no email is needed.
--  2. Run supabase/migrations/2026-11-07-distributions.sql if you have
--     not already (otherwise the Monthly income section stays empty —
--     everything else still works).
--  3. Paste this whole file into the SQL editor and run it.
--
--  Then sign in at https://www.bpsquant.com/portal.html
-- ============================================================

DO $$
DECLARE
  v_uid   UUID;
  v_units NUMERIC;
  v_has_distributions BOOLEAN;
BEGIN
  SELECT id INTO v_uid FROM auth.users
   WHERE lower(email) = 'test.investor@bpsquant.com';

  IF v_uid IS NULL THEN
    RAISE EXCEPTION
      'Create the auth user first: Authentication -> Users -> Add user, email test.investor@bpsquant.com, tick Auto Confirm User. Then run this again.';
  END IF;

  -- ---------- profile ----------
  INSERT INTO public.profiles (id, name, role)
  VALUES (v_uid, 'Test Investor', 'investor')
  ON CONFLICT (id) DO UPDATE SET name = 'Test Investor', role = 'investor';

  -- ---------- unit price history ----------
  -- Rises about 8% over the period. Deliberately NOT more: this account
  -- is also paid $16,200 out in cash, and cash leaving the fund has to
  -- show up as a lower unit price, or the figures would count the same
  -- profit twice.
  INSERT INTO public.nav_history (date, nav_per_unit, note) VALUES
    ('2026-01-01', 1.0000, 'TEST SEED'), ('2026-02-01', 1.0120, 'TEST SEED'),
    ('2026-03-01', 1.0205, 'TEST SEED'), ('2026-04-01', 1.0290, 'TEST SEED'),
    ('2026-05-01', 1.0410, 'TEST SEED'), ('2026-06-01', 1.0255, 'TEST SEED'),
    ('2026-07-01', 1.0390, 'TEST SEED'), ('2026-08-01', 1.0505, 'TEST SEED'),
    ('2026-09-01', 1.0640, 'TEST SEED'), ('2026-10-01', 1.0430, 'TEST SEED'),
    ('2026-11-01', 1.0620, 'TEST SEED'), ('2026-11-07', 1.0807, 'TEST SEED')
  ON CONFLICT (date) DO NOTHING;

  -- ---------- deposits and withdrawals ----------
  DELETE FROM public.capital_events WHERE investor_id = v_uid AND note LIKE 'TEST SEED%';
  INSERT INTO public.capital_events (investor_id, type, amount, units, nav_at_txn, date, note) VALUES
    (v_uid, 'deposit',    100000, 100000 / 1.0000, 1.0000, '2026-01-05', 'TEST SEED — opening deposit'),
    (v_uid, 'withdrawal',  10000,  10000 / 1.0290, 1.0290, '2026-04-02', 'TEST SEED — partial withdrawal'),
    (v_uid, 'deposit',     25000,  25000 / 1.0390, 1.0390, '2026-07-14', 'TEST SEED — top-up');

  SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN units ELSE -units END), 0)
    INTO v_units
    FROM public.capital_events WHERE investor_id = v_uid;

  INSERT INTO public.investor_accounts (investor_id, units, since, note)
  VALUES (v_uid, v_units, '2026-01-05', 'TEST SEED')
  ON CONFLICT (investor_id) DO UPDATE
    SET units = EXCLUDED.units, since = EXCLUDED.since, note = 'TEST SEED';

  -- ---------- ten months of income, covering every case ----------
  SELECT to_regclass('public.distributions') IS NOT NULL INTO v_has_distributions;
  IF v_has_distributions THEN
    DELETE FROM public.distributions WHERE investor_id = v_uid;
    INSERT INTO public.distributions
      (investor_id, period, opening_value, target_rate, target_amount,
       profit_amount, reserve_delta, paid_amount, shortfall_delta, mode, note)
    VALUES
      -- good months: target paid, surplus into the pot
      (v_uid,'2026-02-01',100000,0.0170,1700, 2400,  700,1700,   0,'cash','TEST SEED'),
      (v_uid,'2026-03-01',100000,0.0170,1700, 1900,  200,1700,   0,'cash','TEST SEED'),
      -- short month: the pot tops the payment back up to target
      (v_uid,'2026-04-01',100000,0.0170,1700, 1100, -600,1700,   0,'cash','TEST SEED'),
      (v_uid,'2026-05-01',100000,0.0170,1700, 2600,  900,1700,   0,'cash','TEST SEED'),
      -- losing month: the pot covers part, the rest is owed
      (v_uid,'2026-06-01',100000,0.0170,1700,-1800,-1200,1200, 500,'cash','TEST SEED'),
      (v_uid,'2026-07-01',100000,0.0170,1700, 2200,  500,1700,   0,'cash','TEST SEED'),
      (v_uid,'2026-08-01',100000,0.0170,1700, 1500, -200,1700,   0,'cash','TEST SEED'),
      (v_uid,'2026-09-01',100000,0.0170,1700, 2800, 1100,1700,   0,'cash','TEST SEED'),
      -- bigger loss: pot drained again
      (v_uid,'2026-10-01',100000,0.0170,1700,-3100,-1400,1400, 300,'cash','TEST SEED'),
      (v_uid,'2026-11-01',100000,0.0170,1700, 2000,  300,1700,   0,'cash','TEST SEED');
  END IF;

  RAISE NOTICE 'Test investor ready: % units. Distributions seeded: %.',
    round(v_units, 4), v_has_distributions;
END $$;

-- What you should see after signing in as test.investor@bpsquant.com:
--   balance              ~$123,570.94
--   you put in            $115,000   ($125,000 in, $10,000 out)
--   you've earned         ~$24,771   = "every $100 you put in has earned $20"
--   income paid to you    $16,200    over ten months
--   your reserve pot      $300       of a $10,200 cap
--   owed to you           $800       from the two losing months
--   this year so far      $16,200    against a ~$25,208 annual cap
