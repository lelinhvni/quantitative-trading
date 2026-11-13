-- ============================================================
-- app_settings — small key/value store
--
-- It is defined at the bottom of schema.sql, but the live database was
-- created before that section was added, so the table is missing. This
-- migration adds just that table rather than re-running the whole
-- schema against a database that now holds real data.
--
-- Two things need it:
--
--   last_lead_notified_at — the Gmail notifier's high-water mark. Without
--     it the notifier cannot remember which enquiries it has already
--     emailed, so every run would resend the same ones, every few hours,
--     indefinitely. It currently falls back to a 24-hour window and
--     warns, which is why nothing has been duplicated so far.
--
--   alert_to — the override on the ops console's "Enquiry alerts" panel.
--     That panel has been failing to load its value for the same reason.
--
-- Manager-only. Nothing here is read by the public site.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- The service_role key used by the notifier bypasses RLS, so it needs no
-- policy of its own. These are for the ops console, signed in as manager.
DROP POLICY IF EXISTS "manager_read" ON public.app_settings;
CREATE POLICY "manager_read" ON public.app_settings
  FOR SELECT USING (is_manager());

DROP POLICY IF EXISTS "manager_write" ON public.app_settings;
CREATE POLICY "manager_write" ON public.app_settings
  FOR ALL USING (is_manager()) WITH CHECK (is_manager());
