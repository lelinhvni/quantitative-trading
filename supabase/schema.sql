-- ============================================================
-- BPSQuant — Supabase database schema
-- Run this in: Supabase dashboard → SQL editor → New query → Run
-- ============================================================

-- Don't validate function bodies at creation time (they may reference
-- tables defined later in this file, like pg_dump output does).
SET check_function_bodies = off;

-- ============================================================
-- 1. profiles — one row per auth user (auto-created by trigger)
--    Created first: is_manager() below depends on it.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT '',
  role       TEXT NOT NULL DEFAULT 'investor' CHECK (role IN ('manager', 'investor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Helper: check if current user is a fund manager
--    SECURITY DEFINER bypasses RLS on profiles so we don't get
--    circular policy dependencies.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN SECURITY DEFINER STABLE LANGUAGE SQL AS $$
  SELECT COALESCE(
    (SELECT role = 'manager' FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_manager() TO authenticated;

-- profiles policies (need is_manager, so they come after it)
-- All authenticated users can see names/roles (not sensitive)
DROP POLICY IF EXISTS "auth_read"    ON public.profiles;
DROP POLICY IF EXISTS "self_update"  ON public.profiles;
DROP POLICY IF EXISTS "manager_all"  ON public.profiles;
CREATE POLICY "auth_read"   ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "self_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "manager_all" ON public.profiles FOR ALL USING (is_manager());

-- Trigger: auto-create profile when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'investor')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 3. nav_history — daily NAV per unit (fund manager sets this)
--    Current value = investor_accounts.units × latest nav_per_unit
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nav_history (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  date         DATE        NOT NULL UNIQUE,
  nav_per_unit NUMERIC(18,4) NOT NULL,
  aum          NUMERIC(18,2),          -- total AUM snapshot (optional)
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.nav_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_read"    ON public.nav_history;
DROP POLICY IF EXISTS "manager_all"  ON public.nav_history;
CREATE POLICY "auth_read"  ON public.nav_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "manager_all" ON public.nav_history FOR ALL   USING (is_manager());

-- ============================================================
-- 4. investor_accounts — units held per investor
-- ============================================================
CREATE TABLE IF NOT EXISTS public.investor_accounts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID        NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  units       NUMERIC(18,6) NOT NULL DEFAULT 0,
  since       DATE        NOT NULL DEFAULT CURRENT_DATE,
  note        TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.investor_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self_read"   ON public.investor_accounts;
DROP POLICY IF EXISTS "manager_all" ON public.investor_accounts;
CREATE POLICY "self_read"   ON public.investor_accounts FOR SELECT USING (investor_id = auth.uid());
CREATE POLICY "manager_all" ON public.investor_accounts FOR ALL   USING (is_manager());

-- ============================================================
-- 5. capital_events — deposit / withdrawal history
-- ============================================================
CREATE TABLE IF NOT EXISTS public.capital_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount      NUMERIC(18,2) NOT NULL,
  units       NUMERIC(18,6),           -- units added/removed at time of transaction
  nav_at_txn  NUMERIC(18,4),           -- NAV per unit at time of transaction
  date        DATE        NOT NULL DEFAULT CURRENT_DATE,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.capital_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self_read"   ON public.capital_events;
DROP POLICY IF EXISTS "manager_all" ON public.capital_events;
CREATE POLICY "self_read"   ON public.capital_events FOR SELECT USING (investor_id = auth.uid());
CREATE POLICY "manager_all" ON public.capital_events FOR ALL   USING (is_manager());

-- ============================================================
-- 6. trades — execution log (all investors can see, manager writes)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trades (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  symbol      TEXT        NOT NULL,
  side        TEXT        NOT NULL CHECK (side IN ('BUY', 'SELL')),
  qty         NUMERIC(18,4) NOT NULL,
  price       NUMERIC(18,4) NOT NULL,
  notional    NUMERIC(18,2) GENERATED ALWAYS AS (qty * price) STORED,
  strategy    TEXT,
  status      TEXT        NOT NULL DEFAULT 'filled' CHECK (status IN ('filled', 'partial', 'cancelled', 'pending')),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_read"   ON public.trades;
DROP POLICY IF EXISTS "manager_all" ON public.trades;
CREATE POLICY "auth_read"   ON public.trades FOR SELECT TO authenticated USING (true);
CREATE POLICY "manager_all" ON public.trades FOR ALL   USING (is_manager());

-- Enable Realtime for live trade feed (run this separately if needed)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.trades;

-- ============================================================
-- 7. positions — current open positions (manager maintains)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.positions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol     TEXT        NOT NULL UNIQUE,
  qty        NUMERIC(18,4) NOT NULL DEFAULT 0,
  avg_cost   NUMERIC(18,4) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_read"   ON public.positions;
DROP POLICY IF EXISTS "manager_all" ON public.positions;
CREATE POLICY "auth_read"   ON public.positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "manager_all" ON public.positions FOR ALL   USING (is_manager());

-- ============================================================
-- 8. contact_leads — from the homepage contact form
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contact_leads (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  email      TEXT        NOT NULL,
  message    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contact_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_insert"  ON public.contact_leads;
DROP POLICY IF EXISTS "manager_read" ON public.contact_leads;
-- Anonymous (not logged in) users can submit the contact form
CREATE POLICY "anon_insert"  ON public.contact_leads FOR INSERT TO anon WITH CHECK (true);
-- Only the fund manager can read leads
CREATE POLICY "manager_read" ON public.contact_leads FOR SELECT USING (is_manager());

-- ============================================================
-- 9. Useful view: investor summary (manager only via RLS on base tables)
-- ============================================================
CREATE OR REPLACE VIEW public.investor_summary AS
SELECT
  p.id,
  p.name,
  p.created_at                                 AS joined_at,
  COALESCE(ia.units, 0)                        AS units,
  ia.since,
  COALESCE(ia.units, 0) * COALESCE(
    (SELECT nav_per_unit FROM public.nav_history ORDER BY date DESC LIMIT 1), 1
  )                                            AS current_value,
  COALESCE(
    (SELECT SUM(amount) FROM public.capital_events
     WHERE investor_id = p.id AND type = 'deposit'), 0
  ) -
  COALESCE(
    (SELECT SUM(amount) FROM public.capital_events
     WHERE investor_id = p.id AND type = 'withdrawal'), 0
  )                                            AS net_invested
FROM public.profiles   p
LEFT JOIN public.investor_accounts ia ON ia.investor_id = p.id
WHERE p.role = 'investor';

-- ============================================================
-- v2 MIGRATIONS — investor management, capital automation,
-- withdrawal queue, message center, realtime.
-- Safe to run on an existing v1 database (idempotent).
-- ============================================================

-- ============================================================
-- 10. investor_accounts — lifecycle, risk preference, admin fields
-- ============================================================
ALTER TABLE public.investor_accounts
  ADD COLUMN IF NOT EXISTS status    TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending','active','redeeming','closed')),
  ADD COLUMN IF NOT EXISTS risk_pref TEXT NOT NULL DEFAULT 'balanced'
    CHECK (risk_pref IN ('conservative','balanced','growth','aggressive')),
  ADD COLUMN IF NOT EXISTS phone     TEXT,
  ADD COLUMN IF NOT EXISTS mgr_notes TEXT;   -- private manager notes (RLS: manager writes; investors can read own row — keep sensitive remarks out)

-- Investors set their own risk preference through this function only
-- (they have no UPDATE policy on investor_accounts).
CREATE OR REPLACE FUNCTION public.set_my_risk_pref(p_pref TEXT)
RETURNS VOID SECURITY DEFINER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF p_pref NOT IN ('conservative','balanced','growth','aggressive') THEN
    RAISE EXCEPTION 'invalid risk preference %', p_pref;
  END IF;
  INSERT INTO public.investor_accounts (investor_id, units, risk_pref)
  VALUES (auth.uid(), 0, p_pref)
  ON CONFLICT (investor_id) DO UPDATE SET risk_pref = p_pref, updated_at = now();
END; $$;
GRANT EXECUTE ON FUNCTION public.set_my_risk_pref(TEXT) TO authenticated;

-- ============================================================
-- 11. messages — investor ↔ manager message center
--     Each row belongs to one investor's thread.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_role TEXT        NOT NULL CHECK (sender_role IN ('manager','investor')),
  subject     TEXT,
  body        TEXT        NOT NULL,
  read_at     TIMESTAMPTZ,            -- set when the recipient reads it
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_thread_idx ON public.messages (investor_id, created_at);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self_read"    ON public.messages;
DROP POLICY IF EXISTS "self_insert"  ON public.messages;
DROP POLICY IF EXISTS "self_mark"    ON public.messages;
DROP POLICY IF EXISTS "manager_all"  ON public.messages;
CREATE POLICY "self_read"   ON public.messages FOR SELECT USING (investor_id = auth.uid());
CREATE POLICY "self_insert" ON public.messages FOR INSERT
  WITH CHECK (investor_id = auth.uid() AND sender_role = 'investor');
-- investors may only flip read_at on manager messages in their own thread
CREATE POLICY "self_mark"   ON public.messages FOR UPDATE
  USING (investor_id = auth.uid() AND sender_role = 'manager');
CREATE POLICY "manager_all" ON public.messages FOR ALL USING (is_manager());

-- ============================================================
-- 12. withdrawal_requests — investor-initiated, manager-approved
-- ============================================================
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount       NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  note         TEXT,
  status       TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','denied','cancelled')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at  TIMESTAMPTZ
);
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "self_read"   ON public.withdrawal_requests;
DROP POLICY IF EXISTS "self_insert" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "manager_all" ON public.withdrawal_requests;
CREATE POLICY "self_read"   ON public.withdrawal_requests FOR SELECT USING (investor_id = auth.uid());
CREATE POLICY "self_insert" ON public.withdrawal_requests FOR INSERT
  WITH CHECK (investor_id = auth.uid() AND status = 'pending');
CREATE POLICY "manager_all" ON public.withdrawal_requests FOR ALL USING (is_manager());

-- ============================================================
-- 13. record_capital_event — ATOMIC deposit/withdrawal with unit math
--     Looks up NAV on the date, computes units, writes the event and
--     updates the investor's balance in one transaction. Manager only.
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_capital_event(
  p_investor UUID,
  p_type     TEXT,
  p_amount   NUMERIC,
  p_date     DATE DEFAULT CURRENT_DATE,
  p_note     TEXT DEFAULT NULL
) RETURNS public.capital_events SECURITY DEFINER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_nav   NUMERIC;
  v_units NUMERIC;
  v_have  NUMERIC;
  v_row   public.capital_events;
BEGIN
  IF NOT public.is_manager() THEN RAISE EXCEPTION 'manager only'; END IF;
  IF p_type NOT IN ('deposit','withdrawal') THEN RAISE EXCEPTION 'type must be deposit or withdrawal'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;

  SELECT nav_per_unit INTO v_nav FROM public.nav_history
   WHERE date <= p_date ORDER BY date DESC LIMIT 1;
  IF v_nav IS NULL THEN RAISE EXCEPTION 'no NAV recorded on or before %', p_date; END IF;

  v_units := round(p_amount / v_nav, 6);

  IF p_type = 'withdrawal' THEN
    SELECT units INTO v_have FROM public.investor_accounts
     WHERE investor_id = p_investor FOR UPDATE;
    IF COALESCE(v_have, 0) < v_units THEN
      RAISE EXCEPTION 'withdrawal of % units exceeds balance of % units', v_units, COALESCE(v_have, 0);
    END IF;
  END IF;

  INSERT INTO public.capital_events (investor_id, type, amount, units, nav_at_txn, date, note)
  VALUES (p_investor, p_type, p_amount, v_units, v_nav, p_date, p_note)
  RETURNING * INTO v_row;

  INSERT INTO public.investor_accounts (investor_id, units, since, status)
  VALUES (p_investor, v_units, p_date, 'active')
  ON CONFLICT (investor_id) DO UPDATE SET
    units      = investor_accounts.units + CASE WHEN p_type = 'deposit' THEN v_units ELSE -v_units END,
    status     = CASE WHEN investor_accounts.status = 'pending' AND p_type = 'deposit'
                      THEN 'active' ELSE investor_accounts.status END,
    updated_at = now();

  RETURN v_row;
END; $$;
GRANT EXECUTE ON FUNCTION public.record_capital_event(UUID, TEXT, NUMERIC, DATE, TEXT) TO authenticated;

-- ============================================================
-- 14. resolve_withdrawal — approve (executes the redemption
--     atomically at today's NAV) or deny. Manager only.
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_withdrawal(p_request UUID, p_approve BOOLEAN)
RETURNS public.withdrawal_requests SECURITY DEFINER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_req public.withdrawal_requests;
BEGIN
  IF NOT public.is_manager() THEN RAISE EXCEPTION 'manager only'; END IF;

  SELECT * INTO v_req FROM public.withdrawal_requests
   WHERE id = p_request FOR UPDATE;
  IF v_req IS NULL THEN RAISE EXCEPTION 'request not found'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'request already %', v_req.status; END IF;

  IF p_approve THEN
    PERFORM public.record_capital_event(v_req.investor_id, 'withdrawal', v_req.amount,
                                        CURRENT_DATE, 'Approved withdrawal request');
    UPDATE public.withdrawal_requests
       SET status = 'approved', resolved_at = now() WHERE id = p_request
       RETURNING * INTO v_req;
  ELSE
    UPDATE public.withdrawal_requests
       SET status = 'denied', resolved_at = now() WHERE id = p_request
       RETURNING * INTO v_req;
  END IF;

  RETURN v_req;
END; $$;
GRANT EXECUTE ON FUNCTION public.resolve_withdrawal(UUID, BOOLEAN) TO authenticated;

-- ============================================================
-- 15. Realtime — live updates for trades, messages, NAV and
--     withdrawal queue (idempotent; ignores already-added tables)
-- ============================================================
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.trades;              EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.nav_history;         EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_requests; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
