/* ============================================================
   BPSQuant — investor portal language

   English and Vietnamese for everything an investor sees. The manager
   view stays in English; Kevin and Cody use it, investors never do.

   Terminology follows the signed Vietnamese documents, so the portal
   and the agreement use the same words for the same things:
     reserve pot  -> quỹ dự phòng
     target       -> mục tiêu
     balance      -> số dư
     owed         -> còn nợ bạn
     unit         -> đơn vị

   window.JSSI18N.t("key", { n: 3 }) — {n} is substituted.
   Missing keys fall back to English, then to the key itself, so a gap
   shows up as readable English rather than a blank.
   ============================================================ */
(function (global) {
  "use strict";

  const STORE = "jss_lang";

  const EN = {
    /* language switch */
    "lang.switch": "Tiếng Việt",
    "lang.label": "Language",
    "nav.home": "Home",
    "nav.quant": "Quant Finance",
    "nav.markets": "Markets",
    "nav.news": "News",
    "nav.discussion": "Discussion",
    "nav.portal": "Investor portal",
    "nav.menu": "Toggle menu",
    "foot.rights": "© {year} {brand}. For informational purposes only — not investment advice.",
    "foot.disclaimer": "Performance figures may be simulated or illustrative. Investing involves risk of loss.",

    /* hero */
    "hero.worth": "Your account is worth",
    "hero.earnedSince": "earned since you joined",
    "hero.downSince": "down since you joined",
    "hero.putIn": "You put in",
    "hero.depWd": "{dep} deposited − {wd} withdrawn",
    "hero.since": "since {date}",
    "hero.noDeposits": "no deposits yet",
    "hero.earned": "You've earned",
    "hero.per100": "every $100 you put in has earned ${n}",
    "hero.startsOnDeposit": "starts once your first deposit lands",
    "hero.incomePaid": "Income paid to you",
    "hero.cashReinv": "{cash} cash · {reinv} reinvested",
    "hero.paidInCash": "paid in cash",
    "hero.noDistYet": "no distributions yet",

    /* money flow */
    "flow.title": "Where your money went",
    "flow.sub": "Every line adds up to the one below it",
    "flow.putIn": "You put in",
    "flow.tookOut": "You took out",
    "flow.inFund": "Your money in the fund",
    "flow.earned": "What the fund earned you",
    "flow.incomePaid": "Income already paid to you",
    "flow.incomeBack": "Income added back in",
    "flow.balance": "Your balance today",
    "flow.someInBank": "{amount} of that is already in your bank. The rest is still working in the fund.",
    "flow.allWorking": "All of it is still in the fund, working.",

    /* monthly income */
    "income.title": "Monthly income",
    "income.subTarget": "Target {pct}% a month",
    "income.yourTarget": "Your target",
    "income.atBalance": "a month, at today's balance",
    "income.paidSoFar": "Paid so far",
    "income.notDue": "first payment not due yet",
    "income.notGuarantee": "A target, not a guarantee. You are paid from what the fund actually earns.",
    "income.thisYear": "This year so far",
    "income.mostPerYear": "most you can get in a year is {amount}",
    "income.lastPayment": "Last payment",
    "income.reinvested": "reinvested",
    "income.owed": "Owed to you",
    "income.owedSub": "paid back from later profit",
    "income.thMonth": "Month",
    "income.thTarget": "Target",
    "income.thFundMade": "Fund made you",
    "income.thReceived": "You received",
    "income.thReserve": "Your reserve",
    "income.footer": "A short month is topped up from your reserve pot. If the pot is empty, the rest is owed to you and paid back from later profit. Once you have had your target and your pot is full, anything the fund earns above that is kept by the fund manager",
    "income.footerExcess": " — {amount} so far",
    "income.footerReinv": " ↻ added to your balance instead of paid out.",

    /* reserve pot */
    "pot.holds": "Your pot holds <b>{amount}</b>",
    "pot.canHold": "it can hold up to {amount}",
    "pot.empty": "Your pot is empty right now. It fills up again the next time the fund beats your target.",
    "pot.coverPct": "On its own that would cover about <b>{n}%</b> of one month's payment.",
    "pot.coverMonths": "On its own that would cover about <b>{n} months</b> of payments.",

    /* last month, in one sentence */
    "story.gotPaid": "you were paid <b>{amount}</b>",
    "story.gotAdded": "<b>{amount}</b> was added to your balance",
    "story.lossEmpty": "the fund <b>lost money</b> and your pot was empty, so there was <b>no payment</b> this month. The full <b>{target}</b> is owed to you and comes back out of later profit.",
    "story.lossPartial": "the fund <b>lost money</b>. Your pot covered what it could, so {got}",
    "story.lossShort": ", which is {gap} less than your target. That {gap} is owed to you and comes back out of later profit.",
    "story.surplus": "the fund earned you <b>{profit}</b>. Your target was {target}, so {got} and the spare <b>{spare}</b> went into your pot.",
    "story.toppedUp": "the fund earned you <b>{profit}</b> — less than your {target} target. Your pot made up the missing <b>{gap}</b>, so {got} anyway.",
    "story.exact": "the fund earned you <b>{profit}</b>, and {got}.",

    /* how it is worked out */
    "calc.summary": "How your balance is worked out",
    "calc.hint": "the short version",
    "calc.earned": "What you have earned.",
    "calc.earnedBody": "Your balance now, less what you put in, plus anything already paid out to you.",
    "calc.rate": "Your return rate.",
    "calc.rateBody": "<b>{rate} a year</b>, counting when each deposit arrived.",
    "calc.rateNone": "Shown once there is enough history to measure it fairly.",
    "calc.joinLater": "Joining later costs you nothing.",
    "calc.joinLaterBody": "Your deposit buys a share of the fund at what it is worth the day it lands, and your reserve pot is your own.",
    "calc.footer": "Every figure comes from your recorded deposits, withdrawals and the fund's published valuation. If one looks wrong, message us below.",

    /* chart and sections */
    "chart.title": "How your money has grown",
    "chart.sub": "Your balance at each valuation",
    "chart.none": "Your growth chart appears once your first deposit is recorded.",
    "sec.deposits": "Your deposits & withdrawals",
    "sec.records": "{n} records",
    "sec.record1": "1 record",
    "sec.nothingYet": "Nothing recorded yet.",
    "sec.messages": "Messages with the team",
    "sec.newMsgs": "{n} new",
    "sec.msgs": "{n} messages",
    "sec.msg1": "1 message",
    "sec.trading": "What the fund is trading",
    "sec.recent": "{n} recent",
    "sec.withdraw": "Request a withdrawal",
    "sec.anytime": "any time",
    "sec.requests": "{n} requests",
    "sec.request1": "1 request",
    "sec.risk": "Your risk preference",
    "sec.pending": "You have {n} withdrawal requests awaiting review.",
    "sec.pending1": "You have 1 withdrawal request awaiting review.",
    "foot.updates": "Figures update as soon as the fund publishes a new valuation",
    "foot.lastSet": " — last set {date}",
    "tbl.date": "Date", "tbl.type": "Type", "tbl.amount": "Amount", "tbl.note": "Note",
    "type.deposit": "deposit", "type.withdrawal": "withdrawal",
    "loading": "Loading your account…",
    "trade.recent": "Recent trades",
    "trade.everyOpen": "Every position we open",
    "trade.none": "No trades recorded yet.",
    "trade.ticker": "Ticker", "trade.side": "Side", "trade.qty": "Qty",
    "trade.price": "Price", "trade.strategy": "Strategy",
    "pos.title": "Open positions",
    "pos.symbol": "Symbol", "pos.avgCost": "Avg cost",
    "pos.none": "No open positions.",

    /* withdrawals */
    "wd.title": "Request a withdrawal",
    "wd.sub": "Reviewed by the fund manager",
    "wd.amount": "Amount ($)",
    "wd.note": "Note (optional)",
    "wd.notePh": "Reason or instructions",
    "wd.submit": "Submit request",
    "wd.ok": "✓ Request submitted — the manager will review it shortly.",
    "wd.requested": "Requested", "wd.status": "Status",
    "st.pending": "pending", "st.approved": "approved", "st.denied": "denied",

    /* messages */
    "msg.title": "Messages",
    "msg.sub": "Your conversation with BPSQuant",
    "msg.none": "No messages yet — send the first one below.",
    "msg.subject": "Subject",
    "msg.subjectPh": "Question about my account...",
    "msg.body": "Message",
    "msg.bodyPh": "Write your message...",
    "msg.send": "Send",

    /* risk */
    "risk.title": "Portfolio risk preference",
    "risk.sub": "Request your risk profile — manager reviews and adjusts",
    "risk.save": "Save preference",
    "risk.conservative": "Conservative",
    "risk.conservativeD": "Play it safe. Smaller gains, but fewer bad months.",
    "risk.balanced": "Balanced",
    "risk.balancedD": "A middle path. Most people choose this one.",
    "risk.growth": "Growth",
    "risk.growthD": "Aim higher. Bigger gains, and bigger drops along the way.",
    "risk.aggressive": "Aggressive",
    "risk.aggressiveD": "Push hard. Expect some months to hurt.",
    "risk.perYear": "/ yr",

    /* login */
    "login.eyebrow": "INVESTOR PORTAL",
    "login.title": "Sign in",
    "login.lede": "Track your capital, returns and statements. Fund managers get an oversight view.",
    "login.email": "Email",
    "login.password": "Password",
    "login.submit": "Sign in",
    "login.forgot": "Forgot password?",
    "login.signingIn": "Signing in…",
    "login.welcome": "Welcome, {name}",
    "login.investorAcct": "Investor account",
    "login.signOut": "Sign out",
  };

  const VI = {
    "lang.switch": "English",
    "lang.label": "Ngôn ngữ",
    "nav.home": "Trang chủ",
    "nav.quant": "Tài chính định lượng",
    "nav.markets": "Thị trường",
    "nav.news": "Tin tức",
    "nav.discussion": "Thảo luận",
    "nav.portal": "Cổng nhà đầu tư",
    "nav.menu": "Mở menu",
    "foot.rights": "© {year} {brand}. Chỉ nhằm mục đích thông tin — không phải tư vấn đầu tư.",
    "foot.disclaimer": "Các số liệu hiệu quả có thể là mô phỏng hoặc minh họa. Đầu tư có rủi ro mất vốn.",

    "hero.worth": "Tài khoản của bạn trị giá",
    "hero.earnedSince": "đã kiếm được từ khi bạn tham gia",
    "hero.downSince": "giảm từ khi bạn tham gia",
    "hero.putIn": "Bạn đã góp",
    "hero.depWd": "đã nạp {dep} − đã rút {wd}",
    "hero.since": "từ ngày {date}",
    "hero.noDeposits": "chưa có khoản góp nào",
    "hero.earned": "Bạn đã kiếm được",
    "hero.per100": "mỗi 100 USD bạn góp đã sinh ra {n} USD",
    "hero.startsOnDeposit": "bắt đầu tính khi khoản góp đầu tiên về",
    "hero.incomePaid": "Thu nhập đã trả cho bạn",
    "hero.cashReinv": "{cash} tiền mặt · {reinv} tái đầu tư",
    "hero.paidInCash": "trả bằng tiền mặt",
    "hero.noDistYet": "chưa có khoản phân phối nào",

    "flow.title": "Tiền của bạn đã đi đâu",
    "flow.sub": "Mỗi dòng cộng lại thành dòng ngay bên dưới",
    "flow.putIn": "Bạn đã góp vào",
    "flow.tookOut": "Bạn đã rút ra",
    "flow.inFund": "Tiền của bạn trong quỹ",
    "flow.earned": "Quỹ đã kiếm cho bạn",
    "flow.incomePaid": "Thu nhập đã trả cho bạn",
    "flow.incomeBack": "Thu nhập cộng lại vào số dư",
    "flow.balance": "Số dư của bạn hôm nay",
    "flow.someInBank": "{amount} trong số đó đã nằm trong tài khoản ngân hàng của bạn. Phần còn lại vẫn đang sinh lời trong quỹ.",
    "flow.allWorking": "Toàn bộ vẫn đang sinh lời trong quỹ.",

    "income.title": "Thu nhập hàng tháng",
    "income.subTarget": "Mục tiêu {pct}% mỗi tháng",
    "income.yourTarget": "Mục tiêu của bạn",
    "income.atBalance": "mỗi tháng, theo số dư hôm nay",
    "income.paidSoFar": "Đã trả đến nay",
    "income.notDue": "chưa đến kỳ trả đầu tiên",
    "income.notGuarantee": "Đây là mục tiêu, không phải cam kết. Bạn được trả từ lợi nhuận quỹ thực sự kiếm được.",
    "income.thisYear": "Năm nay đến giờ",
    "income.mostPerYear": "mức cao nhất bạn có thể nhận trong một năm là {amount}",
    "income.lastPayment": "Lần trả gần nhất",
    "income.reinvested": "tái đầu tư",
    "income.owed": "Còn nợ bạn",
    "income.owedSub": "được trả lại từ lợi nhuận sau này",
    "income.thMonth": "Tháng",
    "income.thTarget": "Mục tiêu",
    "income.thFundMade": "Quỹ kiếm cho bạn",
    "income.thReceived": "Bạn đã nhận",
    "income.thReserve": "Quỹ dự phòng",
    "income.footer": "Tháng nào thiếu thì được bù từ quỹ dự phòng của bạn. Nếu quỹ dự phòng đã cạn, phần còn thiếu được ghi nợ cho bạn và trả lại từ lợi nhuận sau này. Khi bạn đã nhận đủ mục tiêu và quỹ dự phòng đã đầy, phần lợi nhuận vượt trên mức đó thuộc về công ty quản lý quỹ",
    "income.footerExcess": " — {amount} đến nay",
    "income.footerReinv": " ↻ được cộng vào số dư thay vì trả bằng tiền mặt.",

    "pot.holds": "Quỹ dự phòng của bạn đang có <b>{amount}</b>",
    "pot.canHold": "tối đa có thể giữ {amount}",
    "pot.empty": "Quỹ dự phòng của bạn hiện đang trống. Nó sẽ đầy lại vào lần tới quỹ vượt mục tiêu của bạn.",
    "pot.coverPct": "Riêng khoản đó đủ bù khoảng <b>{n}%</b> của một tháng chi trả.",
    "pot.coverMonths": "Riêng khoản đó đủ bù khoảng <b>{n} tháng</b> chi trả.",

    "story.gotPaid": "bạn được trả <b>{amount}</b>",
    "story.gotAdded": "<b>{amount}</b> đã được cộng vào số dư của bạn",
    "story.lossEmpty": "quỹ <b>bị lỗ</b> và quỹ dự phòng của bạn đã trống, nên tháng này <b>không có khoản chi trả nào</b>. Toàn bộ <b>{target}</b> được ghi nợ cho bạn và sẽ trả lại từ lợi nhuận sau này.",
    "story.lossPartial": "quỹ <b>bị lỗ</b>. Quỹ dự phòng của bạn bù được đến đâu hay đến đó, nên {got}",
    "story.lossShort": ", ít hơn mục tiêu {gap}. Khoản {gap} đó được ghi nợ cho bạn và sẽ trả lại từ lợi nhuận sau này.",
    "story.surplus": "quỹ kiếm cho bạn <b>{profit}</b>. Mục tiêu của bạn là {target}, nên {got} và phần dư <b>{spare}</b> được đưa vào quỹ dự phòng của bạn.",
    "story.toppedUp": "quỹ kiếm cho bạn <b>{profit}</b> — ít hơn mục tiêu {target}. Quỹ dự phòng của bạn bù thêm <b>{gap}</b> còn thiếu, nên {got} đầy đủ.",
    "story.exact": "quỹ kiếm cho bạn <b>{profit}</b>, và {got}.",

    "calc.summary": "Số dư của bạn được tính thế nào",
    "calc.hint": "bản rút gọn",
    "calc.earned": "Bạn đã kiếm được bao nhiêu.",
    "calc.earnedBody": "Số dư hiện tại, trừ đi số bạn đã góp, cộng với những gì đã trả cho bạn.",
    "calc.rate": "Tỷ suất lợi nhuận của bạn.",
    "calc.rateBody": "<b>{rate} mỗi năm</b>, có tính đến thời điểm từng khoản góp về.",
    "calc.rateNone": "Sẽ hiện khi có đủ lịch sử để tính một cách công bằng.",
    "calc.joinLater": "Tham gia muộn không khiến bạn thiệt.",
    "calc.joinLaterBody": "Khoản góp của bạn mua phần của quỹ theo đúng giá trị vào ngày tiền về, và quỹ dự phòng là của riêng bạn.",
    "calc.footer": "Mọi con số đều lấy từ các khoản nạp, rút đã ghi nhận của bạn và mức định giá quỹ công bố. Nếu thấy con số nào không đúng, hãy nhắn cho chúng tôi bên dưới.",

    "chart.title": "Tiền của bạn đã tăng thế nào",
    "chart.sub": "Số dư của bạn tại mỗi lần định giá",
    "chart.none": "Biểu đồ tăng trưởng sẽ xuất hiện khi khoản góp đầu tiên của bạn được ghi nhận.",
    "sec.deposits": "Các khoản nạp & rút của bạn",
    "sec.records": "{n} bản ghi",
    "sec.record1": "1 bản ghi",
    "sec.nothingYet": "Chưa có gì được ghi nhận.",
    "sec.messages": "Tin nhắn với đội ngũ",
    "sec.newMsgs": "{n} tin mới",
    "sec.msgs": "{n} tin nhắn",
    "sec.msg1": "1 tin nhắn",
    "sec.trading": "Quỹ đang giao dịch gì",
    "sec.recent": "{n} gần đây",
    "sec.withdraw": "Yêu cầu rút tiền",
    "sec.anytime": "bất cứ lúc nào",
    "sec.requests": "{n} yêu cầu",
    "sec.request1": "1 yêu cầu",
    "sec.risk": "Khẩu vị rủi ro của bạn",
    "sec.pending": "Bạn có {n} yêu cầu rút tiền đang chờ duyệt.",
    "sec.pending1": "Bạn có 1 yêu cầu rút tiền đang chờ duyệt.",
    "foot.updates": "Các con số cập nhật ngay khi quỹ công bố mức định giá mới",
    "foot.lastSet": " — lần gần nhất {date}",
    "tbl.date": "Ngày", "tbl.type": "Loại", "tbl.amount": "Số tiền", "tbl.note": "Ghi chú",
    "type.deposit": "nạp tiền", "type.withdrawal": "rút tiền",
    "loading": "Đang tải tài khoản của bạn…",
    "trade.recent": "Giao dịch gần đây",
    "trade.everyOpen": "Mọi vị thế chúng tôi mở",
    "trade.none": "Chưa ghi nhận giao dịch nào.",
    "trade.ticker": "Mã", "trade.side": "Chiều", "trade.qty": "Số lượng",
    "trade.price": "Giá", "trade.strategy": "Chiến lược",
    "pos.title": "Vị thế đang mở",
    "pos.symbol": "Mã", "pos.avgCost": "Giá vốn bình quân",
    "pos.none": "Không có vị thế nào đang mở.",

    "wd.title": "Yêu cầu rút tiền",
    "wd.sub": "Được quản lý quỹ xem xét",
    "wd.amount": "Số tiền ($)",
    "wd.note": "Ghi chú (không bắt buộc)",
    "wd.notePh": "Lý do hoặc hướng dẫn",
    "wd.submit": "Gửi yêu cầu",
    "wd.ok": "✓ Đã gửi yêu cầu — quản lý quỹ sẽ xem xét trong thời gian ngắn.",
    "wd.requested": "Ngày yêu cầu", "wd.status": "Trạng thái",
    "st.pending": "đang chờ", "st.approved": "đã duyệt", "st.denied": "bị từ chối",

    "msg.title": "Tin nhắn",
    "msg.sub": "Cuộc trò chuyện của bạn với BPSQuant",
    "msg.none": "Chưa có tin nhắn nào — hãy gửi tin đầu tiên bên dưới.",
    "msg.subject": "Tiêu đề",
    "msg.subjectPh": "Câu hỏi về tài khoản của tôi...",
    "msg.body": "Nội dung",
    "msg.bodyPh": "Viết tin nhắn của bạn...",
    "msg.send": "Gửi",

    "risk.title": "Khẩu vị rủi ro danh mục",
    "risk.sub": "Đề xuất mức rủi ro — quản lý quỹ xem xét và điều chỉnh",
    "risk.save": "Lưu lựa chọn",
    "risk.conservative": "Thận trọng",
    "risk.conservativeD": "An toàn là chính. Lãi ít hơn, nhưng ít tháng xấu hơn.",
    "risk.balanced": "Cân bằng",
    "risk.balancedD": "Ở giữa. Phần lớn mọi người chọn mức này.",
    "risk.growth": "Tăng trưởng",
    "risk.growthD": "Nhắm cao hơn. Lãi lớn hơn, và cũng sụt sâu hơn trên đường đi.",
    "risk.aggressive": "Mạo hiểm",
    "risk.aggressiveD": "Đẩy mạnh. Hãy chuẩn bị cho những tháng đau.",
    "risk.perYear": "/ năm",

    "login.eyebrow": "CỔNG THÔNG TIN NHÀ ĐẦU TƯ",
    "login.title": "Đăng nhập",
    "login.lede": "Theo dõi vốn, lợi nhuận và sao kê của bạn. Quản lý quỹ có thêm màn hình giám sát.",
    "login.email": "Email",
    "login.password": "Mật khẩu",
    "login.submit": "Đăng nhập",
    "login.forgot": "Quên mật khẩu?",
    "login.signingIn": "Đang đăng nhập…",
    "login.welcome": "Chào {name}",
    "login.investorAcct": "Tài khoản nhà đầu tư",
    "login.signOut": "Đăng xuất",
  };

  const DICT = { en: EN, vi: VI };
  const listeners = [];

  function detect() {
    try {
      const saved = localStorage.getItem(STORE);
      if (saved === "en" || saved === "vi") return saved;
    } catch (_) { /* private mode */ }
    const nav = (global.navigator && (global.navigator.language || "")) || "";
    return /^vi\b/i.test(nav) ? "vi" : "en";
  }

  let lang = detect();

  function t(key, vars) {
    const table = DICT[lang] || EN;
    let s = table[key];
    if (s == null) s = EN[key];
    if (s == null) return key;                    // visible, not blank
    if (vars) {
      Object.keys(vars).forEach(k => {
        s = s.split("{" + k + "}").join(String(vars[k]));
      });
    }
    return s;
  }

  function set(next) {
    if (next !== "en" && next !== "vi") return;
    lang = next;
    try { localStorage.setItem(STORE, next); } catch (_) {}
    try { document.documentElement.lang = next; } catch (_) {}
    listeners.forEach(fn => { try { fn(next); } catch (_) {} });
  }

  function onChange(fn) { if (typeof fn === "function") listeners.push(fn); }

  try { document.documentElement.lang = lang; } catch (_) {}

  global.JSSI18N = {
    t, set, onChange,
    get lang() { return lang; },
    other() { return lang === "vi" ? "en" : "vi"; },
  };
})(typeof window !== "undefined" ? window : globalThis);
