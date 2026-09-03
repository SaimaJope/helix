/* Applies content/settings.json to the page.
 *
 * Two bindings:
 *   [data-setting="a.b"]   writes the value into the element. Add
 *                          data-setting-html to accept newlines as <br>, or
 *                          data-setting-attr="href" to write an attribute
 *                          (with an optional data-setting-prefix).
 *   [data-social="key"]    points the link at settings.socials[key], and
 *                          refreshes the handle shown in a child .hd if the
 *                          link has one. A blank value hides the link.
 *
 * This runs on every page, including the home page, which does not load
 * site.js. site.js delegates to it so the settings are fetched once.
 */
(function () {
  var cache = null;

  function getPath(o, p) {
    return String(p).split('.').reduce(function (a, k) { return a == null ? undefined : a[k]; }, o);
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* The admin accepts addresses with or without a scheme. */
  function absolute(v) {
    var s = String(v == null ? '' : v).trim();
    if (!s) return '';
    if (/^(https?:)?\/\//i.test(s)) return s.replace(/^\/\//, 'https://');
    if (/^(mailto|tel):/i.test(s)) return s;
    return 'https://' + s.replace(/^\/+/, '');
  }

  /* The handle printed under the network name on the contact page. Discord
     invites are codes rather than names, so those keep their written label. */
  function handle(href, key) {
    if (key === 'discord') return '';
    var path;
    try { path = new URL(href).pathname; } catch (e) { return ''; }
    var parts = path.split('/').filter(Boolean).map(decodeURIComponent);
    if (!parts.length) return '';
    if (key === 'linkedin') return '/' + parts.join('/');
    var last = parts[parts.length - 1];
    return last.charAt(0) === '@' ? last : '@' + last;
  }

  function apply(st) {
    st = st || {};

    document.querySelectorAll('[data-setting]').forEach(function (el) {
      var v = getPath(st, el.dataset.setting);
      if (v === undefined || v === null || v === '') return;
      if (el.dataset.settingAttr) {
        el.setAttribute(el.dataset.settingAttr, (el.dataset.settingPrefix || '') + v);
      } else if (el.dataset.settingHtml !== undefined) {
        el.innerHTML = String(v).split('\n').map(esc).join('<br>');
      } else {
        el.textContent = v;
      }
    });

    var socials = st.socials || {};
    document.querySelectorAll('[data-social]').forEach(function (el) {
      var key = el.dataset.social;
      if (!(key in socials)) return;
      var href = absolute(socials[key]);
      if (!href) { el.hidden = true; return; }
      el.hidden = false;
      el.setAttribute('href', href);
      var hd = el.querySelector('.hd');
      if (hd) { var h = handle(href, key); if (h) hd.textContent = h; }
    });

    return st;
  }

  function load() {
    if (cache) return Promise.resolve(cache);
    var override = null;
    try {
      var raw = localStorage.getItem('helix-content:settings');
      if (raw && localStorage.getItem('helix-content-preview') === 'on') override = JSON.parse(raw);
    } catch (e) {}
    if (override) { cache = override; return Promise.resolve(cache); }
    return fetch('content/settings.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (j) { cache = j; return j; });
  }

  window.HXSettings = {
    load: load,
    apply: function () { return load().then(apply); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { window.HXSettings.apply(); }, { once: true });
  } else {
    window.HXSettings.apply();
  }
})();
