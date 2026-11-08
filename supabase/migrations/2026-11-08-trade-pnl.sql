-- ============================================================
-- Profit and loss on trades
--
-- The trades table recorded what was bought and sold but never what it
-- made, so "Total P&L" on the admin dashboard could only ever be derived
-- from NAV — it told you the fund's value had moved, not which trades
-- moved it.
--
-- Safe to run on a live database: every column is added with a default,
-- nothing existing is rewritten, and old rows simply have pnl NULL,
-- meaning "not recorded" rather than "zero".
-- ============================================================

ALTER TABLE public.trades
  -- Realised profit or loss. NULL means not recorded, which is different
  -- from 0.00 meaning it genuinely broke even.
  ADD COLUMN IF NOT EXISTS pnl         NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS fees        NUMERIC(18,2) NOT NULL DEFAULT 0,
  -- 100 for an option contract, 1 for shares. Stored per trade because a
  -- fund that trades both cannot have one right answer.
  ADD COLUMN IF NOT EXISTS multiplier  NUMERIC(10,2) NOT NULL DEFAULT 1,
  -- Ties the legs of one spread together, so a four-leg iron condor is
  -- one result rather than four unexplained rows.
  ADD COLUMN IF NOT EXISTS group_label TEXT,
  -- Where the row came from, so a bad import can be found and undone.
  ADD COLUMN IF NOT EXISTS source      TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS import_id   UUID;

CREATE INDEX IF NOT EXISTS trades_group_idx     ON public.trades (group_label);
CREATE INDEX IF NOT EXISTS trades_import_idx    ON public.trades (import_id);
CREATE INDEX IF NOT EXISTS trades_executed_idx  ON public.trades (executed_at DESC);

-- Realised P&L by month, for the admin dashboard. A view rather than a
-- stored total, so it can never disagree with the rows underneath it.
CREATE OR REPLACE VIEW public.trade_pnl_monthly AS
  SELECT date_trunc('month', executed_at)::date AS month,
         count(*)                                AS trades,
         count(*) FILTER (WHERE pnl > 0)         AS wins,
         count(*) FILTER (WHERE pnl < 0)         AS losses,
         COALESCE(sum(pnl), 0)                   AS net_pnl,
         COALESCE(sum(fees), 0)                  AS fees
    FROM public.trades
   WHERE pnl IS NOT NULL
   GROUP BY 1
   ORDER BY 1 DESC;

-- The view reads trades, which is already manager-only under RLS, so it
-- inherits that. Set it explicitly rather than relying on the default.
ALTER VIEW public.trade_pnl_monthly SET (security_invoker = true);
