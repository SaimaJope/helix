(() => {
  'use strict';

  const selector = 'video[data-stock-footage]';
  const mounted = new WeakSet();
  const visibility = new WeakMap();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function sync(video) {
    const shouldPlay = !reducedMotion.matches && !document.hidden && visibility.get(video) === true;
    if (!shouldPlay) {
      video.pause();
      return;
    }
    video.play().catch(() => {});
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      visibility.set(entry.target, entry.isIntersecting);
      sync(entry.target);
    });
  }, { rootMargin: '160px 0px', threshold: 0.08 });

  function mount(root = document) {
    root.querySelectorAll(selector).forEach((video) => {
      if (mounted.has(video)) return;
      mounted.add(video);
      video.muted = true;
      video.defaultMuted = true;
      video.playbackRate = 0.82;
      visibility.set(video, false);
      observer.observe(video);
    });
  }

  function syncAll() {
    document.querySelectorAll(selector).forEach(sync);
  }

  const start = () => {
    mount();
    new MutationObserver(() => mount()).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('visibilitychange', syncAll);
    reducedMotion.addEventListener('change', syncAll);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
