-- ============================================================
-- Contract size on positions
--
-- "Deployed (positions)" on the Cash Flow tab was computed as
-- qty x avg_cost, with no contract size. For an option that is 100
-- times too small, and a short leg subtracted from it, so a book of
-- SPY -2 @ 2.10 and QQQ 3 @ 1.60 reported $1 deployed instead of
-- $900 of gross position cost.
--
-- That number is not cosmetic: "Cash (est.)" and "Deployable" are
-- derived from it, so an empty-looking book made the whole fund look
-- like idle cash.
--
-- Safe on a live table: additive, defaulted, nothing rewritten.
-- Existing rows stay at 1, which is correct for shares and ETFs.
-- ============================================================

ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS multiplier NUMERIC(10,2) NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.positions.multiplier IS
  'Shares per contract: 100 for a standard option, 1 for shares or ETFs.';
