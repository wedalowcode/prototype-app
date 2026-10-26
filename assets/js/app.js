/* ============================================================
   中油易拍客 · 竞买人 APP 端原型  app.js
   手机壳渲染器 + 移动端交互组件 + APP 侧数据补充
   —— 数据层与业务引擎复用 prototype-admin/assets/js/common.js（同一套业务数据）
   —— 唯一业务依据：/PRD/01~04
   ============================================================ */
(function (global) {
  'use strict';

  var U = global.WB_U, DB = global.WB_DB, E = global.WB_ENGINE, DICT = global.DICT;

  /* ---------- 0. 路径与工具 ---------- */
  var APP = {};
  global.APP = APP;

  var scriptEl = document.currentScript;
  var scriptUrl = scriptEl ? scriptEl.src : '';
  APP.ROOT = scriptUrl.replace(/assets\/js\/app\.js.*$/, '');   // file:///…/prototype-app/
  APP.href = function (p) { return APP.ROOT + String(p).replace(/^\//, ''); };
  APP.go = function (p) { location.href = APP.href(p); };

  var X = APP.X = {};
  X.esc = U.esc;
  X.r2 = U.r2;
  X.money = U.money;
  X.moneyW = U.moneyW;
  X.pct = U.pct;
  X.fmtDate = U.fmtDate;
  X.fmtDT = U.fmtDT;
  X.hash = U.hash;
  X.rnd = U.rnd;
  X.planDate = U.planDate;

  /* 金额：元 → 带千分位；≥1 万时同时给出「万」口径 */
  X.yuan = function (n) {
    if (n === null || n === undefined || n === '') return '—';
    return Number(n).toLocaleString('zh-CN');
  };
  X.w = function (n) {  // 万元，保留 2 位并去尾零
    if (n === null || n === undefined) return '—';
    var v = Number(n) / 10000;
    return (Math.round(v * 100) / 100).toLocaleString('zh-CN');
  };
  X.pad2 = function (n) { return String(n).padStart(2, '0'); };

  /* 倒计时：返回 {d,h,m,s,txt,over} */
  X.countdown = function (endStr, now) {
    var end = U.asDate(endStr);
    if (!end) return { over: true, txt: '—', ms: 0 };
    var ms = end.getTime() - (now ? now.getTime() : Date.now());
    if (ms <= 0) return { over: true, txt: '已结束', ms: 0 };
    var s = Math.floor(ms / 1000);
    var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
    var txt = d > 0 ? (d + ' 天 ' + X.pad2(h) + ':' + X.pad2(m) + ':' + X.pad2(ss))
      : (X.pad2(h) + ':' + X.pad2(m) + ':' + X.pad2(ss));
    return { over: false, ms: ms, d: d, h: h, m: m, s: ss, txt: txt, urgent: ms <= 30000 };
  };

  /* 服务端时间基准：必须与原型全局时间基准一致（WB.SERVER_TIME = 2026-10-09 17:13）。
     若取真实系统时间，种子数据里的场次倒计时、报名截止、履约时限会全部过期，
     演示不可复现，且与后台的「今天」口径冲突。 */
  APP.SERVER_TIME = (function () {
    var d = U.asDate(global.WB.SERVER_TIME);
    return d || new Date();
  })();

  /* ---------- 1. 状态栏 / 导航 / Tab ---------- */
  var TABS = [
    { k: 'home', t: '首页', ic: '🏠', href: 'index.html' },
    { k: 'assets', t: '资产', ic: '🗂️', href: 'asset/list.html' },
    { k: 'bids', t: '我的竞拍', ic: '🔨', href: 'mine/bids.html' },
    { k: 'msg', t: '消息', ic: '💬', href: 'mine/messages.html' },
    { k: 'mine', t: '我的', ic: '👤', href: 'mine/index.html' }
  ];

  APP.statusbar = function (dark) {
    return '<div class="statusbar' + (dark ? ' dark' : '') + '">' +
      '<span>9:41</span>' +
      '<span class="sb-r"><span>▮▮▮</span><span>WiFi</span><span class="bat"></span></span>' +
      '</div>';
  };

  APP.appbar = function (o) {
    o = o || {};
    var back = o.back === false ? '' :
      '<button class="back" data-go="' + X.esc(o.backTo || 'back') + '" aria-label="返回">‹</button>';
    var right = o.right || '';
    return '<div class="appbar' + (o.plain ? ' plain' : '') + '">' + back +
      '<div class="ttl">' + X.esc(o.title || '') + '</div>' +
      (right ? '<div class="ra-wrap">' + right + '</div>' : '<span style="width:32px;flex:none"></span>') +
      '</div>';
  };

  APP.tabbar = function (active) {
    var unread = APP.unreadCount();
    return '<nav class="tabbar">' + TABS.map(function (t) {
      return '<a href="' + APP.href(t.href) + '" class="' + (t.k === active ? 'on' : '') + '">' +
        '<span class="ic">' + t.ic + '</span>' + t.t +
        (t.k === 'msg' && unread ? '<span class="badge">' + unread + '</span>' : '') + '</a>';
    }).join('') + '</nav>';
  };

  /* 完整手机壳。opt: {title, back, backTo, right, tab, body, bar, plain, dark, noStatus} */
  APP.shell = function (o) {
    o = o || {};
    var html = '<div class="phone"><div class="notch"></div><div class="screen" id="screen">' +
      (o.noStatus ? '' : APP.statusbar(o.dark)) +
      (o.title === undefined ? '' : APP.appbar(o)) +
      '<div class="content' + (o.pad === false ? '' : ' pad') + (o.tab ? ' pb' : '') + '" id="content">' + (o.body || '') + '</div>' +
      (o.bar || '') +
      (o.tab ? APP.tabbar(o.tab) : '') +
      '<div class="home-ind"></div></div></div>';
    if (o.side !== false) html = APP.sidePanel(o.sideActive) + html;
    return '<div class="stage">' + html + '</div>';
  };

  APP.mount = function (html) { document.body.innerHTML = html; APP.bind(); };

  /* 桌面预览时左侧的页面导航（真机窄屏自动隐藏） */
  APP.PAGES = [
    ['首页 / 发现', 'index.html'],
    ['资产列表 / 搜索', 'asset/list.html'],
    ['资产详情', 'asset/detail.html'],
    ['看样预约', 'asset/inspect.html'],
    ['报名（校验链）', 'trade/signup.html'],
    ['保证金缴纳', 'trade/deposit.html'],
    ['竞价（核心）', 'trade/bidding.html'],
    ['成交结果', 'trade/result.html'],
    ['合同签署', 'trade/contract.html'],
    ['支付', 'trade/pay.html'],
    ['发票管理', 'trade/invoice.html'],
    ['交割进度', 'trade/delivery.html'],
    ['我的', 'mine/index.html'],
    ['我的-认证', 'mine/cert.html'],
    ['参拍资格 / 资格申请', 'mine/access.html'],
    ['我的-竞拍', 'mine/bids.html'],
    ['我的-订单', 'mine/orders.html'],
    ['我的-保证金', 'mine/deposit.html'],
    ['我的-消息', 'mine/messages.html'],
    ['订阅与偏好', 'mine/subscription.html'],
    ['帮助与客服', 'mine/help.html']
  ];
  APP.sidePanel = function (active) {
    return '<aside class="side"><h1>竞买人 APP 原型</h1>' +
      '<p>手机端样式 · 375×812。窄窗口或真机下自动全屏。</p>' +
      APP.PAGES.map(function (p) {
        return '<a href="' + APP.href(p[1]) + '" class="' + (p[0] === active ? 'on' : '') + '">' + X.esc(p[0]) + '</a>';
      }).join('') + '</aside>';
  };

  /* ---------- 2. 交互组件 ---------- */
  function screenEl() { return document.getElementById('screen') || document.body; }

  APP.toast = function (msg, kind, ms) {
    var s = screenEl();
    s.querySelectorAll('.toast').forEach(function (e) { e.remove(); });
    var d = document.createElement('div');
    d.className = 'toast ' + (kind || '');
    d.innerHTML = msg;
    s.appendChild(d);
    setTimeout(function () { d.remove(); }, ms || 2200);
  };

  /* 底部弹出面板。opt: {title, body, foot, onReady} */
  APP.sheet = function (o) {
    var s = screenEl();
    s.querySelectorAll('.mask').forEach(function (e) { e.remove(); });
    var wrap = document.createElement('div');
    wrap.className = 'mask';
    wrap.innerHTML = '<div class="sheet">' +
      '<div class="sh"><h3>' + X.esc(o.title || '') + '</h3><button class="x" data-close="1">×</button></div>' +
      '<div class="sb">' + (o.body || '') + '</div>' +
      (o.foot ? '<div class="sf">' + o.foot + '</div>' : '') + '</div>';
    s.appendChild(wrap);
    wrap.querySelectorAll('[data-close]').forEach(function (b) { b.onclick = function () { wrap.remove(); }; });
    wrap.onclick = function (e) { if (e.target === wrap) wrap.remove(); };
    APP.bindIn(wrap);
    if (typeof o.onReady === 'function') o.onReady(wrap);
    return wrap;
  };

  APP.closeSheets = function () { screenEl().querySelectorAll('.mask').forEach(function (e) { e.remove(); }); };

  /* 居中对话框。opt: {title, body, okText, cancelText, danger, onOk} */
  APP.dialog = function (o) {
    var s = screenEl();
    s.querySelectorAll('.mask').forEach(function (e) { e.remove(); });
    var wrap = document.createElement('div');
    wrap.className = 'mask center';
    wrap.innerHTML = '<div class="dialog">' +
      '<div class="dh">' + X.esc(o.title || '提示') + '</div>' +
      '<div class="db">' + (o.body || '') + '</div>' +
      '<div class="df"><button data-close="1">' + X.esc(o.cancelText || '取消') + '</button>' +
      '<button class="' + (o.danger ? 'danger' : 'pri') + '" data-ok="1">' + X.esc(o.okText || '确定') + '</button></div></div>';
    s.appendChild(wrap);
    wrap.querySelectorAll('[data-close]').forEach(function (b) { b.onclick = function () { wrap.remove(); }; });
    var ok = wrap.querySelector('[data-ok]');
    ok.onclick = function () {
      if (o.onOk && o.onOk(wrap) === false) return;
      wrap.remove();
    };
    return wrap;
  };

  /* 全局点击绑定：data-go（返回/跳转）、data-toast。可在任意作用域内调用 */
  APP.bindIn = function (root) {
    (root || document).querySelectorAll('[data-go]').forEach(function (b) {
      b.onclick = function (e) {
        var t = b.getAttribute('data-go');
        if (t === 'back') { if (history.length > 1) history.back(); else location.href = APP.href('index.html'); return; }
        e.preventDefault();
        APP.closeSheets();
        APP.go(t);
      };
    });
    (root || document).querySelectorAll('[data-toast]').forEach(function (b) {
      b.onclick = function () { APP.toast(X.esc(b.getAttribute('data-toast'))); };
    });
  };
  APP.bind = function () { APP.bindIn(document); };

  /* ---------- 3. APP 侧种子补充（订阅 / 工单 / 看样预约 / 消息） ---------- */
  var APP_SEED_KEY = 'zyypk_app_seed_v1';

  APP.boot = function () {
    global.WB_initDB();
    if (localStorage.getItem(APP_SEED_KEY)) return DB;
    var me = APP.me();
    if (!me) return DB;

    /* 看样预约：2 条（1 条待到访、1 条已到访） */
    var upcoming = DB.all('sessions').filter(function (s) { return s.status === '预告' || s.status === '报名中'; }).slice(0, 2);
    upcoming.forEach(function (ses, i) {
      var a = DB.get('assets', ses.asset_id);
      DB.insert('inspectAppts', {
        appt_id: 'APT-' + String(i + 1).padStart(4, '0'),
        subject_id: me.subject_id, asset_id: ses.asset_id, session_id: ses.session_id,
        slot: X.fmtDate(ses.reg_start) + (i ? ' 14:00-15:30' : ' 10:00-11:30'),
        contact: me.contact_name || '张经理', mobile: me.mobile || '13900001111',
        remark: i ? '需现场查看设备铭牌与运行记录' : '希望查看堆放区全貌与磅单',
        status: i ? '已到访' : '待到访',
        address: a ? (a.location || '处置单位指定堆场') : '处置单位指定堆场',
        create_time: '2026-10-05 10:2' + i
      });
    });

    /* 订阅规则：业务事实统一落在 rules 集合的 rule_type='Subscription' 记录上
       （推荐引擎 RR01 读取的正是它）。后台种子对每个主体只给了 1 条，
       此处按同一数据结构为登录竞买人补 2 条，使「订阅与偏好」页有足够的可下钻样本；
       与后端种子的差别只在于 create_time 标注为 APP 侧创建，不冒充平台预设规则。 */
    var existSub = DB.all('rules').filter(function (r) {
      return r.rule_type === 'Subscription' && r.subject_id === me.subject_id;
    }).length;
    if (existSub < 3) {
      var extra = [
        { cats: ['报废设备', '废旧金属'], regs: [], lo: 0, hi: 20000000, ch: ['站内信', 'APP 推送'] },
        { cats: ['闲置房产'], regs: ['北京市', '天津市'], lo: 5000000, hi: 0, ch: ['APP 推送'] }
      ];
      var mx = 0;
      DB.all('rules').forEach(function (r) {
        var m = /^SUBR-(\d+)$/.exec(r.code || '');
        if (m) mx = Math.max(mx, Number(m[1]));
      });
      extra.forEach(function (s, i) {
        mx += 1;
        DB.insert('rules', {
          rule_type: 'Subscription', code: 'SUBR-' + mx, subject_id: me.subject_id,
          categories: s.cats, regions: s.regs, price_min: s.lo, price_max: s.hi,
          channels: s.ch, match_count: 0, status: '生效', version: 'v1.0',
          create_time: '2026-10-0' + (i + 1) + ' 09:30'
        });
      });
    }
    APP.refreshSubCounts();

    /* 客服工单：2 条 */
    DB.insert('tickets', {
      ticket_id: 'TKT-0001', subject_id: me.subject_id, type: '保证金退还',
      title: '流拍场次保证金退还时间咨询', content: '参与的 SES-0011 流拍，保证金何时解冻？',
      status: '已回复', reply: '未中拍保证金将在竞价结束后 3 个工作日内原路解冻，本场次预计 2026-10-12 前到账。',
      create_time: '2026-10-02 15:20', reply_time: '2026-10-02 17:05'
    });
    DB.insert('tickets', {
      ticket_id: 'TKT-0002', subject_id: me.subject_id, type: '资质变更',
      title: '新增「危化品经营许可证」有效期变更', content: '我司危化品经营许可证已续期，需更新到期日。',
      status: '处理中', reply: '', create_time: '2026-10-07 09:12', reply_time: null
    });

    /* 消息中心：交易 / 提醒 / 公告 / 系统 四类 */
    var msgs = [
      ['交易', '出价已被超越', '您对「废催化剂（含钼镍）一批」的出价已被超越，当前价 ¥8,650,000，请及时出价。', 0, 'asset/detail.html'],
      ['交易', '竞价即将结束', '您报名的场次 SES-0002 将于 30 分钟后结束，请留意出价时机。', 0, 'trade/bidding.html'],
      ['提醒', '保证金缴纳提醒', '报名 REG-0007 的保证金尚未到账，截止时间 2026-10-10 18:00，逾期报名将失效。', 0, 'trade/deposit.html'],
      ['提醒', '资质临期提醒', '您的「危险货物运输许可证」将于 2026-11-05 到期，届时将无法报名该类资产，请及时更新。', 1, 'mine/cert.html'],
      ['公告', '平台规则更新', '《竞价延时规则》v1.2 已发布：延时触发窗口由 60 秒调整为 120 秒，自 2026-10-15 起对新场次生效。', 1, 'mine/help.html'],
      ['系统', '实名认证已通过', '恭喜，您的企业实名认证已通过审核，可正常参与报名与出价。', 1, 'mine/cert.html'],
      ['交易', '合同签署提醒', '订单 ORD-0003 的合同待签署，签署截止 2026-10-12，逾期将触发违约认定。', 0, 'trade/contract.html']
    ];
    msgs.forEach(function (m, i) {
      DB.insert('notifications', {
        notify_id: 'MSG-' + String(DB.all('notifications').length + 1).padStart(4, '0'),
        subject_id: me.subject_id, category: m[0], title: m[1], content: m[2],
        read: m[3] === 1, link: m[4],
        create_time: '2026-10-0' + (9 - (i % 6)) + ' ' + X.pad2(8 + i) + ':' + X.pad2((i * 13) % 60)
      });
    });

    /* 自举一条「竞得 → 成交 → 在途订单」链路，使成交结果 / 合同 / 支付 / 交割 / 发票
       打开即有可下钻数据（详见 APP.demoCreateOrder 的说明）。幂等：已存在则不重复生成。 */
    APP.demoCreateOrder();

    localStorage.setItem(APP_SEED_KEY, '1');
    return DB;
  };

  /* ---------- 4. 当前登录竞买人 ---------- */
  APP.me = function () {
    if (APP._me) return APP._me;
    var saved = localStorage.getItem('zyypk_app_me');
    var me = saved ? DB.get('subjects', saved) : null;
    if (!me) {
      /* 选「既有出价、又有成交订单」的主体作为登录竞买人：
         保证首页推荐、我的竞拍、我的订单、成交/合同/支付/交割各页打开即有可下钻数据。 */
      var bySubject = {};
      DB.all('bids').forEach(function (b) { bySubject[b.subject_id] = (bySubject[b.subject_id] || 0) + 1; });
      var orderOf = {};
      DB.all('orders').forEach(function (o) { orderOf[o.buyer_id] = (orderOf[o.buyer_id] || 0) + 1; });
      var cands = DB.all('subjects').filter(function (s) {
        return s.status !== '已注销' && s.status !== '潜在' && s.status !== '注册';
      });
      var winners = cands.filter(function (s) { return orderOf[s.subject_id]; });
      var pool = winners.length ? winners : cands;
      var best = null, bestN = -1;
      pool.forEach(function (s) {
        var n = (bySubject[s.subject_id] || 0) * 10 + (orderOf[s.subject_id] || 0) * 100;
        if (n > bestN) { bestN = n; best = s; }
      });
      me = best || DB.all('subjects')[0];
      if (me) localStorage.setItem('zyypk_app_me', me.subject_id);
    }
    APP._me = me;
    return me;
  };

  APP.myRegs = function () { var m = APP.me(); return DB.all('bidRegs').filter(function (r) { return r.subject_id === m.subject_id; }); };
  APP.myBids = function () { var m = APP.me(); return DB.all('bids').filter(function (b) { return b.subject_id === m.subject_id; }); };
  APP.myOrders = function () { var m = APP.me(); return DB.all('orders').filter(function (o) { return o.buyer_id === m.subject_id; }); };
  APP.myTxns = function () { var m = APP.me(); return DB.all('depositTxns').filter(function (t) { return t.subject_id === m.subject_id; }); };
  APP.myMsgs = function () { var m = APP.me(); return DB.all('notifications').filter(function (n) { return n.subject_id === m.subject_id; }); };
  /* 订阅：唯一数据源是 rules 集合中 rule_type='Subscription' 的记录。
   这与推荐引擎 RR01（Engine.matchRecommend）读取的是同一批数据 —— 改完即对推荐生效。 */
APP.mySubs = function () {
  var m = APP.me();
  return DB.all('rules').filter(function (r) {
    return r.rule_type === 'Subscription' && r.subject_id === m.subject_id;
  }).sort(function (a, b) { return String(a.code).localeCompare(String(b.code)); });
};

/* 在售资产：未关闭、未成交 */
APP.saleAssets = function () {
  return DB.all('assets').filter(function (a) {
    return a.asset_status !== '已关闭' && a.asset_status !== '已成交';
  });
};

/* 订阅命中资产：按品类 / 区域 / 价格区间实时过滤（命中数不写死） */
APP.matchSubAssets = function (sub) {
  return APP.saleAssets().filter(function (a) {
    var cats = sub.categories || [];
    if (cats.length && cats.indexOf(a.category) < 0) return false;
    var regs = sub.regions || [];
    if (regs.length && regs.indexOf(a.region) < 0) return false;
    if (sub.price_min && a.start_price < sub.price_min) return false;
    if (sub.price_max && a.start_price > sub.price_max) return false;
    return true;
  });
};
APP.subCount = function (sub) { return APP.matchSubAssets(sub).length; };

/* 把命中数回写到规则上（仅当变化时写，避免无谓 persist） */
APP.refreshSubCounts = function () {
  APP.mySubs().forEach(function (s) {
    var n = APP.subCount(s);
    if (Number(s.match_count) !== n) DB.update('rules', s.rule_id, { match_count: n });
  });
};

/* 新建订阅：生成与种子同风格的编号 SUBR-n */
APP.nextSubCode = function () {
  var mx = 0;
  DB.all('rules').forEach(function (r) {
    var m = /^SUBR-(\d+)$/.exec(r.code || '');
    if (m) mx = Math.max(mx, Number(m[1]));
  });
  return 'SUBR-' + (mx + 1);
};
APP.subSave = function (patch, ruleId) {
  var me = APP.me();
  if (ruleId) {
    DB.update('rules', ruleId, patch);
    DB.audit('订阅规则修改', ruleId, 'APP 端修改订阅条件：' + (patch.categories || []).join('/') +
      '｜区域 ' + ((patch.regions || []).join('/') || '不限') +
      '｜价格 ' + APP.priceRange(patch.price_min, patch.price_max), { level: '一般', role: '竞买人' });
    return DB.get('rules', ruleId);
  }
  var rec = DB.insert('rules', {
    rule_type: 'Subscription', code: APP.nextSubCode(), subject_id: me.subject_id,
    categories: patch.categories || [], regions: patch.regions || [],
    price_min: patch.price_min || 0, price_max: patch.price_max || 0,
    channels: patch.channels || [], match_count: 0,
    status: '生效', version: 'v1.0', create_time: '2026-10-09 ' + global.WB.nowHM()
  });
  DB.update('rules', rec.rule_id, { match_count: APP.subCount(rec) });
  DB.audit('订阅规则新增', rec.rule_id, 'APP 端新增订阅规则 ' + rec.code + '：' +
    (patch.categories || []).join('/') + '｜区域 ' + ((patch.regions || []).join('/') || '不限') +
    '｜价格 ' + APP.priceRange(patch.price_min, patch.price_max), { level: '一般', role: '竞买人' });
  return rec;
};
/* 启停 / 退订：rules 不物理删除，只改 status（PRD 全对象禁止物理删除） */
APP.subToggle = function (ruleId) {
  var r = DB.get('rules', ruleId);
  if (!r) return null;
  var next = r.status === '生效' ? '停用' : '生效';
  DB.update('rules', ruleId, { status: next });
  DB.audit(next === '生效' ? '订阅规则启用' : '订阅规则停用', ruleId,
    'APP 端将订阅规则 ' + r.code + ' 置为「' + next + '」', { level: '一般', role: '竞买人' });
  return next;
};
APP.subRetire = function (ruleId) {
  var r = DB.get('rules', ruleId);
  if (!r) return null;
  DB.update('rules', ruleId, { status: '停用', retired: true, retire_time: '2026-10-09 ' + global.WB.nowHM() });
  DB.audit('订阅退订', ruleId, 'APP 端退订（规则置停用并标记 retired，记录保留可追溯）', { level: '一般', role: '竞买人' });
  return DB.get('rules', ruleId);
};
APP.priceRange = function (lo, hi) {
  var a = Number(lo) || 0, b = Number(hi) || 0;
  if (!a && !b) return '不限';
  if (a && !b) return '≥ ¥' + X.w(a) + ' 万';
  if (!a && b) return '< ¥' + X.w(b) + ' 万';
  return '¥' + X.w(a) + ' 万 ~ ¥' + X.w(b) + ' 万';
};
  APP.myTickets = function () { var m = APP.me(); return DB.all('tickets').filter(function (t) { return t.subject_id === m.subject_id; }); };
  APP.myAppts = function () { var m = APP.me(); return DB.all('inspectAppts').filter(function (a) { return a.subject_id === m.subject_id; }); };
  APP.unreadCount = function () { return APP.myMsgs().filter(function (n) { return !n.read; }).length; };

  /* 我的保证金账户：余额 / 冻结 / 已退还 / 已划扣（由流水实时汇总，不写死） */
  APP.depositAccount = function () {
    var t = APP.myTxns(), frozen = 0, refunded = 0, forfeited = 0, paid = 0;
    t.forEach(function (x) {
      var amt = Number(x.amount) || 0;
      if (x.action_type === '缴纳' || x.action_type === '冻结') { paid += amt; frozen += amt; }
      if (x.action_type === '退还') { refunded += amt; frozen -= amt; }
      if (x.action_type === '划扣' || x.action_type === '没收') { forfeited += amt; frozen -= amt; }
    });
    return { frozen: Math.max(0, frozen), refunded: refunded, forfeited: forfeited, paid: paid, count: t.length };
  };

  /* 在途订单（非已完成）：用于 APP 端签约 / 付款 / 交割的可操作演示 */
  APP.inProgressOrders = function () {
    return APP.myOrders().filter(function (o) { return o.status !== '已完成' && o.status !== '已终止'; });
  };
/* 选取要演示的订单：优先在途（待签约/已签约/待付款/已付款），
   其次按创建时间取最近的已完成订单 —— 种子里的历史订单是 2025 年的，
   不排序会让合同/支付/交割/发票页落在一年多前的单据上。 */
APP.pickOrder = function (id) {
  if (id) { var o = DB.get('orders', id); if (o) return o; }
  var ip = APP.inProgressOrders();
  if (ip.length) return ip.slice().sort(function (a, b) { return String(b.create_time).localeCompare(String(a.create_time)); })[0];
  var all = APP.myOrders().slice().sort(function (a, b) { return String(b.create_time).localeCompare(String(a.create_time)); });
  return all[0] || null;
};
  APP.perfOf = function (orderId) {
    return DB.find('performance', function (p) { return p.order_id === orderId; });
  };

  /* ---------- 4.5 参拍资格（租户关系）与报名校验链的补救入口 ---------- */

  /* 当前主体的全部租户关系（含暂停的，便于展示「为什么被拦」） */
  APP.tenantRelationsOf = function () {
    var m = APP.me();
    return DB.all('tenantRelations').filter(function (t) { return t.subject_id === m.subject_id; });
  };

  /* 某资产的单笔额度上限：主体级与租户级取更严者（与校验链第 6 步同一口径）。
     同时回传两级的来源，便于页面说清「到底是谁卡住了」。 */
  APP.limitFor = function (asset) {
    var me = APP.me();
    var tr = DB.find('tenantRelations', function (t) {
      return t.subject_id === me.subject_id && t.disposal_org_id === asset.disposal_org_id &&
        t.category_id === asset.category && t.status === '生效';
    });
    var subject = Number(me.bid_amount_limit) || 0;
    var tenant = tr && tr.amount_limit ? Number(tr.amount_limit) : 0;
    var lim = Math.min(subject || Infinity, tenant || Infinity);
    return { limit: lim, subject: subject, tenant: tenant, tr: tr || null };
  };

  /* 报名校验链「未通过项」→ APP 端可执行的补救入口。
     必须按失败项分别指向对应入口：把 7 步失败统一指向「去补充认证」会让
     租户关系（第 5 步）/ 金额上限（第 6 步）这两类失败变成死路 ——
     认证页只能补资质，根本无法发起资格申请。
     返回 null 表示该失败项在 APP 端没有可自助办理的入口，只说明原因与解除条件。 */
  APP.checkFix = function (c) {
    switch (c && c.n) {
      case 2: return { label: '查看名单与限制范围', href: 'mine/access.html?tab=restrict',
        tip: '禁入名单须由后台风控解除；限制名单按「品类 + 属地」范围拦截，范围外可正常参拍。' };
      case 3: return { label: '查看限制期', href: 'mine/access.html?tab=restrict',
        tip: '限制期到期自动解除，期间不可报名；起止日期与解除依据见「参拍资格」页。' };
      case 4: return { label: '去补充资质', href: 'mine/cert.html',
        tip: '上传该资产要求的专项资质，后台审核通过后即可报名。' };
      case 5: return { label: '去申请参拍资格', href: 'mine/access.html',
        tip: '该「处置单位 × 品类」尚无生效租户关系。发起参拍资格申请，后台准入审核通过后系统自动生成。' };
      case 6: return { label: '去申请提升额度', href: 'mine/access.html?tab=amount',
        tip: '起拍价超过单笔参拍上限（主体级与租户级取更严者）。可申请调整额度，或改选额度范围内的资产。' };
      case 7: return { label: '查看我的报名', href: 'mine/bids.html',
        tip: '同场次同主体仅允许一条有效报名，请勿重复提交。' };
      default: return null;
    }
  };

  /* 我的参拍资格申请单（含历史，按单号倒序） */
  APP.myAccess = function () {
    var m = APP.me();
    return DB.all('accessReviews').filter(function (r) { return r.subject_id === m.subject_id; })
      .sort(function (a, b) { return String(b.access_id).localeCompare(String(a.access_id)); });
  };

  /* 提交参拍资格申请：写 accessReviews（待审）+ 审计留痕。
     三查口径复用 Engine.accessThreeChecks —— 与后台「发起准入审核」完全一致，
     避免同一主体在两端拿到不同的系统建议。 */
  APP.accessApply = function (patch) {
    var me = APP.me();
    var chk = E.accessThreeChecks(me.subject_id);
    var rec = DB.insert('accessReviews', {
      subject_id: me.subject_id,
      apply_type: patch.apply_type || '品类准入',
      apply_categories: patch.apply_categories || [],
      apply_regions: patch.apply_regions || [],
      apply_amount_limit: patch.apply_amount_limit || null,
      bl_hit: chk.bl_hit, bl_hit_detail: chk.bl_hit_detail, qual_check: chk.qual_check,
      init_credit: chk.init_credit, result: chk.result,
      condition: patch.reason ? ('申请理由：' + patch.reason) : '',
      source: 'APP', auditor: '', audit_time: null,
      status: '待审', create_time: global.WB.SERVER_TIME
    });
    DB.audit('参拍资格申请', rec.access_id, '竞买人 ' + me.subject_name + ' 提交' +
      (rec.apply_type === '额度调整'
        ? ('「额度调整」申请（期望单笔 ' + X.w(rec.apply_amount_limit) + ' 万元）')
        : ('「品类准入」申请：品类 ' + (rec.apply_categories.join('、') || '—') +
           '；属地 ' + (rec.apply_regions.join('、') || '不限'))) +
      '；系统建议「' + chk.result + '」，待后台准入审核认定',
      { level: '重要', role: '竞买人' });
    return rec;
  };

  /* 演示辅助：为当前竞买人自举一条完整的「竞得 → 成交 → 在途订单」链路。
     背景（种子数据的两个缺口）：
       ① SUB-0001 的 9 张历史订单 asset_id 全为 null（历史存量订单），且没有一场由本主体竞得的场次
          → APP 端「成交结果 / 合同 / 支付 / 交割 / 发票」打开后看不到可操作链路；
       ② 本主体的历史订单全部已完成 → 没有在途单据可演示签约 → 付款 → 交割。
     做法：取一个「我报名了、但最终流拍且无成交人」的已结束场次（SES-0011），
     按引擎公式真实补齐 中标出价 → Deal → 场次成交 → Order → Performance → 保证金冻结流水，
     全程写入真实业务对象与审计。界面上明确标注「原型自举」，不冒充平台真实成交记录。 */
  APP.demoCreateOrder = function () {
    var me = APP.me();
    var exist = DB.find('orders', function (o) { return o.buyer_id === me.subject_id && String(o.order_no).indexOf('DEMO') === 0; });
    if (exist) return exist;

    /* 选场次：我报名 + 已结束/已归档 + 尚无成交人 */
    var reg = APP.myRegs().filter(function (r) {
      var s = DB.get('sessions', r.session_id);
      return s && (s.status === '已结束' || s.status === '已归档') && !s.deal_subject;
    })[0];
    var ses = reg ? DB.get('sessions', reg.session_id) : null;
    if (!ses) return null;
    var asset = DB.get('assets', ses.asset_id);
    if (!asset) return null;

    var bidEnd = ses.bid_end;
    var price = Math.round(ses.start_price * 1.06 / 1000) * 1000;   /* 溢价 6% 竞得 */
    var seq = DB.all('bids').filter(function (b) { return b.session_id === ses.session_id; }).length + 1;

    /* ① 中标出价（追加型数据，只增不改） */
    DB.insert('bids', {
      bid_id: 'BID-' + String(DB.all('bids').length + 1).padStart(5, '0'),
      session_id: ses.session_id, subject_id: me.subject_id, bid_amount: price, bid_seq: seq,
      bid_time: bidEnd, ip: '10.66.200.7',
      device_fp: 'FP-APP-' + U.hash(me.subject_id).toString(16).slice(0, 8),
      is_valid: true, is_top: true,
      sign: 'SHA256:' + U.hash(ses.session_id + me.subject_id + price + seq).toString(16),
      create_time: bidEnd
    });
    DB.insert('interests', {
      fact_id: 'FCT-' + String(DB.all('interests').length + 1).padStart(4, '0'),
      subject_id: me.subject_id, act_type: '成交', asset_id: asset.asset_id,
      category: asset.category, act_time: String(bidEnd).slice(0, 10), weight: 15, is_valid: true, create_time: bidEnd
    });

    /* ② 成交（Deal）+ 场次转「已归档 · 成交」+ 资产转「成交」 */
    var dealId = 'DEAL-' + String(DB.all('deals').length + 1).padStart(4, '0');
    DB.insert('deals', {
      deal_id: dealId, session_id: ses.session_id, asset_id: asset.asset_id,
      buyer_id: me.subject_id, deal_price: price, deal_time: bidEnd,
      confirm_file: '成交确认书-' + ses.session_id + '.pdf', status: '已转履约', create_time: bidEnd
    });
    DB.update('sessions', ses.session_id, {
      deal_price: price, deal_subject: me.subject_id, top_bidder: me.subject_id,
      meet_reserve: true, status: '已归档', bid_count: seq, current_price: price
    });
    DB.update('assets', asset.asset_id, { asset_status: '成交' });

    /* ③ 订单 + 履约 + 保证金抵扣流水 */
    var idx = DB.all('orders').length + 1;
    var oid = 'ORD-' + String(idx).padStart(4, '0');
    var dep = E.depositAmount(me, price);
    var order = DB.insert('orders', {
      order_id: oid,
      order_no: 'DEMO' + String(bidEnd).slice(0, 10).replace(/-/g, '') + String(idx).padStart(6, '0'),
      deal_id: dealId, asset_id: asset.asset_id, buyer_id: me.subject_id,
      category: asset.category, deal_price: price,
      tax_rate: asset.category === '成品油' ? 0.13 : 0.06,
      deposit_offset: dep, total_amount: 0, status: '待签约', create_time: bidEnd
    });
    order.total_amount = E.payable(order).total;
    DB.update('orders', oid, { total_amount: order.total_amount });
    DB.insert('performance', {
      perf_id: 'PERF-' + String(DB.all('performance').length + 1).padStart(4, '0'),
      order_id: oid, subject_id: me.subject_id, payable_amount: order.total_amount,
      sign_deadline: U.planDate(bidEnd, '天', 2) + ' 23:59',
      pay_deadline: U.planDate(bidEnd, '天', 7) + ' 23:59',
      pickup_deadline: U.planDate(bidEnd, '天', 30) + ' 23:59',
      pay_time: null, overdue_days: 0, node_status: {}, status: '待签约', is_overdue: false,
      create_time: bidEnd
    });
    DB.insert('depositTxns', {
      txn_id: 'TXN-' + String(DB.all('depositTxns').length + 1).padStart(4, '0'),
      subject_id: me.subject_id, reg_id: reg.reg_id, order_id: oid,
      action_type: '冻结', amount: dep, breach_id: null, channel: '银企直连',
      trade_no: 'BANK' + U.hash(oid).toString().slice(0, 12), status: '成功',
      occur_time: bidEnd, create_time: bidEnd
    });
    DB.audit('原型自举', oid, 'APP 原型自举：为 ' + me.subject_name + ' 补齐「竞得 ' + ses.session_id +
      '（' + asset.asset_name + '）→ 成交 ' + dealId + ' → 在途订单 ' + oid +
      '」链路，用于演示成交结果 / 合同 / 支付 / 交割。背景：本主体历史订单均为无线上资产的历史存量单，且在途单据为空。',
      { level: '一般', role: '系统' });
    return DB.get('orders', oid);
  };

  /* ---------- 5. 通用页面片段 ---------- */
  APP.tag = function (t, cls) { return '<span class="tag ' + (cls || '') + '">' + X.esc(t) + '</span>'; };

  /* 场次状态 → 标签样式 */
  APP.sesTag = function (st) {
    var m = { 预告: 'warn', 报名中: 'info', 报名截止: 'info', 竞拍中: 'pri', 已结束: '', 已归档: '', 已终止: 'danger' };
    return APP.tag(st, m[st] === undefined ? '' : m[st]);
  };
  APP.assetStTag = function (st) {
    var m = { 已发布: 'ok', 已上架: 'ok', 竞拍中: 'pri', 已成交: 'pri', 流拍: 'warn', 已关闭: '', 草稿: '' };
    return APP.tag(st, m[st] === undefined ? '' : m[st]);
  };

  APP.kvRows = function (pairs) {
    return pairs.map(function (p) {
      if (!p) return '';
      return '<div class="kv-row"><div class="k">' + X.esc(p[0]) + '</div><div class="v ' + (p[2] || '') + '">' + p[1] + '</div></div>';
    }).join('');
  };

  APP.card = function (title, body, sub) {
    return '<div class="card"><div class="ch"><h3>' + X.esc(title) + '</h3>' +
      (sub ? '<span class="sub">' + sub + '</span>' : '') + '</div><div class="cb">' + body + '</div></div>';
  };

  /* 资产占位图（按品类给不同图标与底色，避免使用外链图片） */
  var CAT_ICON = {
    '成品油': '🛢️', '危化品': '☣️', '废旧物资': '📦', '报废设备': '⚙️', '闲置房产': '🏢',
    '车辆': '🚚', '产能指标': '📈', '股权债权': '📜', '废旧金属': '🔩', '催化剂': '🧪'
  };
  APP.catIcon = function (c) { return CAT_ICON[c] || '📦'; };

  /* 找一条「当前可演示」的场次：优先竞拍中，其次报名中，再次已结束 */
  APP.pickSession = function (filterFn) {
    var all = DB.all('sessions').filter(filterFn || function () { return true; });
    var order = { 竞拍中: 0, 报名中: 1, 报名截止: 2, 预告: 3, 已结束: 4, 已归档: 5, 已终止: 6 };
    return all.slice().sort(function (a, b) {
      var d = (order[a.status] === undefined ? 9 : order[a.status]) - (order[b.status] === undefined ? 9 : order[b.status]);
      if (d) return d;
      return String(b.session_id).localeCompare(String(a.session_id));
    })[0] || null;
  };

  /* 竞价页的「服务端时间」：若目标场次已结束，回拨到 bid_end 前 8 分钟，使倒计时可演示 */
  APP.serverNowFor = function (ses) {
    var now = new Date(APP.SERVER_TIME.getTime());
    if (!ses) return now;
    var end = U.asDate(ses.bid_end);
    if (end && end.getTime() < now.getTime()) {
      return new Date(end.getTime() - 8 * 60 * 1000);
    }
    return now;
  };

})(window);
