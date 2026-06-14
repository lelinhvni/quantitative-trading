-- ============================================================
-- JSS Capital — Supabase database schema
-- Run this in: Supabase dashboard → SQL editor → New query → Run
-- ============================================================

-- ============================================================
-- 1. Helper: check if current user is a fund manager
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

-- ============================================================
-- 2. profiles — one row per auth user (auto-created by trigger)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT '',
  role       TEXT NOT NULL DEFAULT 'investor' CHECK (role IN ('manager', 'investor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

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
