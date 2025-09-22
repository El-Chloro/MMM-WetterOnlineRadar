(() => {
  const injectCSS = () => {
    if (!document.querySelector('style[data-mm-wro]')) {
      const s = document.createElement('style');
      s.type = 'text/css';
      s.setAttribute('data-mm-wro', '1');
      s.textContent = `
        html,body{background:transparent !important;overflow:hidden !important;margin:0!important;padding:0!important}
        *::-webkit-scrollbar{width:0;height:0}
      `;
      (document.head || document.documentElement).appendChild(s);
    }
  };

  const PLAY_PATTERNS = /(play|start|abspielen|animation|loop|wiedergabe|los|starten|autoplay|resume)/i;
  const ICON_PATTERNS = /[▶►⯈⏵]/;

  const isVisible = el => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };

  const deepQueryAll = (root, selector, out=[]) => {
    try { root.querySelectorAll(selector).forEach(n => out.push(n)); } catch(_) {}
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false);
    let node = root;
    while (node) {
      if (node.shadowRoot) {
        try { node.shadowRoot.querySelectorAll(selector).forEach(n => out.push(n)); } catch(_) {}
        deepQueryAll(node.shadowRoot, selector, out);
      }
      node = walker.nextNode();
    }
    return out;
  };

  const textOf = el => {
    const t = (el.innerText || el.textContent || '');
    const aria = (el.getAttribute && (el.getAttribute('aria-label') || el.title || '')) || '';
    const data = (el.getAttribute && (el.getAttribute('data-testid') || el.getAttribute('data-title') || '')) || '';
    return (t + ' ' + aria + ' ' + data).trim();
  };

  const dispatchClickLike = el => {
    const rect = el.getBoundingClientRect();
    const x = Math.max(1, Math.floor(rect.left + rect.width/2));
    const y = Math.max(1, Math.floor(rect.top + rect.height/2));
    const opts = {bubbles:true, cancelable:true, clientX:x, clientY:y, pointerId:1};
    try { el.dispatchEvent(new PointerEvent('pointerover', opts)); } catch(_) {}
    try { el.dispatchEvent(new PointerEvent('pointerdown', opts)); } catch(_) {}
    try { el.dispatchEvent(new MouseEvent('mousedown', opts)); } catch(_) {}
    try { el.dispatchEvent(new PointerEvent('pointerup', opts)); } catch(_) {}
    try { el.dispatchEvent(new MouseEvent('mouseup', opts)); } catch(_) {}
    try { el.dispatchEvent(new MouseEvent('click', opts)); } catch(_) {}
  };

  const tryStartAnimation = () => {
    try {
      const candidates = new Set();
      deepQueryAll(document, 'button, a, [role="button"], .icon-button, .control, .controls, .toolbar, .timeline, .leaflet-control')
        .forEach(el => {
          const txt = textOf(el);
          if (PLAY_PATTERNS.test(txt) || ICON_PATTERNS.test(txt)) candidates.add(el);
          if (!txt && el.querySelector && (el.querySelector('svg') || el.querySelector('i.material-icons'))) candidates.add(el);
        });

      // "Pause" vorhanden? → vermutlich schon laufend
      const pauseLike = Array.from(candidates).find(el => /pause|stopp|anhalten/i.test(textOf(el)));
      if (pauseLike && isVisible(pauseLike)) return true;

      let clicked = false;
      // Primär sichtbare Kandidaten
      for (const el of Array.from(candidates).filter(isVisible)) {
        dispatchClickLike(el);
        clicked = true;
        break;
      }

      // Fallback: Canvas/Timeline fokussieren + Keys
      if (!clicked) {
        const canvas = document.querySelector('canvas') || document.querySelector('div[role="presentation"]');
        if (canvas && isVisible(canvas)) {
          dispatchClickLike(canvas);
        }
        try { window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true })); } catch(e){}
        try { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', bubbles: true })); } catch(e){}
        try { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true })); } catch(e){}
      }
      return true;
    } catch (_) { return false; }
  };

  const init = () => { injectCSS(); tryStartAnimation(); };

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('load', init);

  // DOM-Änderungen beobachten (Angular lädt dynamisch)
  try {
    const mo = new MutationObserver(() => { tryStartAnimation(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch(_) {}

  // Eng getaktete Frühversuche, dann Keep-Alive
  let earlyCount = 0;
  const early = setInterval(() => {
    earlyCount++;
    init();
    if (earlyCount >= 20) clearInterval(early); // 20 Versuche ~20s
  }, 1000);

  setInterval(() => { tryStartAnimation(); }, 25000);
})();
