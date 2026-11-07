-- ============================================================
--  Remove the test investor and everything the seed created.
--
--  Run this once you have finished looking at the portal, and
--  certainly before any real investor is on the system. Every row
--  the seed wrote is tagged 'TEST SEED', so this takes out that and
--  nothing else — real deposits and real unit prices are untouched.
--
--  The login itself is not deleted here, because deleting an auth
--  user from SQL can leave orphaned rows behind. Remove it in
--  Supabase → Authentication → Users → test.investor@bpsquant.com →
--  Delete user, after running this.
-- ============================================================

DO $$
DECLARE
  v_uid UUID;
  n_dist INT := 0; n_cap INT := 0; n_nav INT := 0;
BEGIN
  SELECT id INTO v_uid FROM auth.users
   WHERE lower(email) = 'test.investor@bpsquant.com';

  IF v_uid IS NULL THEN
    RAISE NOTICE 'No test.investor@bpsquant.com user found — nothing to remove.';
  ELSE
    IF to_regclass('public.distributions') IS NOT NULL THEN
      DELETE FROM public.distributions WHERE investor_id = v_uid;
      GET DIAGNOSTICS n_dist = ROW_COUNT;
    END IF;

    DELETE FROM public.capital_events WHERE investor_id = v_uid;
    GET DIAGNOSTICS n_cap = ROW_COUNT;

    DELETE FROM public.investor_accounts WHERE investor_id = v_uid;
    DELETE FROM public.messages           WHERE investor_id = v_uid;
    DELETE FROM public.withdrawal_requests WHERE investor_id = v_uid;
    DELETE FROM public.profiles           WHERE id = v_uid;
  END IF;

  -- Seeded unit prices, but only the ones nobody real is relying on.
  DELETE FROM public.nav_history nh
   WHERE nh.note = 'TEST SEED'
     AND NOT EXISTS (SELECT 1 FROM public.capital_events ce WHERE ce.date = nh.date);
  GET DIAGNOSTICS n_nav = ROW_COUNT;

  RAISE NOTICE 'Removed: % distributions, % capital events, % unit prices.', n_dist, n_cap, n_nav;
  RAISE NOTICE 'Now delete the login: Authentication -> Users -> test.investor@bpsquant.com -> Delete user.';
END $$;
