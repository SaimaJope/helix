(function () {
  'use strict';

  const STORAGE_KEY = 'helix-privacy';
  const NOTICE_VERSION = 1;
  const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
  const VISITOR_KEYS = [STORAGE_KEY, 'helix-theme', 'helix-cart'];

  function readReceipt() {
    try {
      const receipt = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      const age = Date.now() - Number(receipt && receipt.savedAt);
      return receipt && receipt.version === NOTICE_VERSION && age >= 0 && age < MAX_AGE_MS ? receipt : null;
    } catch (error) {
      return null;
    }
  }

  function saveReceipt() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: NOTICE_VERSION, savedAt: Date.now() }));
    } catch (error) {}
  }

  function removeBanner() {
    const banner = document.querySelector('.hx-privacy-banner');
    if (banner) banner.remove();
  }

  function showBanner() {
    if (readReceipt() || document.querySelector('.hx-privacy-banner')) return;
    const banner = document.createElement('section');
    banner.className = 'hx-privacy-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-labelledby', 'hx-privacy-banner-title');
    banner.innerHTML = `
      <div class="hx-privacy-banner__body">
        <p class="hx-privacy-banner__eyebrow">Privacy, without the theatre</p>
        <h2 id="hx-privacy-banner-title">No tracking cookies.</h2>
        <p>We use only essential browser storage for your privacy acknowledgement, theme and shopping cart. There is no analytics, advertising or cross-site tracking.</p>
        <div class="hx-privacy-banner__actions">
          <button class="hx-privacy-button" type="button" data-hx-privacy-ack>Understood</button>
          <a class="hx-privacy-link" href="/privacy/">Read the privacy notice</a>
        </div>
      </div>`;
    banner.querySelector('[data-hx-privacy-ack]').addEventListener('click', function () {
      saveReceipt();
      removeBanner();
    });
    document.body.appendChild(banner);
  }

  function ensureDialog() {
    let dialog = document.querySelector('.hx-privacy-dialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.className = 'hx-privacy-dialog';
    dialog.setAttribute('aria-labelledby', 'hx-privacy-dialog-title');
    dialog.innerHTML = `
      <div class="hx-privacy-dialog__inner">
        <div class="hx-privacy-dialog__top">
          <div>
            <p class="hx-privacy-dialog__eyebrow">Privacy settings</p>
            <h2 id="hx-privacy-dialog-title">A deliberately short list.</h2>
          </div>
          <button class="hx-privacy-dialog__close" type="button" aria-label="Close privacy settings" data-hx-privacy-close>&times;</button>
        </div>
        <p class="hx-privacy-dialog__intro">Helix does not use optional cookies or trackers. These are the only categories in use on the public site.</p>
        <div class="hx-privacy-list">
          <div class="hx-privacy-row">
            <div><h3>Necessary preferences</h3><p>Remembers this acknowledgement for up to 12 months, your display theme, and items you place in the cart. These values stay in this browser.</p></div>
            <span class="hx-privacy-status">Always on</span>
          </div>
          <div class="hx-privacy-row">
            <div><h3>Analytics</h3><p>No analytics service is installed and no audience profile is created.</p></div>
            <span class="hx-privacy-status off">Not used</span>
          </div>
          <div class="hx-privacy-row">
            <div><h3>Advertising and social tracking</h3><p>No advertising pixels, embedded social feeds or cross-site trackers are installed.</p></div>
            <span class="hx-privacy-status off">Not used</span>
          </div>
        </div>
        <div class="hx-privacy-dialog__actions">
          <button class="hx-privacy-text-button" type="button" data-hx-privacy-clear>Clear visitor preferences</button>
          <a class="hx-privacy-link" href="/privacy/">Full privacy &amp; storage notice</a>
        </div>
      </div>`;
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) dialog.close();
    });
    dialog.querySelector('[data-hx-privacy-close]').addEventListener('click', function () { dialog.close(); });
    dialog.querySelector('[data-hx-privacy-clear]').addEventListener('click', function () {
      if (!window.confirm('Clear the privacy acknowledgement, theme and shopping cart saved in this browser?')) return;
      VISITOR_KEYS.forEach(function (key) {
        try { localStorage.removeItem(key); } catch (error) {}
      });
      window.location.reload();
    });
    document.body.appendChild(dialog);
    return dialog;
  }

  function openSettings() {
    const dialog = ensureDialog();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    const close = dialog.querySelector('[data-hx-privacy-close]');
    if (close) close.focus();
  }

  function addFormNotices() {
    document.querySelectorAll('form[data-mailto]').forEach(function (form) {
      if (form.parentElement && form.parentElement.querySelector(':scope > .hx-form-privacy[data-for="' + (form.dataset.subject || 'message') + '"]')) return;
      const subject = (form.dataset.subject || '').toLowerCase();
      const notice = document.createElement('p');
      notice.className = 'hx-form-privacy';
      notice.dataset.for = form.dataset.subject || 'message';
      if (subject.includes('newsletter')) {
        notice.innerHTML = 'This opens a draft in your email app; the website sends nothing itself. If you send it, we use your address for newsletter requests until you unsubscribe. <a href="/privacy/#email">Privacy details</a>.';
        form.insertAdjacentElement('afterend', notice);
      } else if (subject.includes('volunteer')) {
        notice.innerHTML = 'The website does not transmit this form. It opens a draft in your email app; if you send it, we use the details to assess and answer your application. <a href="/privacy/#email">Privacy details</a>.';
        form.appendChild(notice);
      } else {
        notice.innerHTML = 'The website does not transmit this form. It opens a draft in your email app; if you send it, we use the details only to answer your request. <a href="/privacy/#email">Privacy details</a>.';
        form.appendChild(notice);
      }
    });

    document.querySelectorAll('form[data-checkout-form]').forEach(function (form) {
      if (form.querySelector('.hx-form-privacy')) return;
      const notice = document.createElement('p');
      notice.className = 'hx-form-privacy';
      notice.innerHTML = '<strong>Prototype checkout:</strong> entries remain in this browser tab and are not transmitted or stored. No payment is taken. <a href="/privacy/#checkout">Privacy details</a>.';
      form.appendChild(notice);
    });
  }

  function hardenExternalLinks() {
    document.querySelectorAll('a[href]').forEach(function (link) {
      let destination;
      try { destination = new URL(link.href, window.location.href); } catch (error) { return; }
      if (!/^https?:$/.test(destination.protocol) || destination.origin === window.location.origin) return;
      const rel = new Set((link.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
      rel.add('noopener');
      rel.add('noreferrer');
      link.setAttribute('rel', Array.from(rel).join(' '));
      link.referrerPolicy = 'no-referrer';
    });
  }

  function ensureSettingsControl() {
    if (document.querySelector('.hx-privacy-open, [data-hx-privacy-settings]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hx-privacy-open hx-privacy-fab';
    button.textContent = 'Privacy settings';
    document.body.appendChild(button);
  }

  function boot() {
    document.addEventListener('click', function (event) {
      const opener = event.target.closest('[data-hx-privacy-settings], .hx-privacy-open');
      if (!opener) return;
      event.preventDefault();
      openSettings();
    });
    document.addEventListener('submit', function (event) {
      const form = event.target.closest('form[data-mailto]');
      if (!form || event.defaultPrevented) return;
      event.preventDefault();
      const data = new FormData(form);
      const subject = data.get('subject') || form.dataset.subject || 'Message from the website';
      const lines = [];
      data.forEach(function (value, key) { if (key !== 'subject') lines.push(key + ': ' + value); });
      window.location.href = 'mailto:helixanthropisinstitute@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\n'));
    });
    hardenExternalLinks();
    ensureSettingsControl();
    addFormNotices();
    if (!readReceipt()) showBanner();
  }

  window.HXPrivacy = { open: openSettings, clear: function () {
    VISITOR_KEYS.forEach(function (key) { try { localStorage.removeItem(key); } catch (error) {} });
  }};

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
