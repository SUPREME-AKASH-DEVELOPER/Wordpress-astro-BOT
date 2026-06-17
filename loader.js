/*!
 * Demski Group Chatbot Loader
 * Drop this single tag on any page:
 *   <script src="https://<your-vercel-domain>/loader.js"
 *           data-widget-src="https://<your-vercel-domain>/widget.js" async></script>
 *
 * Optional data attributes are forwarded to the widget:
 *   data-avatar, data-avatar-fallback, data-calendly,
 *   data-ejs-key, data-ejs-service, data-ejs-lead-template, data-ejs-confirm-template,
 *   data-bot-name, data-bot-title
 */
(function () {
  'use strict';

  var CURRENT = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  if (window.__demskiChatbotLoaderRan) return;
  window.__demskiChatbotLoaderRan = true;

  var widgetSrc = CURRENT.getAttribute('data-widget-src');
  if (!widgetSrc) {
    // Default: assume widget.js lives alongside loader.js
    try {
      widgetSrc = new URL('widget.js', new URL(CURRENT.src, location.href)).href;
    } catch (e) {
      console.error('[Demski Chatbot] Could not resolve widget.js URL. Set data-widget-src on the loader script tag.');
      return;
    }
  }

  var s = document.createElement('script');
  s.src = widgetSrc;
  s.async = true;

  // Forward all data-* attributes (except data-widget-src) to the widget script tag
  for (var i = 0; i < CURRENT.attributes.length; i++) {
    var attr = CURRENT.attributes[i];
    if (attr.name.indexOf('data-') === 0 && attr.name !== 'data-widget-src') {
      s.setAttribute(attr.name, attr.value);
    }
  }

  document.head.appendChild(s);
})();
