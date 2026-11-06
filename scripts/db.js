/* ============================================================
   BPSQuant — Supabase data layer
   window.JSSDB is safe to use from any page that loads db.js.
   If Supabase isn't configured, isReady() returns false and
   every page falls back to demo data automatically.
   ============================================================ */
(function (global) {
  "use strict";

  /* ----- FormSubmit relay -----------------------------------------------
     Posts the enquiry to FormSubmit, which emails it on. No account, no API
     key and no DNS; the address (or its alias) lives in config.formsubmit.
     Returns true only when FormSubmit confirms it accepted the message. */
  async function sendViaFormSubmit({ name, email, message, at }) {
    const target = (global.JSS_CONFIG || {}).formsubmit;
    if (!target) return false;
    // Hard timeout: FormSubmit is a free third party and has been seen to go
    // down (Cloudflare 522), where a plain fetch can hang for half a minute.
    // The visitor must never wait on it.
    const ctl = new AbortController();
    const killer = setTimeout(() => ctl.abort(), 8000);
    try {
      const res = await fetch("https://formsubmit.co/ajax/" + encodeURIComponent(target), {
        method: "POST",
        signal: ctl.signal,
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          _subject: "New enquiry from " + (name || "the website"),
          _template: "table",
          _captcha: "false",
          Name: name || "(no name)",
          Email: email || "(no email)",
          Message: message || "(no message)",
          Received: at,
          Source: "www.bpsquant.com contact form",
        }),
      });
      const body = await res.json().catch(() => ({}));
      // FormSubmit answers {"success":"true"} — as a string on some routes.
      const ok = res.ok && String(body.success) === "true";
      if (!ok) {
        console.warn("[BPSQuant] FormSubmit did not accept the enquiry:",
                     res.status, body.message || "");
      }
      return ok;
    } catch (e) {
      console.warn("[BPSQuant] FormSubmit unreachable:", e.message);
      return false;
    } finally {
      clearTimeout(killer);
    }
  }

  const DB = {
    _client: null,
    _profile: null,

    /* ----- initialise once per page load ----- */
    init() {
      const cfg = (global.JSS_CONFIG || {}).supabase;
      if (!cfg || !cfg.url || cfg.url.startsWith("YOUR_") || !global.supabase) return false;
      this._client = global.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: true, storageKey: "jss_auth" },
        realtime: { enabled: true },
      });
      return true;
    },

    isReady() { return !!this._client; },

    /* ============================================================
       AUTH
       ============================================================ */
    async signIn(email, password) {
      const { data, error } = await this._client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },

    async signOut() {
      const { error } = await this._client.auth.signOut();
      if (error) throw error;
      this._profile = null;
    },

    async resetPassword(email) {
      const redirectTo = global.location.origin + global.location.pathname;
      const { error } = await this._client.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
    },

    async getSession() {
      const { data: { session } } = await this._client.auth.getSession();
      return session;
    },

    onAuthChange(cb) {
      return this._client.auth.onAuthStateChange(cb);
    },

    async getProfile(refresh = false) {
      if (this._profile && !refresh) return this._profile;
      const { data, error } = await this._client
        .from("profiles").select("*").eq("id", (await this.getSession())?.user?.id).single();
      if (error) throw error;
      this._profile = data;
      return data;
    },

    async updateMyName(name) {
      const session = await this.getSession();
      const { error } = await this._client.from("profiles").update({ name }).eq("id", session.user.id);
      if (error) throw error;
      this._profile = null;
    },

    /* ============================================================
       NAV HISTORY
       ============================================================ */
    async getNavHistory(days = 90) {
      const since = new Date(); since.setDate(since.getDate() - days);
      const { data, error } = await this._client
        .from("nav_history").select("date, nav_per_unit, aum, note")
        .gte("date", since.toISOString().slice(0, 10))
        .order("date", { ascending: true });
      if (error) throw error;
      return data || [];
    },

    async getAllNavHistory() {
      const { data, error } = await this._client
        .from("nav_history").select("date, nav_per_unit, aum, note")
        .order("date", { ascending: true });
      if (error) throw error;
      return data || [];
    },

    async getLatestNav() {
      const { data, error } = await this._client
        .from("nav_history").select("*").order("date", { ascending: false }).limit(1).single();
      if (error) return null;
      return data;
    },

    async upsertNav({ date, navPerUnit, aum, note }) {
      const { data, error } = await this._client
        .from("nav_history")
        .upsert({ date, nav_per_unit: navPerUnit, aum: aum || null, note: note || null }, { onConflict: "date" })
        .select().single();
      if (error) throw error;
      return data;
    },

    /* ============================================================
       TRADES
       ============================================================ */
    async getTrades(limit = 100) {
      const { data, error } = await this._client
        .from("trades").select("*").order("executed_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return data || [];
    },

    subscribeToTrades(onInsert) {
      return this._client
        .channel("trades-realtime")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "trades" }, (p) => onInsert(p.new))
        .subscribe();
    },

    unsubscribe(channel) {
      if (channel) this._client.removeChannel(channel);
    },

    async addTrade({ symbol, side, qty, price, strategy, status, note, executedAt }) {
      const { data, error } = await this._client
        .from("trades")
        .insert({ symbol, side, qty, price, strategy, status: status || "filled", note: note || null,
                  executed_at: executedAt || new Date().toISOString() })
        .select().single();
      if (error) throw error;
      return data;
    },

    async bulkAddTrades(trades) {
      const rows = trades.map((t) => ({
        symbol: t.symbol, side: t.side, qty: t.qty, price: t.price,
        strategy: t.strategy || null, status: t.status || "filled",
        note: t.note || null, executed_at: t.executedAt || new Date().toISOString(),
      }));
      const { data, error } = await this._client.from("trades").insert(rows).select();
      if (error) throw error;
      return data || [];
    },

    /* ============================================================
       POSITIONS
       ============================================================ */
    async getPositions() {
      const { data, error } = await this._client
        .from("positions").select("*").order("symbol");
      if (error) throw error;
      return data || [];
    },

    async upsertPosition({ symbol, qty, avgCost }) {
      const { data, error } = await this._client
        .from("positions")
        .upsert({ symbol, qty, avg_cost: avgCost, updated_at: new Date().toISOString() }, { onConflict: "symbol" })
        .select().single();
      if (error) throw error;
      return data;
    },

    /* ============================================================
       INVESTOR ACCOUNTS (investor's own view)
       ============================================================ */
    async getMyAccount() {
      const session = await this.getSession();
      if (!session) return null;
      const { data } = await this._client
        .from("investor_accounts").select("*").eq("investor_id", session.user.id).maybeSingle();
      return data;
    },

    async getMyCapitalEvents() {
      const session = await this.getSession();
      if (!session) return [];
      const { data, error } = await this._client
        .from("capital_events").select("*")
        .eq("investor_id", session.user.id)
        .order("date", { ascending: false })
        .limit(36);
      if (error) throw error;
      return data || [];
    },

    /* ============================================================
       MANAGER — investor management
       ============================================================ */
    async getAllInvestors() {
      const { data, error } = await this._client
        .from("investor_accounts")
        .select("*, profiles(id, name, created_at)")
        .order("units", { ascending: false });
      if (error) throw error;
      return data || [];
    },

    /* All investor profiles, including ones with no account row yet
       (needed to record a brand-new investor's first deposit) */
    async getInvestorProfiles() {
      const { data, error } = await this._client
        .from("profiles").select("id, name")
        .eq("role", "investor").order("name");
      if (error) throw error;
      return data || [];
    },

    async upsertInvestorAccount({ investorId, units, since, note }) {
      const { data, error } = await this._client
        .from("investor_accounts")
        .upsert({ investor_id: investorId, units, since, note: note || null, updated_at: new Date().toISOString() },
                 { onConflict: "investor_id" })
        .select().single();
      if (error) throw error;
      return data;
    },

    /* Manager: full capital ledger across all investors */
    async getAllCapitalEvents(limit = 500) {
      const { data, error } = await this._client
        .from("capital_events")
        .select("*, profiles(id, name)")
        .order("date", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },

    /* Manager: one investor's capital history */
    async getInvestorCapitalEvents(investorId) {
      const { data, error } = await this._client
        .from("capital_events").select("*")
        .eq("investor_id", investorId)
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async addCapitalEvent({ investorId, type, amount, units, navAtTxn, date, note }) {
      const { data, error } = await this._client
        .from("capital_events")
        .insert({ investor_id: investorId, type, amount, units: units || null, nav_at_txn: navAtTxn || null,
                  date: date || new Date().toISOString().slice(0, 10), note: note || null })
        .select().single();
      if (error) throw error;
      return data;
    },

    /* ============================================================
       APP SETTINGS — private key/value, manager-only via RLS.
       Used for values that must not sit in the public repo, such
       as the new-enquiry alert address.
       ============================================================ */
    async getSetting(key) {
      const { data, error } = await this._client
        .from("app_settings").select("value").eq("key", key).maybeSingle();
      if (error) throw error;
      return data ? data.value : null;
    },

    async setSetting(key, value) {
      const { error } = await this._client
        .from("app_settings")
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) throw error;
    },

    /* ============================================================
       ADMIN EDIT TOOLS — direct writes, manager-only via RLS.
       These bypass the atomic bookkeeping; the profile page's
       ledger-reconciliation check catches any resulting drift.
       ============================================================ */
    async updateProfileName(userId, name) {
      const { error } = await this._client
        .from("profiles").update({ name }).eq("id", userId);
      if (error) throw error;
    },

    async updateCapitalEvent(id, { date, type, amount, units, navAtTxn, note }) {
      const patch = {};
      if (date     != null) patch.date       = date;
      if (type     != null) patch.type       = type;
      if (amount   != null) patch.amount     = amount;
      if (units    != null) patch.units      = units;
      if (navAtTxn != null) patch.nav_at_txn = navAtTxn;
      if (note     !== undefined) patch.note = note;
      const { data, error } = await this._client
        .from("capital_events").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },

    async deleteCapitalEvent(id) {
      const { error } = await this._client
        .from("capital_events").delete().eq("id", id);
      if (error) throw error;
    },

    /* Repair tool: set stored units directly (e.g. to the ledger total) */
    async setInvestorUnits(investorId, units) {
      const { error } = await this._client
        .from("investor_accounts")
        .upsert({ investor_id: investorId, units, updated_at: new Date().toISOString() },
                { onConflict: "investor_id" });
      if (error) throw error;
    },

    async deleteTrade(id) {
      const { error } = await this._client
        .from("trades").delete().eq("id", id);
      if (error) throw error;
    },

    async deletePosition(symbol) {
      const { error } = await this._client
        .from("positions").delete().eq("symbol", symbol);
      if (error) throw error;
    },

    /* ============================================================
       CONTACT LEADS
       ============================================================ */
    /* Store the enquiry, then email it to the fund's inbox.
       The insert is what must not fail — it is the record of the lead, and
       the portal inbox reads from it. The email is sent straight after from
       the browser, so delivery does not depend on the pg_net trigger and its
       two vault secrets. A failure to email is logged, never thrown: the
       lead is already safe, and the visitor should not see an error. */
    async submitLead({ name, email, message }) {
      const { error } = await this._client
        .from("contact_leads").insert({ name, email, message: message || null });
      if (error) throw error;

      // The enquiry is now safely in the inbox, so the visitor is done. Send
      // the email alert in the background: an email relay being slow or down
      // must not leave someone staring at a spinner for something that has
      // already succeeded.
      this.emailLead({ name, email, message: message || "" })
        .then((sent) => {
          if (!sent) console.warn("[BPSQuant] Lead saved, but no email alert was sent.");
        })
        .catch(() => {});
    },

    /* Email the enquiry to the fund's inbox. Two routes, tried in order, so
       exactly one email goes out:
         1. the notify-lead Edge Function — only actually sends when a Resend
            key is configured, otherwise it answers {skipped};
         2. FormSubmit — no account, no key, needs one confirmation click.
       Returns true if a route reported sending. Never throws: the lead is
       already stored, and the visitor must not see an error for that. */
    async emailLead({ name, email, message }) {
      const payload = { name, email, message, at: new Date().toISOString() };

      if (this._client) {
        try {
          const { data, error } = await this._client.functions.invoke("notify-lead", { body: payload });
          // `skipped` means the function ran but had no Resend key — fall through.
          if (!error && data && !data.skipped) return true;
        } catch (e) {
          console.warn("[BPSQuant] notify-lead unavailable:", e.message);
        }
      }

      return await sendViaFormSubmit(payload);
    },

    async getLeads(limit = 100) {
      const { data, error } = await this._client
        .from("contact_leads").select("*")
        .order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return data || [];
    },

    /* Mailbox: mark read / archive / restore, and private notes */
    async setLeadStatus(id, status) {
      const patch = { status };
      if (status === "read" || status === "archived") patch.read_at = new Date().toISOString();
      const { error } = await this._client.from("contact_leads").update(patch).eq("id", id);
      if (error) throw error;
    },

    async setLeadNotes(id, notes) {
      const { error } = await this._client.from("contact_leads").update({ notes }).eq("id", id);
      if (error) throw error;
    },

    /* Realtime: a new enquiry lights up the inbox without a refresh */
    subscribeLeads(onInsert) {
      return this._client
        .channel("leads-realtime")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "contact_leads" }, (p) => onInsert(p.new))
        .subscribe();
    },

    /* ============================================================
       CAPITAL — atomic deposit/withdrawal with server-side unit math
       (manager only; NAV lookup + event + balance update in one txn)
       ============================================================ */
    async recordCapitalEvent({ investorId, type, amount, date, note }) {
      const { data, error } = await this._client.rpc("record_capital_event", {
        p_investor: investorId, p_type: type, p_amount: amount,
        p_date: date || new Date().toISOString().slice(0, 10), p_note: note || null,
      });
      if (error) throw error;
      return data;
    },

    /* ============================================================
       WITHDRAWAL REQUESTS
       ============================================================ */
    async requestWithdrawal({ amount, note }) {
      const session = await this.getSession();
      const { data, error } = await this._client
        .from("withdrawal_requests")
        .insert({ investor_id: session.user.id, amount, note: note || null })
        .select().single();
      if (error) throw error;
      return data;
    },

    async getMyWithdrawals() {
      const session = await this.getSession();
      if (!session) return [];
      const { data, error } = await this._client
        .from("withdrawal_requests").select("*")
        .eq("investor_id", session.user.id)
        .order("requested_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data || [];
    },

    async getPendingWithdrawals() {
      const { data, error } = await this._client
        .from("withdrawal_requests")
        .select("*, profiles(id, name)")
        .eq("status", "pending")
        .order("requested_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },

    /* Approve executes the redemption at today's NAV atomically */
    async resolveWithdrawal(requestId, approve) {
      const { data, error } = await this._client.rpc("resolve_withdrawal", {
        p_request: requestId, p_approve: approve,
      });
      if (error) throw error;
      return data;
    },

    /* ============================================================
       RISK PREFERENCE
       ============================================================ */
    async setMyRiskPref(pref) {
      const { error } = await this._client.rpc("set_my_risk_pref", { p_pref: pref });
      if (error) throw error;
    },

    /* ============================================================
       INVESTOR META (manager: status, phone, private notes)
       ============================================================ */
    async updateInvestorMeta({ investorId, status, riskPref, phone, mgrNotes }) {
      const patch = { investor_id: investorId, updated_at: new Date().toISOString() };
      if (status   != null) patch.status    = status;
      if (riskPref != null) patch.risk_pref = riskPref;
      if (phone    != null) patch.phone     = phone;
      if (mgrNotes != null) patch.mgr_notes = mgrNotes;
      // Upsert so metadata can be set before the first deposit creates the row
      const { data, error } = await this._client
        .from("investor_accounts")
        .upsert(patch, { onConflict: "investor_id" })
        .select().single();
      if (error) throw error;
      return data;
    },

    /* ============================================================
       MESSAGES — investor ↔ manager threads (realtime-capable)
       ============================================================ */
    async getMyMessages() {
      const session = await this.getSession();
      if (!session) return [];
      const { data, error } = await this._client
        .from("messages").select("*")
        .eq("investor_id", session.user.id)
        .order("created_at", { ascending: true }).limit(200);
      if (error) throw error;
      return data || [];
    },

    /* Manager: every thread's messages, newest threads first */
    async getAllMessages(limit = 300) {
      const { data, error } = await this._client
        .from("messages").select("*, profiles(id, name)")
        .order("created_at", { ascending: true }).limit(limit);
      if (error) throw error;
      return data || [];
    },

    /* investorId: for managers, the thread to post into;
       investors always post into their own thread */
    async sendMessage({ investorId, senderRole, subject, body }) {
      const session = await this.getSession();
      const thread = senderRole === "manager" ? investorId : session.user.id;
      const { data, error } = await this._client
        .from("messages")
        .insert({ investor_id: thread, sender_role: senderRole, subject: subject || null, body })
        .select().single();
      if (error) throw error;
      return data;
    },

    async markMessagesRead() {
      const session = await this.getSession();
      const { error } = await this._client
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("investor_id", session.user.id)
        .eq("sender_role", "manager")
        .is("read_at", null);
      if (error) throw error;
    },

    subscribeMessages(onInsert) {
      return this._client
        .channel("messages-realtime")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => onInsert(p.new))
        .subscribe();
    },
  };

  global.JSSDB = DB;
})(window);
