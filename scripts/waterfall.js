/* ============================================================
   BPSQuant — monthly distribution waterfall (Clause 6)

   Turns one number — the fund's net trading profit for a month — into
   one distribution row per investor, applying the agreement exactly:

     6.4(a)  profit at or above target  -> pay the target, then
     6.6     repay anything owed to that investor, then
     6.4(a)  top that investor's reserve up to six months of target,
             and anything still left is the Company's
     6.4(b)  profit below target -> pay what there is and draw the
             investor's own reserve to make the target up
     6.4(c)  reserve exhausted -> pay what is available, record the gap
     6.4(d)  a losing month -> pay only what the reserve covers
     6.4A    nothing beyond twelve months of target in a calendar year

   Every reserve and shortfall is that investor's own (6.5, 6.6), so no
   investor's payment is ever met from another's pot.

   Pure arithmetic, no I/O, so it can be unit tested:
     window.JSSWaterfall.run(input) -> { rows, totals, warnings }
   ============================================================ */
(function (global) {
  "use strict";

  const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  /**
   * @param {object} input
   *   period            "2026-12-01"
   *   fundProfit        net trading profit for the month, in dollars
   *   targetRate        0.017
   *   reserveCapMonths  6
   *   annualCapMonths   12  (Clause 6.4A); 0 disables the cap
   *   investors[]       { id, name, units, openingValue, reserve,
   *                       shortfall, ytdPaid, mode }
   */
  function run(input) {
    const targetRate = input.targetRate != null ? +input.targetRate : 0.017;
    const capMonths = input.reserveCapMonths != null ? +input.reserveCapMonths : 6;
    const annMonths = input.annualCapMonths != null ? +input.annualCapMonths : 12;
    const investors = (input.investors || []).filter(i => +i.units > 0);
    const fundProfit = +input.fundProfit || 0;
    const warnings = [];

    const totalUnits = investors.reduce((a, i) => a + +i.units, 0);
    if (!totalUnits) {
      return { rows: [], totals: blankTotals(), warnings: ["No investor holds any units, so there is nothing to distribute."] };
    }

    const rows = investors.map((inv) => {
      const units = +inv.units;
      const openingValue = +inv.openingValue || 0;
      const reserve0 = +inv.reserve || 0;
      const short0 = +inv.shortfall || 0;
      const ytdPaid = +inv.ytdPaid || 0;

      // Each investor's slice of the month, by units held.
      const shareFrac = units / totalUnits;
      const share = r2(fundProfit * shareFrac);
      const target = r2(openingValue * targetRate);
      const reserveCap = r2(target * capMonths);

      // Clause 6.4A — nothing beyond twelve months of target in a year.
      const annualCap = annMonths > 0 ? r2(target * annMonths) : Infinity;
      const annualRoom = annMonths > 0 ? Math.max(0, r2(annualCap - ytdPaid)) : Infinity;
      const payTarget = Math.min(target, annualRoom);
      const cappedByAnnual = annMonths > 0 && payTarget < target - 0.005;

      let pool = share;              // profit still unallocated
      let paid = 0;                  // cash (or units) to the investor
      let reserveDelta = 0;          // + retained, − drawn
      let shortfallDelta = 0;        // + recorded, − repaid
      let companyExcess = 0;

      if (pool >= payTarget) {
        // --- the fund covered the target ---
        paid = payTarget;
        pool = r2(pool - paid);

        // 6.6: what is owed comes before anything the Company keeps.
        const roomAfterTarget = annMonths > 0 ? Math.max(0, r2(annualRoom - paid)) : Infinity;
        const repay = r2(Math.min(pool, short0, roomAfterTarget));
        if (repay > 0) { paid = r2(paid + repay); shortfallDelta = -repay; pool = r2(pool - repay); }

        // 6.4(a): fill this investor's reserve, then the rest is the Company's.
        const room = Math.max(0, r2(reserveCap - reserve0));
        const toReserve = r2(Math.min(pool, room));
        if (toReserve > 0) { reserveDelta = toReserve; pool = r2(pool - toReserve); }
        if (pool > 0) companyExcess = pool;
      } else {
        // --- the fund fell short, or lost money ---
        const fromProfit = Math.max(0, r2(pool));          // a loss contributes nothing
        const need = r2(payTarget - fromProfit);
        const draw = r2(Math.min(Math.max(0, need), reserve0));
        paid = r2(fromProfit + draw);
        reserveDelta = -draw;
        // A gap the investor is owed — but not when the annual cap, rather
        // than the fund, is what stopped the payment.
        const gap = r2(target - paid);
        if (gap > 0 && !cappedByAnnual) shortfallDelta = gap;
      }

      const reserveAfter = r2(reserve0 + reserveDelta);
      const shortfallAfter = r2(short0 + shortfallDelta);

      if (reserveAfter < -0.005) warnings.push(`${inv.name || inv.id}: reserve would go negative.`);
      if (paid < -0.005) warnings.push(`${inv.name || inv.id}: payment computed negative.`);

      return {
        investorId: inv.id,
        name: inv.name || inv.id,
        mode: inv.mode === "reinvest" ? "reinvest" : "cash",
        units, shareFrac,
        openingValue, target, targetRate,
        profitShare: share,
        paid: r2(paid),
        reserveDelta: r2(reserveDelta),
        shortfallDelta: r2(shortfallDelta),
        companyExcess: r2(companyExcess),
        reserveBefore: reserve0, reserveAfter,
        shortfallBefore: short0, shortfallAfter,
        reserveCap, annualCap: annMonths > 0 ? annualCap : null,
        ytdPaid, ytdAfter: r2(ytdPaid + paid),
        cappedByAnnual,
      };
    });

    const sum = (k) => r2(rows.reduce((a, x) => a + x[k], 0));
    const totals = {
      investors: rows.length,
      fundProfit: r2(fundProfit),
      allocated: sum("profitShare"),
      target: sum("target"),
      paid: sum("paid"),
      reserveDelta: sum("reserveDelta"),
      shortfallDelta: sum("shortfallDelta"),
      companyExcess: sum("companyExcess"),
      cash: r2(rows.filter(r => r.mode === "cash").reduce((a, r) => a + r.paid, 0)),
      reinvested: r2(rows.filter(r => r.mode === "reinvest").reduce((a, r) => a + r.paid, 0)),
      cappedCount: rows.filter(r => r.cappedByAnnual).length,
    };

    // Conservation. For each investor the waterfall must satisfy
    //     paid + reserveDelta + companyExcess = max(profitShare, 0)
    // A losing month does not flow through the waterfall at all: the loss
    // is borne by the unit price, and the only movement is the reserve
    // being drawn to make a payment. So the right-hand side is the
    // POSITIVE share, not the signed one.
    totals.positiveShare = r2(rows.reduce((a, x) => a + Math.max(0, x.profitShare), 0));
    totals.lossBorneByNav = r2(rows.reduce((a, x) => a + Math.min(0, x.profitShare), 0));
    const movement = r2(totals.paid + totals.reserveDelta + totals.companyExcess);
    totals.unaccounted = r2(totals.positiveShare - movement);
    if (Math.abs(totals.unaccounted) > 0.05) {
      warnings.push(`Profit of ${totals.positiveShare} does not match payments, reserve movements and the Company share (${movement}). Do not save this month.`);
    }

    return { rows, totals, warnings };
  }

  function blankTotals() {
    return { investors: 0, fundProfit: 0, allocated: 0, target: 0, paid: 0, reserveDelta: 0,
             shortfallDelta: 0, companyExcess: 0, cash: 0, reinvested: 0, cappedCount: 0,
             positiveShare: 0, lossBorneByNav: 0, unaccounted: 0 };
  }

  global.JSSWaterfall = { run, _r2: r2 };
})(typeof window !== "undefined" ? window : globalThis);
