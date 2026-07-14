-- ============================================================
-- BPSQuant — seed data for testing
-- ============================================================
-- IMPORTANT: Run AFTER schema.sql.
-- Step 1: Create the manager user and investor users in the
--   Supabase Auth dashboard (Authentication → Users → Add user).
--   Note their UUIDs (shown in the dashboard).
-- Step 2: Replace the UUIDs below with the real ones.
-- Step 3: Run this script in Supabase SQL editor.
-- ============================================================

-- ---- Replace with your real user UUIDs ----
DO $$
DECLARE
  mgr_id    UUID := 'REPLACE-WITH-MANAGER-UUID';
  inv1_id   UUID := 'REPLACE-WITH-INVESTOR1-UUID';
  inv2_id   UUID := 'REPLACE-WITH-INVESTOR2-UUID';
  inv3_id   UUID := 'REPLACE-WITH-INVESTOR3-UUID';
BEGIN

-- Ensure manager profile has correct role
UPDATE public.profiles SET role = 'manager', name = 'Kevin (Fund Manager)' WHERE id = mgr_id;

-- Ensure investor profiles exist (trigger should have created them on sign-up)
-- but update names just in case
UPDATE public.profiles SET name = 'Sample Investor A' WHERE id = inv1_id;
UPDATE public.profiles SET name = 'Sample Investor B' WHERE id = inv2_id;
UPDATE public.profiles SET name = 'Sample Investor C' WHERE id = inv3_id;

-- Investor accounts (units held) — start NAV at 1000.00 per unit
INSERT INTO public.investor_accounts (investor_id, units, since, note)
VALUES
  (inv1_id, 25.0000,  '2025-09-01', 'Founding investor'),
  (inv2_id, 50.0000,  '2025-09-01', 'Founding investor'),
  (inv3_id, 12.0000,  '2025-11-15', 'Later entry')
ON CONFLICT (investor_id) DO UPDATE SET units = EXCLUDED.units, since = EXCLUDED.since;

-- Capital events (deposits at founding NAV = 1000)
INSERT INTO public.capital_events (investor_id, type, amount, units, nav_at_txn, date, note)
VALUES
  (inv1_id, 'deposit', 25000.00, 25.000000, 1000.0000, '2025-09-01', 'Initial investment'),
  (inv2_id, 'deposit', 50000.00, 50.000000, 1000.0000, '2025-09-01', 'Initial investment'),
  (inv3_id, 'deposit', 12500.00, 12.000000, 1041.6667, '2025-11-15', 'Initial investment')
ON CONFLICT DO NOTHING;

-- NAV history (monthly since fund start, growing modestly)
INSERT INTO public.nav_history (date, nav_per_unit, aum, note)
VALUES
  ('2025-09-01', 1000.00,   75000.00, 'Fund launch'),
  ('2025-09-30', 1027.80,   77085.00, 'End Sep'),
  ('2025-10-31', 1051.40,   78855.00, 'End Oct'),
  ('2025-11-28', 1041.67,  106531.00, 'End Nov — inv3 joined'),
  ('2025-12-31', 1078.30,  110334.00, 'End Dec'),
  ('2026-01-30', 1099.60,  112534.00, 'End Jan'),
  ('2026-02-28', 1088.20,  111368.00, 'End Feb — slight pullback'),
  ('2026-03-31', 1122.50,  114888.00, 'End Mar'),
  ('2026-04-30', 1154.80,  118189.00, 'End Apr'),
  ('2026-05-30', 1183.60,  121138.00, 'End May'),
  ('2026-06-13', 1212.40,  124091.00, 'Latest')
ON CONFLICT (date) DO UPDATE SET nav_per_unit = EXCLUDED.nav_per_unit, aum = EXCLUDED.aum;

-- Recent trades
INSERT INTO public.trades (executed_at, symbol, side, qty, price, strategy, status, note)
VALUES
  (now() - interval '4 hours',  'SPY', 'BUY',  200, 545.20, 'Trend',     'filled', NULL),
  (now() - interval '3 hours',  'QQQ', 'BUY',  150, 471.40, 'Momentum',  'filled', NULL),
  (now() - interval '2 hours',  'SPY', 'SELL', 100, 547.80, 'Mean-Rev',  'filled', NULL),
  (now() - interval '90 mins',  'DIA', 'BUY',   80, 402.10, 'Trend',     'filled', NULL),
  (now() - interval '60 mins',  'QQQ', 'SELL',  75, 469.90, 'Mean-Rev',  'filled', NULL),
  (now() - interval '30 mins',  'SPY', 'BUY',  300, 546.50, 'Momentum',  'filled', NULL),
  (now() - interval '15 mins',  'DIA', 'BUY',  120, 403.20, 'Trend',     'filled', NULL),
  (now() - interval '5 mins',   'QQQ', 'BUY',  200, 472.00, 'Momentum',  'pending', 'Being worked')
ON CONFLICT DO NOTHING;

-- Current positions
INSERT INTO public.positions (symbol, qty, avg_cost)
VALUES
  ('SPY', 400, 545.80),
  ('QQQ', 275, 470.90),
  ('DIA', 200, 402.60)
ON CONFLICT (symbol) DO UPDATE SET qty = EXCLUDED.qty, avg_cost = EXCLUDED.avg_cost, updated_at = now();

END $$;
