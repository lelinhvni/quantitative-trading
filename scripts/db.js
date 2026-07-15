/* ============================================================
   BPSQuant — Supabase data layer
   window.JSSDB is safe to use from any page that loads db.js.
   If Supabase isn't configured, isReady() returns false and
   every page falls back to demo data automatically.
   ============================================================ */
(function (global) {
  "use strict";

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
       CONTACT LEADS
       ============================================================ */
    async submitLead({ name, email, message }) {
      const { error } = await this._client
        .from("contact_leads").insert({ name, email, message: message || null });
      if (error) throw error;
    },

    async getLeads() {
      const { data, error } = await this._client
        .from("contact_leads").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data || [];
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
      const patch = { updated_at: new Date().toISOString() };
      if (status   != null) patch.status    = status;
      if (riskPref != null) patch.risk_pref = riskPref;
      if (phone    != null) patch.phone     = phone;
      if (mgrNotes != null) patch.mgr_notes = mgrNotes;
      const { data, error } = await this._client
        .from("investor_accounts").update(patch)
        .eq("investor_id", investorId).select().single();
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
