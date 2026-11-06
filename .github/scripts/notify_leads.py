#!/usr/bin/env python3
"""
Email new contact-form enquiries from BPSQuant's own Gmail mailbox.

Why this exists
---------------
The website saves every enquiry to Supabase, and the portal's Inbox tab shows
it immediately. Getting an *email* needs something that can send one, and
every option costs either a new vendor (Resend) or a free relay with no uptime
guarantee (FormSubmit, which went down and took the alerts with it).

This path uses only what BPSQuant already owns: the Google Workspace mailbox
and the GitHub Actions minutes already running the keep-alive workflow. No new
account, no DNS, no third party ever sees an enquiry.

Only the Python standard library is used — nothing to install, and nothing
from PyPI running against the fund's data.

State
-----
The high-water mark lives in the existing `app_settings` table under the key
`last_lead_notified_at`. Using the database rather than an Actions cache or a
committed file means a cache eviction cannot resend old enquiries, and nothing
has to be committed back to the repo (which would trigger a Pages rebuild on
every run).

On the very first run there is no mark, so it starts from `FIRST_RUN_LOOKBACK`
ago rather than emailing the entire history.

Environment
-----------
  SUPABASE_URL          https://<ref>.supabase.co
  SUPABASE_SERVICE_KEY  service_role key (bypasses RLS — repo secret only)
  GMAIL_USER            info@bpsquant.com
  GMAIL_APP_PASSWORD    Google app password, not the account password
  ALERT_TO              optional; defaults to GMAIL_USER
"""

import json
import os
import smtplib
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from email.utils import formataddr, parseaddr

SETTING_KEY = "last_lead_notified_at"
FIRST_RUN_LOOKBACK = timedelta(hours=24)
MAX_PER_RUN = 25          # a burst or a spam run must not hit Gmail's limits
TIMEOUT = 30


def env(name, default=None, required=False):
    v = (os.environ.get(name) or "").strip()
    if not v and required:
        sys.exit(f"error: {name} is not set. Add it under Settings -> Secrets -> Actions.")
    return v or default


def api(url, key, method="GET", body=None, extra_headers=None):
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    headers.update(extra_headers or {})
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        raw = r.read().decode() or "[]"
    return json.loads(raw) if raw.strip() else []


def read_watermark(base, key):
    url = f"{base}/rest/v1/app_settings?key=eq.{SETTING_KEY}&select=value"
    try:
        rows = api(url, key)
        if rows and rows[0].get("value"):
            return str(rows[0]["value"])
    except urllib.error.HTTPError as e:
        # A missing app_settings table is not fatal — fall back to the lookback
        # window so alerts still work before the table exists.
        print(f"note: could not read {SETTING_KEY} ({e.code}); using lookback window")
    except Exception as e:
        print(f"note: could not read {SETTING_KEY} ({e}); using lookback window")
    return (datetime.now(timezone.utc) - FIRST_RUN_LOOKBACK).isoformat()


def write_watermark(base, key, value):
    url = f"{base}/rest/v1/app_settings?on_conflict=key"
    try:
        api(url, key, "POST", [{"key": SETTING_KEY, "value": value}],
            {"Prefer": "resolution=merge-duplicates,return=minimal"})
        return True
    except Exception as e:
        print(f"warning: could not save the high-water mark ({e}). "
              f"The next run may resend these enquiries.")
        return False


def fetch_leads(base, key, since):
    q = urllib.parse.urlencode({
        "select": "id,name,email,message,created_at",
        "created_at": f"gt.{since}",
        "order": "created_at.asc",
        "limit": str(MAX_PER_RUN),
    })
    return api(f"{base}/rest/v1/contact_leads?{q}", key)


def build_message(lead, sender, recipients):
    name = (lead.get("name") or "(no name)").strip()
    addr = (lead.get("email") or "").strip()
    body = (lead.get("message") or "(no message)").strip()
    when = lead.get("created_at") or ""

    msg = EmailMessage()
    msg["Subject"] = f"New enquiry from {name}"
    msg["From"] = formataddr(("BPSQuant website", sender))
    msg["To"] = ", ".join(recipients)
    # Replying goes straight to the enquirer, but only when the address is
    # really an address — a malformed header would bounce the whole send.
    if "@" in parseaddr(addr)[1]:
        msg["Reply-To"] = addr
    msg.set_content(
        f"New enquiry from the BPSQuant website.\n\n"
        f"Name:     {name}\n"
        f"Email:    {addr or '(none)'}\n"
        f"Received: {when}\n\n"
        f"Message:\n{body}\n\n"
        f"--\nReply to this email to answer {name} directly.\n"
        f"All enquiries are also in the portal Inbox: https://www.bpsquant.com/portal.html\n"
    )
    return msg


def main():
    base = env("SUPABASE_URL", required=True).rstrip("/")
    service_key = env("SUPABASE_SERVICE_KEY", required=True)
    gmail_user = env("GMAIL_USER", required=True)
    gmail_pass = env("GMAIL_APP_PASSWORD", required=True)
    recipients = [a.strip() for a in env("ALERT_TO", gmail_user).split(",") if a.strip()]

    since = read_watermark(base, service_key)
    print(f"looking for enquiries newer than {since}")

    leads = fetch_leads(base, service_key, since)
    if not leads:
        print("no new enquiries")
        return

    print(f"{len(leads)} new enquir{'y' if len(leads) == 1 else 'ies'}")

    sent, newest = 0, since
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=TIMEOUT) as smtp:
        smtp.login(gmail_user, gmail_pass)
        for lead in leads:
            try:
                smtp.send_message(build_message(lead, gmail_user, recipients))
                sent += 1
                newest = lead.get("created_at") or newest
                print(f"  sent: {lead.get('name')} <{lead.get('email')}>")
            except Exception as e:
                # Stop at the first failure and keep the mark at the last
                # success, so the rest are retried rather than lost.
                print(f"  FAILED on {lead.get('id')}: {e}")
                break

    if sent:
        write_watermark(base, service_key, newest)
    print(f"done — {sent} of {len(leads)} emailed")

    # A partial send is a real failure: surface it in the Actions run.
    if sent < len(leads):
        sys.exit(1)


if __name__ == "__main__":
    main()
