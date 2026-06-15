/*!
 * Demski Group Chatbot Widget
 * Standalone, embeddable chat widget. Self-contained: injects its own
 * styles, DOM, and logic. Safe to load on any site via <script src>.
 */
(function () {
  'use strict';

  if (window.__demskiChatbotLoaded) return;
  window.__demskiChatbotLoaded = true;

  /* ── CONFIG ── */
  var SCRIPT_EL = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  function scriptAttr(name, fallback) {
    var v = SCRIPT_EL && SCRIPT_EL.getAttribute(name);
    return v !== null && v !== undefined && v !== '' ? v : fallback;
  }

  // Base URL this script was loaded from (used to resolve relative assets)
  var BASE_URL = (function () {
    try {
      return new URL(SCRIPT_EL.src, location.href).href.replace(/\/[^/]*$/, '/');
    } catch (e) {
      return './';
    }
  })();

  var AVATAR_URL    = scriptAttr('data-avatar', BASE_URL + 'avatar-erin.webp');
  var AVATAR_FB     = scriptAttr('data-avatar-fallback', AVATAR_URL);
  var CALENDLY_URL  = scriptAttr('data-calendly', 'https://calendly.com/shreya-ethixweb/30min');
  var EJS_KEY       = scriptAttr('data-ejs-key', 'nedYqWwwPWVZZVX0_');
  var EJS_SVC       = scriptAttr('data-ejs-service', 'service_f4tf0yn');
  var EJS_LEAD_TPL  = scriptAttr('data-ejs-lead-template', 'template_c6hi8ir');
  var EJS_CONF_TPL  = scriptAttr('data-ejs-confirm-template', 'template_7kz7hgj');
  var BOT_NAME      = scriptAttr('data-bot-name', 'Erin');
  var BOT_TITLE     = scriptAttr('data-bot-title', 'The Demski Group');

  /* ── CONSTANTS ── */
  var IDLE_MSG_ID  = 'cb-idle-msg';
  var IDLE_BTNS_ID = 'cb-idle-btns';

  var AV_STYLE =
    'width:28px!important;height:28px!important;min-width:28px!important;' +
    'max-width:28px!important;border-radius:50%!important;object-fit:cover!important;' +
    'flex-shrink:0!important;display:block!important;border:2px solid #fff!important;align-self:flex-end;';
  var WRAP_STYLE =
    'display:flex!important;align-items:flex-end!important;gap:8px!important;max-width:88%!important;';
  var BOT_STYLE =
    'background:rgba(255,255,255,0.88)!important;padding:10px 14px!important;' +
    'border-radius:4px 18px 18px 18px!important;font-size:13.5px!important;' +
    'color:#1e2024!important;line-height:1.65!important;' +
    'box-shadow:0 2px 8px rgba(0,0,0,0.06)!important;flex:1!important;' +
    'display:block!important;word-break:break-word!important;';
  var USER_STYLE =
    'background:linear-gradient(135deg,#0154B1,#1a7fe8)!important;' +
    'color:#fff!important;padding:10px 16px!important;' +
    'border-radius:18px 18px 4px 18px!important;align-self:flex-end!important;' +
    'max-width:76%!important;font-size:13.5px!important;line-height:1.55!important;' +
    'box-shadow:0 4px 14px rgba(1,84,177,0.25)!important;display:block!important;word-break:break-word!important;';

  /* ── STATE ── */
  var step = 0;
  var expanded = false;
  var idleTimer = null;
  var idleInterval = 60000;
  var awaitingIdleResponse = false;

  /* ── UTM CAPTURE ── */
  var urlP = {}, saved = {};
  try { saved = JSON.parse(localStorage.getItem('cb_utm') || '{}'); } catch (e) {}
  try { new URL(location.href).searchParams.forEach(function (v, k) { urlP[k] = v; }); } catch (e) {}
  var fp = Object.assign({}, saved, urlP);
  try { localStorage.setItem('cb_utm', JSON.stringify(fp)); } catch (e) {}

  var lead = {
    page: location.href, page_name: document.title,
    utm_source: fp.utm_source || '', utm_campaign: fp.utm_campaign || '',
    utm_medium: fp.utm_medium || '', utm_term: fp.utm_term || '',
    utm_content: fp.utm_content || '', gclid: fp.gclid || '',
    intent: '', intent_detail: '', timeline: '', budget: '',
    name: '', phone: '', email: '', cta_choice: ''
  };

  /* ── FOLLOW-UP MAP ── */
  var intentFollowUp = {
    'New startup or app idea':   'Love it! Tell me more. What kind of app are you thinking about?',
    'Software for my business':  'Great! What problem are you trying to solve in your business?',
    'Digital marketing help':    'Nice! What are you hoping to improve: traffic, leads, or sales?',
    'Just exploring':            "That's totally fine! Are you researching for a future project, or just browsing ideas?"
  };
  var intentOptions = {
    'New startup or app idea':   ['Mobile App', 'Web App', 'SaaS Platform', 'eCommerce', 'Other'],
    'Software for my business':  ['Automate Workflows', 'Customer Management', 'Reporting & Analytics', 'Employee Tools', 'Other'],
    'Digital marketing help':    ['Increase Website Traffic', 'Generate More Leads', 'Social Media Growth', 'Paid Advertising', 'Other'],
    'Just exploring':            ['Planning a Future Project', 'Comparing Vendors', 'Learning About Tech', 'Just Curious']
  };
  var offTopicKw = ['price', 'pricing', 'cost', 'how much', 'what do you', 'who are you', 'services', 'what is', 'can you', 'help', 'support', 'contact', 'discount', 'trial'];

  /* ── STYLES ── */
  var CSS = ''
    + '#bot-launcher{position:fixed;bottom:32px;right:32px;width:98px;height:98px;border-radius:50%;cursor:pointer;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:transparent;opacity:0;transform:translateY(60px) scale(0.7);transition:opacity .45s ease,transform .45s cubic-bezier(.34,1.56,.64,1);font-family:"Outfit",sans-serif;}'
    + '#bot-launcher.cb-launcher-visible{opacity:1;transform:translateY(0) scale(1);}'
    + '#bot-launcher::before{content:"";position:absolute;inset:-3px;border-radius:50%;background:linear-gradient(135deg,#0154B1,#4facfe,#0154B1);z-index:-1;animation:cb-ring-spin 4s linear infinite;}'
    + '@keyframes cb-ring-spin{to{transform:rotate(360deg);}}'
    + '#bot-launcher img{width:92px;height:92px;border-radius:50%;object-fit:cover;border:3px solid #fff;box-shadow:0 6px 24px rgba(1,84,177,0.28);transition:transform .3s ease;}'
    + '#bot-launcher:hover img{transform:scale(1.06);}'
    + '.cb-online-dot{position:absolute;bottom:4px;right:4px;width:14px;height:14px;background:#22c55e;border-radius:50%;border:2.5px solid #fff;box-shadow:0 0 0 2px rgba(34,197,94,0.25);}'
    + '.cb-launcher-badge{position:absolute;top:2px;right:2px;width:22px;height:22px;background:#e53e3e;color:#fff;border-radius:50%;border:2px solid #fff;font-size:12px;font-weight:700;font-family:"Outfit",sans-serif;display:none;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(229,62,62,0.5);animation:cb-badge-pop .3s cubic-bezier(.34,1.56,.64,1) both;}'
    + '.cb-launcher-badge.cb-badge-on{display:flex!important;}'
    + '@keyframes cb-badge-pop{from{transform:scale(0);}to{transform:scale(1);}}'
    + '#cb-greeting-bubble{position:fixed;bottom:110px;right:100px;z-index:2147483646;background:#fff;border-radius:16px 16px 4px 16px;box-shadow:0 12px 40px rgba(0,0,0,0.13);padding:14px 16px 12px;max-width:220px;font-family:"Outfit",sans-serif;opacity:0;transform:translateY(10px) scale(.94);transition:opacity .3s,transform .3s;pointer-events:none;}'
    + '#cb-greeting-bubble.cb-bv{opacity:1;transform:none;pointer-events:all;}'
    + '#cb-greeting-bubble.cb-bh{opacity:0;transform:translateY(10px) scale(.94);pointer-events:none;}'
    + '#cb-greeting-bubble p{font-size:13px;color:#333;margin:0 0 10px;line-height:1.5;padding-right:14px;}'
    + '#cb-greeting-bubble button{background:#0154B1;color:#fff;border:none;padding:8px 14px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;width:100%;font-family:"Outfit",sans-serif;transition:background .2s;}'
    + '#cb-greeting-bubble button:hover{background:#0146a0;}'
    + '.cb-bubble-close{position:absolute;top:8px;right:10px;font-size:16px;color:#ccc;cursor:pointer;line-height:1;}'
    + '.cb-bubble-close:hover{color:#666;}'
    + '#lead-bot{position:fixed;bottom:108px;right:28px;z-index:2147483646;animation:cb-pop-in .35s cubic-bezier(.34,1.56,.64,1) both;}'
    + '@keyframes cb-pop-in{from{opacity:0;transform:translateY(20px) scale(.96);}to{opacity:1;transform:none;}}'
    + '.cb-card{width:370px;border-radius:22px;overflow:hidden;background:linear-gradient(160deg,rgba(255,255,255,.82) 0%,rgba(235,244,255,.88) 100%);backdrop-filter:blur(20px) saturate(1.6);-webkit-backdrop-filter:blur(20px) saturate(1.6);box-shadow:0 32px 80px rgba(0,0,0,0.16),0 6px 20px rgba(1,84,177,0.10),inset 0 1px 0 rgba(255,255,255,0.9);display:flex;flex-direction:column;max-height:calc(100vh - 160px);font-family:"Outfit",sans-serif;border:1px solid rgba(255,255,255,.6);box-sizing:border-box;}'
    + '.cb-card *{box-sizing:border-box;}'
    + '.cb-header{background:linear-gradient(135deg,#0154B1 0%,#1a7fe8 100%);padding:14px 16px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;}'
    + '.cb-user{display:flex;gap:11px;align-items:center;}'
    + '.cb-avatar-wrap{position:relative;flex-shrink:0;}'
    + '.cb-avatar-wrap img{width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,.5);display:block;}'
    + '.cb-hdr-dot{position:absolute;bottom:1px;right:1px;width:10px;height:10px;background:#22c55e;border-radius:50%;border:2px solid #0154B1;}'
    + '.cb-ch-name{font-weight:700;color:#fff;font-size:14px;letter-spacing:.1px;}'
    + '.cb-ch-status{font-size:11px;color:rgba(255,255,255,.75);margin-top:2px;font-weight:400;display:flex;align-items:center;gap:4px;}'
    + '.cb-ch-status::before{content:"";display:inline-block;width:6px;height:6px;background:#22c55e;border-radius:50%;}'
    + '.cb-close-btn{cursor:pointer;font-size:20px;color:rgba(255,255,255,.7);line-height:1;width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background .15s,color .15s;user-select:none;border:none;background:transparent;padding:0;flex-shrink:0;}'
    + '.cb-close-btn:hover{background:rgba(255,255,255,.15);color:#fff;}'
    + '#cb-top-section{display:none;background:linear-gradient(135deg,#0154B1 0%,#1a7fe8 100%);flex-shrink:0;}'
    + '.cb-top-row{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;}'
    + '#cb-welcome{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 24px 28px;background:transparent;flex:1;text-align:center;}'
    + '.cb-welcome-av-wrap{position:relative;display:inline-block;margin-bottom:14px;}'
    + '.cb-welcome-av{width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid #fff;box-shadow:0 0 0 3px #0154B1,0 8px 28px rgba(1,84,177,.18);}'
    + '.cb-welcome-dot{position:absolute;bottom:4px;right:4px;width:14px;height:14px;background:#22c55e;border-radius:50%;border:2.5px solid #fff;}'
    + '.cb-welcome-name{font-size:18px;font-weight:700;color:#111;margin-bottom:4px;}'
    + '.cb-welcome-role{font-size:12px;color:#888;margin-bottom:20px;}'
    + '.cb-welcome-fine{font-size:10.5px;color:#bbb;text-align:center;margin-top:10px;line-height:1.5;}'
    + '.cb-body-hidden{display:none!important;}'
    + '.cb-body{flex:1;overflow-y:auto!important;overflow-x:hidden!important;display:flex!important;flex-direction:column!important;gap:8px!important;padding:16px 14px 10px!important;min-height:120px!important;max-height:400px!important;background:rgba(214,230,255,0.25)!important;scrollbar-width:thin;scrollbar-color:#dde1e9 transparent;}'
    + '.cb-body::-webkit-scrollbar{width:4px;}'
    + '.cb-body::-webkit-scrollbar-thumb{background:#dde1e9;border-radius:4px;}'
    + '@keyframes cb-msg-in{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}'
    + '.cb-bot-msg-wrap{display:flex!important;align-items:flex-end!important;gap:8px!important;max-width:88%!important;animation:cb-msg-in .25s ease both;}'
    + '.cb-bot-msg-wrap img{width:28px!important;height:28px!important;min-width:28px!important;max-width:28px!important;border-radius:50%!important;object-fit:cover!important;flex-shrink:0!important;border:2px solid #fff!important;display:block!important;align-self:flex-end!important;}'
    + '.cb-bot-msg{background:rgba(255,255,255,.88)!important;padding:10px 14px!important;border-radius:4px 18px 18px 18px!important;font-size:13.5px!important;color:#1e2024!important;line-height:1.65!important;box-shadow:0 2px 8px rgba(0,0,0,.06)!important;word-break:break-word!important;animation:cb-msg-in .25s ease both;}'
    + '.cb-user-msg{background:linear-gradient(135deg,#0154B1,#1a7fe8)!important;color:#fff!important;padding:10px 16px!important;border-radius:18px 18px 4px 18px!important;align-self:flex-end!important;max-width:76%!important;font-size:13.5px!important;line-height:1.55!important;box-shadow:0 4px 14px rgba(1,84,177,.25)!important;display:block!important;word-break:break-word!important;animation:cb-msg-in .25s ease both;}'
    + '.cb-typing-wrap{display:flex!important;align-items:flex-end!important;gap:8px!important;max-width:88%!important;animation:cb-msg-in .2s ease both;}'
    + '.cb-typing-wrap img{width:28px!important;height:28px!important;min-width:28px!important;border-radius:50%!important;object-fit:cover!important;flex-shrink:0!important;border:2px solid #fff!important;display:block!important;align-self:flex-end!important;}'
    + '.cb-typing{display:flex;gap:5px;padding:12px 16px;align-items:center;background:rgba(255,255,255,.88);border-radius:4px 18px 18px 18px;box-shadow:0 2px 8px rgba(0,0,0,.06);}'
    + '.cb-typing span{width:7px;height:7px;background:#b0b8c8;border-radius:50%;animation:cb-blink 1.3s ease-in-out infinite;}'
    + '.cb-typing span:nth-child(2){animation-delay:.18s;}'
    + '.cb-typing span:nth-child(3){animation-delay:.36s;}'
    + '@keyframes cb-blink{0%,80%,100%{opacity:.3;transform:scale(.75);}40%{opacity:1;transform:scale(1);}}'
    + '.cb-qbtns,.cb-bbtns{display:flex!important;flex-direction:column!important;flex-wrap:nowrap!important;gap:7px!important;align-items:stretch!important;width:90%!important;margin-left:auto!important;margin-right:0!important;animation:cb-msg-in .3s ease both;}'
    + '.cb-grid{display:grid!important;grid-template-columns:1fr 1fr!important;grid-auto-rows:minmax(44px,1fr)!important;align-items:stretch!important;}'
    + '.cb-qbtns button,.cb-bbtns button{background:rgba(255,255,255,.88)!important;color:#0154B1!important;border:1.5px solid #d4e4f7!important;padding:7px 12px!important;border-radius:8px!important;cursor:pointer!important;font-size:13px!important;font-family:"Outfit",sans-serif!important;font-weight:500!important;display:flex!important;align-items:center!important;justify-content:center!important;text-align:center!important;width:100%!important;height:100%!important;min-height:44px!important;transition:all .18s!important;line-height:1.3!important;box-sizing:border-box!important;box-shadow:0 1px 4px rgba(0,0,0,.05)!important;}'
    + '.cb-qbtns button:hover,.cb-bbtns button:hover{background:#0154B1!important;color:#fff!important;border-color:#0154B1!important;box-shadow:0 4px 14px rgba(1,84,177,.22)!important;transform:translateY(-1px)!important;}'
    + '.cb-back-btn{background:rgba(255,255,255,.88)!important;color:#0154B1!important;border:1.5px solid #d4e4f7!important;padding:7px 12px!important;border-radius:8px!important;cursor:pointer!important;font-size:13px!important;font-family:"Outfit",sans-serif!important;font-weight:500!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;width:100%!important;height:100%!important;min-height:44px!important;transition:all .18s!important;line-height:1.3!important;box-sizing:border-box!important;}'
    + '.cb-back-btn:hover{background:#0154B1!important;color:#fff!important;border-color:#0154B1!important;box-shadow:0 4px 14px rgba(1,84,177,.22)!important;transform:translateY(-1px)!important;}'
    + '.cb-cta-btns{display:flex;flex-direction:column;gap:8px;animation:cb-msg-in .3s ease both;}'
    + '.cb-cta-btns button{border:none;padding:12px 16px;border-radius:14px;cursor:pointer;font-size:13.5px;font-weight:600;font-family:"Outfit",sans-serif;transition:all .2s;width:100%;text-align:center;}'
    + '.cb-cta-primary{background:linear-gradient(135deg,#F09300,#f5a623);color:#fff;box-shadow:0 4px 14px rgba(240,147,0,.35);}'
    + '.cb-cta-primary:hover{filter:brightness(.93);transform:translateY(-1px);}'
    + '.cb-cta-secondary{background:#f0f6ff;color:#0154B1;border:1.5px solid #cce0f5;}'
    + '.cb-cta-secondary:hover{background:#0154B1;color:#fff;border-color:#0154B1;}'
    + '.cb-input-bar{display:none;align-items:center;gap:8px;padding:10px 12px;border-top:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.45);flex-shrink:0;}'
    + '.cb-input-bar input{flex:1;border:1.5px solid rgba(255,255,255,.5);outline:none;border-radius:24px;padding:10px 16px;font-family:"Outfit",sans-serif;font-size:13.5px;color:#111827;background:rgba(255,255,255,.82);transition:border-color .2s,box-shadow .2s;}'
    + '.cb-input-bar input:focus{border-color:#0154B1;background:rgba(255,255,255,.95);box-shadow:0 0 0 3px rgba(1,84,177,.1);}'
    + '.cb-input-bar input::placeholder{color:#aab0bc;}'
    + '.cb-input-bar button{width:38px!important;height:38px!important;min-width:38px!important;min-height:38px!important;border-radius:50%!important;background:linear-gradient(135deg,#0154B1,#1a7fe8)!important;color:#fff!important;border:none!important;cursor:pointer!important;display:flex!important;align-items:center!important;justify-content:center!important;flex-shrink:0!important;transition:all .2s;box-shadow:0 3px 10px rgba(1,84,177,.32)!important;opacity:1!important;visibility:visible!important;overflow:visible!important;padding:0!important;}'
    + '.cb-input-bar button:hover{transform:scale(1.08);}'
    + '.cb-input-bar button:active{transform:scale(.95);}'
    + '#cb-send svg{display:block!important;width:16px!important;height:16px!important;min-width:16px!important;min-height:16px!important;flex-shrink:0!important;opacity:1!important;visibility:visible!important;overflow:visible!important;fill:none!important;stroke:#fff!important;stroke-width:2.5!important;pointer-events:none!important;}'
    + '#cb-send svg *{stroke:#fff!important;fill:none!important;opacity:1!important;visibility:visible!important;display:inline!important;}'
    /* High-specificity, widget-scoped overrides: guarantee the send button
       and its arrow icon survive any host theme CSS (WordPress, Elementor,
       Divi, custom themes), regardless of how that CSS targets buttons/svgs. */
    + '#lead-bot #cb-input-bar#cb-input-bar button#cb-send{width:38px!important;height:38px!important;min-width:38px!important;min-height:38px!important;border-radius:50%!important;background:linear-gradient(135deg,#0154B1,#1a7fe8)!important;border:none!important;display:flex!important;align-items:center!important;justify-content:center!important;opacity:1!important;visibility:visible!important;overflow:visible!important;color:#fff!important;}'
    + '#lead-bot #cb-input-bar#cb-input-bar button#cb-send svg#cb-send-icon{display:block!important;width:16px!important;height:16px!important;min-width:16px!important;min-height:16px!important;fill:none!important;stroke:#ffffff!important;stroke-width:2.5!important;opacity:1!important;visibility:visible!important;overflow:visible!important;color:#ffffff!important;}'
    + '#lead-bot #cb-input-bar#cb-input-bar button#cb-send svg#cb-send-icon *{stroke:#ffffff!important;fill:none!important;opacity:1!important;visibility:visible!important;display:inline!important;}'
    + '.cb-schedule{display:none;text-align:center;background:linear-gradient(135deg,#F09300,#f5a623);color:#fff!important;font-weight:700;font-size:13.5px;font-family:"Outfit",sans-serif;text-decoration:none!important;padding:13px;letter-spacing:.2px;transition:filter .2s;flex-shrink:0;}'
    + '.cb-schedule:hover{filter:brightness(.92);}'
    + '@media (max-width:480px){#lead-bot{bottom:0;right:0;left:0;width:100%;animation:none;}.cb-card{width:100%;border-radius:24px 24px 0 0;max-height:88vh;overflow:hidden;border:none;}.cb-body{max-height:42vh!important;}.cb-qbtns button,.cb-bbtns button{font-size:12px!important;padding:9px 10px!important;}.cb-input-bar input{font-size:13px;box-sizing:border-box;}#cb-greeting-bubble{right:8px;bottom:100px;max-width:calc(100vw - 80px);}#bot-launcher{bottom:16px;right:16px;width:60px;height:60px;}#bot-launcher img{width:54px;height:54px;}.cb-online-dot{bottom:2px;right:2px;width:12px;height:12px;}}';

  function injectStyles() {
    // Load Outfit font (no-op if already present)
    if (!document.getElementById('cb-font-link')) {
      var link = document.createElement('link');
      link.id = 'cb-font-link';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap';
      document.head.appendChild(link);
    }
    var style = document.createElement('style');
    style.id = 'cb-widget-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  /* ── DOM BUILD ── */
  function buildDOM() {
    // Launcher
    var launcher = document.createElement('div');
    launcher.id = 'bot-launcher';
    launcher.style.display = 'none';
    launcher.innerHTML =
      '<img src="' + AVATAR_URL + '" alt="' + BOT_NAME + '" onerror="this.src=\'' + AVATAR_FB + '\'" />' +
      '<span class="cb-online-dot"></span>' +
      '<span class="cb-launcher-badge" id="cb-launcher-badge">1</span>';
    document.body.appendChild(launcher);

    // Chat window
    var win = document.createElement('div');
    win.id = 'lead-bot';
    win.style.display = 'none';
    win.innerHTML =
      '<div class="cb-card">' +
        '<div class="cb-header" id="cb-header">' +
          '<div class="cb-user">' +
            '<div class="cb-avatar-wrap">' +
              '<img src="' + AVATAR_URL + '" alt="' + BOT_NAME + '" onerror="this.src=\'' + AVATAR_FB + '\'" />' +
              '<span class="cb-hdr-dot"></span>' +
            '</div>' +
            '<div><div class="cb-ch-name">' + BOT_NAME + '</div><div class="cb-ch-status">' + BOT_TITLE + '</div></div>' +
          '</div>' +
          '<button class="cb-close-btn" id="cb-close-compact" aria-label="Close chat">&#x00D7;</button>' +
        '</div>' +
        '<div id="cb-top-section">' +
          '<div class="cb-top-row">' +
            '<div class="cb-user">' +
              '<div class="cb-avatar-wrap">' +
                '<img src="' + AVATAR_URL + '" alt="' + BOT_NAME + '" onerror="this.src=\'' + AVATAR_FB + '\'" />' +
                '<span class="cb-hdr-dot"></span>' +
              '</div>' +
              '<div><div class="cb-ch-name">' + BOT_NAME + '</div><div class="cb-ch-status">' + BOT_TITLE + '</div></div>' +
            '</div>' +
            '<button class="cb-close-btn" id="cb-close-expanded" aria-label="Close chat">&#x00D7;</button>' +
          '</div>' +
        '</div>' +
        '<div id="cb-welcome">' +
          '<div class="cb-welcome-av-wrap">' +
            '<img src="' + AVATAR_URL + '" alt="' + BOT_NAME + '" class="cb-welcome-av" onerror="this.src=\'' + AVATAR_FB + '\'" />' +
            '<span class="cb-welcome-dot"></span>' +
          '</div>' +
          '<div class="cb-welcome-name">' + BOT_NAME + '</div>' +
          '<div class="cb-welcome-role">Customer Success &middot; ' + BOT_TITLE + '</div>' +
          '<p class="cb-welcome-fine">By using this chat, you agree to our terms and privacy policy.</p>' +
        '</div>' +
        '<div id="cb-messages" class="cb-body cb-body-hidden">' +
          '<div style="display:flex!important;align-items:flex-end!important;gap:8px!important;max-width:88%!important;">' +
            '<img src="' + AVATAR_URL + '" style="' + AV_STYLE + '" alt="" onerror="this.style.display=\'none\'" />' +
            '<div class="cb-bot-msg" style="flex:1!important;">Hi there! &#x1F44B; What brings you here today?</div>' +
          '</div>' +
          '<div id="cb-step1" class="cb-qbtns cb-grid">' +
            '<button data-step1="New startup or app idea">New startup or app idea</button>' +
            '<button data-step1="Software for my business">Software for my business</button>' +
            '<button data-step1="Digital marketing help">Digital marketing help</button>' +
            '<button data-step1="Just exploring">Just exploring</button>' +
          '</div>' +
        '</div>' +
        '<div class="cb-input-bar" id="cb-input-bar" style="display:none!important;">' +
          '<input type="text" id="cb-input" placeholder="Type here..." autocomplete="off" />' +
          '<button id="cb-send" aria-label="Send" style="opacity:1!important;visibility:visible!important;">' +
            '<svg id="cb-send-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block!important;opacity:1!important;visibility:visible!important;">' +
              '<line x1="12" y1="19" x2="12" y2="5" style="stroke:#fff!important;opacity:1!important;"/><polyline points="5 12 12 5 19 12" style="stroke:#fff!important;opacity:1!important;"/>' +
            '</svg>' +
          '</button>' +
        '</div>' +
        '<a href="' + CALENDLY_URL + '" target="_blank" rel="noopener" class="cb-schedule" id="cb-schedule-bar" style="display:none!important;">Schedule a Free Consultation</a>' +
      '</div>';
    document.body.appendChild(win);

    return { launcher: launcher, win: win };
  }

  /* ── MAIN ── */
  function init() {
    injectStyles();
    buildDOM();

    var msgs     = document.getElementById('cb-messages');
    var inputEl  = document.getElementById('cb-input');
    var inputBar = document.getElementById('cb-input-bar');
    var schedBar = document.getElementById('cb-schedule-bar');

    function scroll() { msgs.scrollTop = msgs.scrollHeight; }

    function avImg() {
      return '<img src="' + AVATAR_URL + '" style="' + AV_STYLE + '" alt="" onerror="this.src=\'' + AVATAR_FB + '\'" />';
    }

    function addBotMsg(html) {
      var w = document.createElement('div');
      w.className = 'cb-bot-msg-wrap';
      w.setAttribute('style', WRAP_STYLE);
      w.innerHTML = avImg() + '<div class="cb-bot-msg" style="' + BOT_STYLE + '">' + html + '</div>';
      msgs.appendChild(w); scroll();
    }

    function addUserMsg(text) {
      var d = document.createElement('div');
      d.setAttribute('style', USER_STYLE);
      d.className = 'cb-user-msg';
      d.textContent = text;
      msgs.appendChild(d); scroll();
    }

    function showTyping() {
      var w = document.createElement('div');
      w.className = 'cb-typing-wrap'; w.id = 'cb-typing';
      w.setAttribute('style', WRAP_STYLE);
      w.innerHTML = avImg() + '<div class="cb-typing"><span></span><span></span><span></span></div>';
      msgs.appendChild(w); scroll();
    }
    function hideTyping() { var t = document.getElementById('cb-typing'); if (t) t.remove(); }

    function botReply(msg, cb, delay) {
      showTyping();
      setTimeout(function () { hideTyping(); addBotMsg(msg); if (cb) cb(); }, delay || 1200);
    }

    function makeBackBtn(label, onClick) {
      var b = document.createElement('button');
      b.className = 'cb-back-btn';
      b.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;display:block;">' +
        '<polyline points="15 18 9 12 15 6"/></svg><span>' + label + '</span>';
      b.onclick = onClick;
      return b;
    }

    function isOffTopic(v) {
      return offTopicKw.some(function (k) { return v.toLowerCase().indexOf(k) > -1; });
    }

    function showInputBar() {
      inputBar.setAttribute('style', 'display:flex!important;align-items:center;gap:8px;padding:10px 12px;border-top:1px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.45);flex-shrink:0;');
      setTimeout(function () { scroll(); inputEl.focus(); }, 50);
    }

    function hideInputBar() {
      inputBar.setAttribute('style', 'display:none!important;');
    }

    function showScheduleBar() {
      schedBar.setAttribute('style', 'display:block!important;text-align:center;background:linear-gradient(135deg,#F09300,#f5a623);color:#fff;font-weight:700;font-size:13.5px;font-family:Outfit,sans-serif;text-decoration:none;padding:13px;letter-spacing:0.2px;transition:filter 0.2s;flex-shrink:0;');
    }

    /* ── IDLE ── */
    function removeIdleReminder() {
      var b = document.getElementById(IDLE_MSG_ID);  if (b) b.remove();
      var d = document.getElementById(IDLE_BTNS_ID); if (d) d.remove();
    }

    function scheduleIdleTimer() {
      clearTimeout(idleTimer);
      if (step < 7) idleTimer = setTimeout(showIdleReminder, idleInterval);
    }

    function resetIdleTimer() {
      clearTimeout(idleTimer);
      idleInterval = 60000;
      removeIdleReminder();
      awaitingIdleResponse = false;
      scheduleIdleTimer();
    }

    function showIdleReminder() {
      if (step >= 7 || awaitingIdleResponse) return;
      awaitingIdleResponse = true;
      idleInterval = Math.min(idleInterval * 2, 960000);
      var win = document.getElementById('lead-bot');
      if (win && win.style.display === 'none') {
        document.getElementById('cb-launcher-badge').classList.add('cb-badge-on');
        idleTimer = setTimeout(showIdleReminder, idleInterval);
      } else {
        removeIdleReminder();
        hideInputBar();
        var wrap = document.createElement('div');
        wrap.id = IDLE_MSG_ID;
        wrap.className = 'cb-bot-msg-wrap';
        wrap.setAttribute('style', WRAP_STYLE);
        wrap.innerHTML = avImg() + '<div class="cb-bot-msg" style="' + BOT_STYLE + '">Hi, are you still there?</div>';
        msgs.appendChild(wrap); scroll();
        showIdleButtons();
      }
    }

    function showIdleButtons() {
      var old = document.getElementById(IDLE_BTNS_ID); if (old) old.remove();
      var div = document.createElement('div');
      div.className = 'cb-qbtns cb-grid'; div.id = IDLE_BTNS_ID;

      var yes = document.createElement('button'); yes.textContent = 'Yes, still here!';
      yes.onclick = function () {
        removeIdleReminder(); addUserMsg('Yes, still here!'); resumeStep();
      };
      var no = document.createElement('button'); no.textContent = "No, I'm done";
      no.onclick = function () {
        removeIdleReminder(); addUserMsg("No, I'm done");
        awaitingIdleResponse = false; clearTimeout(idleTimer);
        botReply('No problem! Feel free to come back anytime.');
      };
      div.appendChild(yes); div.appendChild(no); msgs.appendChild(div); scroll();
    }

    function resumeStep() {
      awaitingIdleResponse = false; resetIdleTimer();
      if (step === 1) { botReply('No problem! What type of solution are you looking for?', function () { showIntentOptions(lead.intent); }); return; }
      if (step === 2) { showTimelineStep(); return; }
      if (step === 3) { showBudgetStep(); return; }
      if (step === 4) { showInputBar(); botReply("What's your name?"); return; }
      if (step === 5) { showInputBar(); botReply("What's the best phone number to reach you?"); return; }
      if (step === 6) { showInputBar(); botReply("What's the best email to reach you?"); return; }
      if (step === 7) { botReply('Our team already has your details and will be in touch shortly!'); return; }
      botReply('No problem! Take your time.');
    }

    /* ── EXPAND UI ── */
    function expandUI() {
      if (expanded) return; expanded = true;
      document.getElementById('cb-header').style.display = 'none';
      document.getElementById('cb-top-section').style.display = 'block';
    }

    /* ── GREETING BUBBLE ── */
    function showGreetingBubble() {
      if (document.getElementById('cb-greeting-bubble')) return;
      var b = document.createElement('div'); b.id = 'cb-greeting-bubble';
      b.innerHTML =
        '<span class="cb-bubble-close" id="cb-bclose">&#x00D7;</span>' +
        '<p>Hi! Need help with software or app development?</p>' +
        '<button id="cb-bopen">Let\'s Chat!</button>';
      document.body.appendChild(b);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { b.classList.add('cb-bv'); });
      });
      setTimeout(dismissBubble, 8000);
      document.getElementById('cb-bclose').onclick = dismissBubble;
      document.getElementById('cb-bopen').onclick  = openFromBubble;
    }

    function dismissBubble() {
      var b = document.getElementById('cb-greeting-bubble'); if (!b) return;
      b.classList.remove('cb-bv'); b.classList.add('cb-bh');
      setTimeout(function () { if (b.parentNode) b.remove(); }, 400);
    }

    function openFromBubble() {
      dismissBubble();
      setTimeout(function () {
        document.getElementById('lead-bot').style.display = 'block';
        startChat();
      }, 200);
    }

    /* ── START CHAT ── */
    function startChat() {
      document.getElementById('cb-welcome').style.display = 'none';
      msgs.classList.remove('cb-body-hidden');
      hideInputBar();
      showScheduleBar();
      resetIdleTimer();
    }

    /* ── TOGGLE BOT ── */
    function toggleBot() {
      var win   = document.getElementById('lead-bot');
      var badge = document.getElementById('cb-launcher-badge');
      var isOpen = (win.style.display === 'none' || win.style.display === '');
      win.style.display = isOpen ? 'block' : 'none';
      if (isOpen) {
        dismissBubble();
        var hadBadge = badge.classList.contains('cb-badge-on');
        badge.classList.remove('cb-badge-on');
        setTimeout(function () {
          startChat();
          if (hadBadge) showIdleReminder();
        }, 400);
      }
    }

    /* ── STEP 1 ── */
    function step1Handler(val) {
      expandUI();
      var s1 = document.getElementById('cb-step1'); if (s1) s1.remove();
      addUserMsg(val); lead.intent = val; step = 1; resetIdleTimer();
      botReply(intentFollowUp[val] || 'Tell me more about what you\'re looking for!', function () {
        showIntentOptions(val);
      });
    }

    /* ── INTENT OPTIONS ── */
    function showIntentOptions(intent) {
      var opts = intentOptions[intent] || ['Mobile App', 'Web App', 'Something else'];
      var div = document.createElement('div'); div.className = 'cb-qbtns cb-grid'; div.id = 'cb-intent';
      opts.forEach(function (o) {
        var b = document.createElement('button'); b.textContent = o;
        b.onclick = function () {
          var el = document.getElementById('cb-intent'); if (el) el.remove();
          addUserMsg(o); lead.intent_detail = o;
          botReply("Great choice! Let's figure out the best way to help.", function () { showTimelineStep(); });
        };
        div.appendChild(b);
      });
      div.appendChild(makeBackBtn('Back', function () {
        var el = document.getElementById('cb-intent'); if (el) el.remove();
        lead.intent = ''; step = 0;
        botReply('No problem! What brings you here today?', function () {
          var s1 = document.createElement('div'); s1.className = 'cb-qbtns cb-grid'; s1.id = 'cb-step1';
          ['New startup or app idea', 'Software for my business', 'Digital marketing help', 'Just exploring'].forEach(function (v) {
            var b = document.createElement('button'); b.textContent = v;
            b.onclick = function () { step1Handler(v); }; s1.appendChild(b);
          });
          msgs.appendChild(s1); scroll();
        });
      }));
      msgs.appendChild(div); scroll();
    }

    /* ── TIMELINE ── */
    function showTimelineStep() {
      step = 2; resetIdleTimer();
      botReply('When would you like to go live with the project?', function () {
        var div = document.createElement('div'); div.className = 'cb-qbtns cb-grid'; div.id = 'cb-timeline';
        ['ASAP (ready to start now)', '1-3 months', '3-6 months', '6+ months', 'Not sure yet'].forEach(function (t) {
          var b = document.createElement('button'); b.textContent = t;
          b.onclick = function () {
            var el = document.getElementById('cb-timeline'); if (el) el.remove();
            addUserMsg(t); lead.timeline = t; showBudgetStep();
          };
          div.appendChild(b);
        });
        div.appendChild(makeBackBtn('Back', function () {
          var el = document.getElementById('cb-timeline'); if (el) el.remove();
          lead.timeline = ''; step = 1;
          botReply('What type of solution are you looking for?', function () { showIntentOptions(lead.intent); });
        }));
        msgs.appendChild(div); scroll();
      });
    }

    /* ── BUDGET ── */
    function showBudgetStep() {
      step = 3; resetIdleTimer();
      botReply('Do you have a budget range in mind for this project?', function () {
        var div = document.createElement('div'); div.className = 'cb-bbtns cb-grid'; div.id = 'cb-budget';
        ['Under $10k', '$10k - $25k', '$25k - $50k', '$50k+', 'Not sure yet'].forEach(function (bv) {
          var btn = document.createElement('button'); btn.textContent = bv;
          btn.onclick = function () {
            var el = document.getElementById('cb-budget'); if (el) el.remove();
            addUserMsg(bv); lead.budget = bv;
            step = 4; resetIdleTimer();
            showInputBar();
            setTimeout(function () { inputEl.focus(); }, 50);
            botReply('Thanks, this helps a lot! Let me grab your details so a team member can reach out.<br><br>What\'s your name?');
          };
          div.appendChild(btn);
        });
        div.appendChild(makeBackBtn('Back', function () {
          var el = document.getElementById('cb-budget'); if (el) el.remove();
          lead.budget = ''; step = 2; showTimelineStep();
        }));
        msgs.appendChild(div); scroll();
      });
    }

    /* ── FINAL CTA ── */
    function showFinalCTA() {
      step = 7; clearTimeout(idleTimer);
      botReply('Awesome! Based on what you\'ve shared, the best next step is a quick call or Google Meet to go over your project!', function () {
        var div = document.createElement('div'); div.className = 'cb-cta-btns'; div.id = 'cb-cta';
        var book = document.createElement('button'); book.className = 'cb-cta-primary'; book.textContent = 'Book a Google Meet';
        book.onclick = function () {
          handleCTA('Book a Google Meet');
          window.open(CALENDLY_URL, '_blank');
        };
        var em = document.createElement('button'); em.className = 'cb-cta-secondary'; em.textContent = 'Send me info by email';
        em.onclick = function () { handleCTA('Send me info by email'); };
        div.appendChild(book); div.appendChild(em); msgs.appendChild(div); scroll();
      }, 1200);
    }

    function handleCTA(choice) {
      var d = document.getElementById('cb-cta'); if (d) d.remove();
      addUserMsg(choice); lead.cta_choice = choice;
      inputEl.disabled = true; inputEl.placeholder = 'Chat complete';
      var sendBtn = document.querySelector('#cb-input-bar button');
      if (sendBtn) sendBtn.disabled = true;
      botReply(choice === 'Book a Google Meet'
        ? 'Great! We\'re opening Calendly now. Pick a time that works for you. A confirmation will also be sent to ' + lead.email + '!'
        : 'Perfect! We\'ll send everything over to ' + lead.email + ' shortly. Talk soon!');
      submitLead();
    }

    /* ── SUBMIT ── */
    function submitLead() {
      var p = {
        intent: lead.intent, intent_detail: lead.intent_detail,
        timeline: lead.timeline, budget: lead.budget,
        name: lead.name, phone: lead.phone, email: lead.email, cta_choice: lead.cta_choice,
        page: lead.page, page_name: lead.page_name,
        utm_source: lead.utm_source, utm_campaign: lead.utm_campaign,
        utm_medium: lead.utm_medium, utm_term: lead.utm_term,
        utm_content: lead.utm_content, gclid: lead.gclid
      };
      if (!window.emailjs) {
        console.warn('[Demski Chatbot] EmailJS not loaded; lead not sent', p);
        return;
      }
      window.emailjs.send(EJS_SVC, EJS_LEAD_TPL, p).catch(function (e) { console.warn('Lead failed', e); });
      window.emailjs.send(EJS_SVC, EJS_CONF_TPL, { user_name: lead.name, user_email: lead.email, cta_choice: lead.cta_choice }).catch(function (e) { console.warn('Confirm failed', e); });
    }

    /* ── INPUT HANDLER ── */
    function handleInput() {
      var val = inputEl.value.trim(); if (!val) return;
      if (awaitingIdleResponse) {
        removeIdleReminder(); addUserMsg(val); inputEl.value = ''; resumeStep(); return;
      }
      addUserMsg(val); inputEl.value = ''; resetIdleTimer();
      if (step === 0) { botReply('Please use the buttons above to get started!'); return; }
      if (step === 1) {
        var el = document.getElementById('cb-intent'); if (el) el.remove();
        botReply('No problem! What type of solution are you looking for?', function () { showIntentOptions(lead.intent); }); return;
      }
      if (step === 2) { showTimelineStep(); return; }
      if (step === 3) { showBudgetStep(); return; }
      if ((step === 4 || step === 5 || step === 6) && isOffTopic(val)) {
        var q = step === 4 ? "What's your name?" : step === 5 ? "What's your phone number?" : "What's your email address?";
        botReply('Great question! Our team will cover all that on the call. For now: ' + q); return;
      }
      if (step === 4) {
        if (val.length < 2) { botReply('Could you enter your full name please?'); return; }
        lead.name = val; step = 5;
        botReply('Nice to meet you, ' + val.split(' ')[0] + '! What\'s the best phone number to reach you?'); return;
      }
      if (step === 5) {
        var digits = val.replace(/\D/g, '');
        if (digits.length < 7) { botReply("That doesn't look like a valid phone number. Could you double-check?"); return; }
        lead.phone = val; step = 6;
        botReply("Got it! And what's the best email address to reach you?"); return;
      }
      if (step === 6) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { botReply("That doesn't look right. Could you double-check your email address?"); return; }
        lead.email = val; showFinalCTA(); return;
      }
    }

    /* ── WIRE UP DOM EVENTS ── */
    document.getElementById('cb-close-compact').onclick  = toggleBot;
    document.getElementById('cb-close-expanded').onclick = toggleBot;
    document.getElementById('bot-launcher').onclick      = toggleBot;
    document.getElementById('cb-send').onclick           = handleInput;
    inputEl.addEventListener('keypress', function (e) { if (e.key === 'Enter') handleInput(); });

    /* Wire step-1 buttons */
    var s1btns = document.querySelectorAll('#cb-step1 [data-step1]');
    for (var i = 0; i < s1btns.length; i++) {
      (function (btn) {
        btn.onclick = function () { step1Handler(btn.getAttribute('data-step1')); };
      })(s1btns[i]);
    }

    /* ── EMAILJS + LAUNCH SEQUENCE ── */
    function bootEmailJS() {
      if (window.emailjs) { window.emailjs.init(EJS_KEY); return; }
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
      s.onload = function () { window.emailjs.init(EJS_KEY); };
      document.head.appendChild(s);
    }

    function launch() {
      bootEmailJS();
      var launcher = document.getElementById('bot-launcher');
      launcher.style.display = 'flex';
      setTimeout(function () {
        launcher.classList.add('cb-launcher-visible');
        setTimeout(function () { if (!expanded) showGreetingBubble(); }, 1000);
      }, 3000);
    }

    if (document.readyState === 'complete') {
      launch();
    } else {
      window.addEventListener('load', launch);
    }
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
