// ============================================================
// BPSQuant — new contact lead → email alert
//
// Fired by the on_contact_lead_created trigger whenever someone
// submits the homepage contact form. Sends a plain, readable
// email to the fund's inbox via Resend.
//
// Deploy (Supabase dashboard, ~5 minutes):
//   1. Sign up at resend.com (free: 3,000 emails/month), verify
//      your sending domain (or use their onboarding sender for
//      testing), and copy an API key.
//   2. Edge Functions → Deploy a new function → name: notify-lead
//      → paste this file → Deploy.
//   3. Edge Functions → notify-lead → Secrets, add:
//        RESEND_API_KEY = re_xxxxxxxx
//        ALERT_TO       = kevin86le@gmail.com        (comma-separate for several)
//        ALERT_FROM     = BPSQuant <alerts@bpsquant.com>
//      ALERT_FROM must be on a domain verified in Resend.
//   4. Run the two vault.create_secret() statements documented in
//      supabase/schema.sql so the trigger knows where to call.
//
// The function is called server-to-server with the service key, so
// leave "Enforce JWT verification" ON.
// ============================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("ALERT_FROM") || "BPSQuant <onboarding@resend.dev>";

  // Recipient: the ALERT_TO secret wins; otherwise read app_settings.alert_to,
  // which the manager sets from the ops console. Keeping it in the database
  // means no personal address is ever committed to the public repo.
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
    } catch { /* fall through to "not configured" */ }
  }
  const to = toRaw.split(",").map((s) => s.trim()).filter(Boolean);

  if (!key || !to.length) {
    // Not configured yet — succeed quietly so the lead is never lost.
    return new Response(JSON.stringify({ skipped: "alerts not configured" }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let lead: Record<string, unknown> = {};
  try { lead = await req.json(); } catch { /* empty body */ }

  const name = esc(lead.name) || "(no name)";
  const email = esc(lead.email) || "(no email)";
  const message = esc(lead.message) || "(no message)";
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
        reply_to: String(lead.email || "") || undefined,
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
