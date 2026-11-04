// ============================================================
// BPSQuant — new contact lead → email alert
//
// Called by the website straight after a contact-form enquiry is
// saved (scripts/db.js → submitLead). Emails it to the fund's
// inbox via Resend.
//
// Deploy (Supabase dashboard, ~5 minutes) — two steps:
//   1. Sign up at resend.com (free: 3,000 emails/month), verify
//      bpsquant.com as a sending domain, and copy an API key.
//   2. Edge Functions → Deploy a new function → name: notify-lead
//      → paste this file → Deploy. Then under its Secrets add:
//        RESEND_API_KEY = re_xxxxxxxx
//        ALERT_FROM     = BPSQuant <alerts@bpsquant.com>
//        ALERT_TO       = optional — only to send somewhere other than
//                         the default inbox below (comma-separate for several)
//      ALERT_FROM must be on a domain verified in Resend.
//
// Leave "Enforce JWT verification" ON: the website calls this with the
// anon key, which satisfies it.
//
// The pg_net trigger in schema.sql is NOT needed any more and must stay
// off, or every enquiry is emailed twice. See section 17 there.
// ============================================================

// The fund's Google Workspace inbox. Contact-form enquiries land here unless
// something overrides it — a business address, so it belongs in the repo.
const DEFAULT_ALERT_TO = "info@bpsquant.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

// Escape for HTML, and cap the length. The website calls this with the anon
// key, so treat every field as untrusted and keep one enquiry from becoming a
// megabyte of email.
function esc(s: unknown, max = 2000): string {
  const t = String(s ?? "").slice(0, max);
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("ALERT_FROM") || "BPSQuant <onboarding@resend.dev>";

  // Recipient, in order of priority:
  //   1. the ALERT_TO secret, if set;
  //   2. app_settings.alert_to, which the manager sets from the ops console —
  //      use this to add a personal address without committing it here;
  //   3. info@bpsquant.com, the fund's own inbox.
  // So alerts always have somewhere to land, even before anything is configured.
  let toRaw = Deno.env.get("ALERT_TO") || "";
  if (!toRaw) {
    try {
      const url = Deno.env.get("SUPABASE_URL");
      const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (url && svc) {
        const r = await fetch(
          `${url}/rest/v1/app_settings?key=eq.alert_to&select=value`,
          { headers: { apikey: svc, Authorization: `Bearer ${svc}` } },
        );
        const rows = await r.json();
        if (Array.isArray(rows) && rows[0]?.value) toRaw = String(rows[0].value);
      }
    } catch { /* fall through to the default inbox */ }
  }
  if (!toRaw) toRaw = DEFAULT_ALERT_TO;
  const to = toRaw.split(",").map((s) => s.trim()).filter(Boolean);

  if (!key || !to.length) {
    // No Resend key yet — succeed quietly so the lead is never lost. It is
    // still stored in contact_leads and visible in the portal inbox.
    return new Response(JSON.stringify({ skipped: "alerts not configured" }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let lead: Record<string, unknown> = {};
  try { lead = await req.json(); } catch { /* empty body */ }

  // An enquiry with neither a name nor an email is not one. Refusing it keeps
  // an empty POST from turning into mail.
  if (!String(lead.name ?? "").trim() && !String(lead.email ?? "").trim()) {
    return new Response(JSON.stringify({ skipped: "empty enquiry" }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const name = esc(lead.name, 200) || "(no name)";
  const email = esc(lead.email, 200) || "(no email)";
  const message = esc(lead.message, 5000) || "(no message)";
  const at = lead.at ? new Date(String(lead.at)).toUTCString() : new Date().toUTCString();

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px">
      <h2 style="margin:0 0 4px">New enquiry — BPSQuant</h2>
      <p style="color:#667;margin:0 0 20px;font-size:13px">${at}</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <tr><td style="padding:8px 0;color:#667;width:90px">Name</td><td style="padding:8px 0"><b>${name}</b></td></tr>
        <tr><td style="padding:8px 0;color:#667">Email</td><td style="padding:8px 0"><a href="mailto:${email}">${email}</a></td></tr>
        <tr><td style="padding:8px 0;color:#667;vertical-align:top">Message</td><td style="padding:8px 0;white-space:pre-wrap">${message}</td></tr>
      </table>
      <p style="margin-top:24px">
        <a href="https://www.bpsquant.com/portal.html"
           style="background:#5eead4;color:#0b1020;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">
          Open the inbox
        </a>
      </p>
      <p style="color:#889;font-size:12px;margin-top:20px">
        Reply straight to this email to answer ${name} directly.
      </p>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        subject: `New enquiry from ${name}`,
        html,
        // Only set reply_to when it really is an address — Resend rejects the
        // whole send on a malformed one, which would lose the alert.
        reply_to: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(lead.email || "").trim())
          ? String(lead.email).trim()
          : undefined,
      }),
    });
    const body = await res.text();
    return new Response(body, {
      status: res.status, headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 502, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
