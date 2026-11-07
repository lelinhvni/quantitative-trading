-- ============================================================
-- Monthly income distributions
--
-- Run this in the Supabase SQL editor when you start paying monthly
-- income. Until you do, the portal's Income section simply says there
-- are no distributions yet — nothing breaks.
--
-- One row per investor per month, recording the whole Clause 6
-- waterfall so the portal can show an investor exactly how their
-- payment was worked out:
--
--   target_amount   = opening_value x target_rate      (1.70%/month)
--   profit_amount   = the investor's share of net trading profit
--   reserve_delta   = + surplus retained, - drawn to top the payment up
--   paid_amount     = what actually went to the investor
--   shortfall_delta = + recorded when the reserve ran out, - when repaid
--   company_excess  = profit above the Target once the Reserve is at its cap,
--                     which Clause 6.4(a) allocates to the Company. Recorded
--                     per investor so the portal can show it rather than
--                     leaving the investor to wonder where it went.
--
-- Running balances are plain sums, so nothing can drift out of step
-- with the rows that produced them:
--   reserve balance   = sum(reserve_delta)
--   shortfall balance = sum(shortfall_delta)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.distributions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period          DATE NOT NULL,                       -- first day of the month covered
  opening_value   NUMERIC(18,2) NOT NULL DEFAULT 0,    -- value the target is computed on
  target_rate     NUMERIC(6,4)  NOT NULL DEFAULT 0.0170,
  target_amount   NUMERIC(18,2) NOT NULL DEFAULT 0,
  profit_amount   NUMERIC(18,2) NOT NULL DEFAULT 0,    -- may be negative in a losing month
  reserve_delta   NUMERIC(18,2) NOT NULL DEFAULT 0,    -- + retained, - drawn
  paid_amount     NUMERIC(18,2) NOT NULL DEFAULT 0,
  shortfall_delta NUMERIC(18,2) NOT NULL DEFAULT 0,    -- + recorded, - repaid
  company_excess  NUMERIC(18,2) NOT NULL DEFAULT 0,    -- profit above Target once the
                                                       -- Reserve is full: Clause 6.4(a),
                                                       -- allocated to the Company
  mode            TEXT NOT NULL DEFAULT 'cash' CHECK (mode IN ('cash','reinvest')),
  units_issued    NUMERIC(18,6) NOT NULL DEFAULT 0,    -- when reinvested
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (investor_id, period)
);

CREATE INDEX IF NOT EXISTS distributions_investor_period_idx
  ON public.distributions (investor_id, period DESC);

ALTER TABLE public.distributions ENABLE ROW LEVEL SECURITY;

-- An investor reads only their own distributions; the manager reads and
-- writes everything. Nobody but the manager can create or change a row.
DROP POLICY IF EXISTS "own_or_manager_read" ON public.distributions;
CREATE POLICY "own_or_manager_read" ON public.distributions
  FOR SELECT USING (investor_id = auth.uid() OR is_manager());

DROP POLICY IF EXISTS "manager_write" ON public.distributions;
CREATE POLICY "manager_write" ON public.distributions
  FOR ALL USING (is_manager()) WITH CHECK (is_manager());

-- Let the portal update an investor's figures live when one is recorded.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.distributions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The investor's standing election: take the income as cash, or turn it
-- back into units. Clause 6.7 — changeable on 30 days' notice.
ALTER TABLE public.investor_accounts
  ADD COLUMN IF NOT EXISTS income_mode TEXT NOT NULL DEFAULT 'cash'
  CHECK (income_mode IN ('cash','reinvest'));
