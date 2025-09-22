// Läuft im Kontext des wo-cloud Frames (webview preload)
(() => {
  const addBaseCSS = () => {
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

  const SEL_BTN = 'button, [role="button"], .mat-mdc-icon-button, .mat-icon-button, .icon-button, .timeline button, .controls button, .toolbar button';
  const SEL_RIPPLE = 'span.ng-ripple, .ng-ripple, span.ng-ripple.animate';

  const isVisible = el => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const cs = window.getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
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

  const dispatchCombo = (el, biasEl) => {
    const rect = el.getBoundingClientRect();
    const bx = Math.floor(rect.left + rect.width/2);
    const by = Math.floor(rect.top + rect.height/2);
    const tryPoint = (x, y) => {
      const opts = {bubbles:true, cancelable:true, clientX:x, clientY:y, pointerId:1, composed:true};
      try { el.dispatchEvent(new PointerEvent('pointerover', opts)); } catch(_) {}
      try { el.dispatchEvent(new PointerEvent('pointerdown', opts)); } catch(_) {}
      try { el.dispatchEvent(new MouseEvent('mousedown', opts)); } catch(_) {}
      try { el.dispatchEvent(new PointerEvent('pointerup', opts)); } catch(_) {}
      try { el.dispatchEvent(new MouseEvent('mouseup', opts)); } catch(_) {}
      try { el.dispatchEvent(new MouseEvent('click', opts)); } catch(_) {}
    };
    // Button-Mitte
    tryPoint(bx, by);
    // zusätzlich direkt auf die Mittelpunkt-Koordinate des Ripple
    if (biasEl && biasEl !== el && biasEl.getBoundingClientRect) {
      const rr = biasEl.getBoundingClientRect();
      const rx = Math.floor(rr.left + rr.width/2);
      const ry = Math.floor(rr.top + rr.height/2);
      tryPoint(rx, ry);
    }
  };

  const playLike = (el) => {
    const txt = (el.innerText || el.textContent || '').toLowerCase();
    const aria = ((el.getAttribute && (el.getAttribute('aria-label') || el.title)) || '').toLowerCase();
    if (/(play|start|abspielen|animation|loop|wiedergabe|starten)/i.test(txt) ||
        /(play|start|abspielen|animation|loop|wiedergabe|starten)/i.test(aria)) return true;
    if (!txt && !aria) {
      if (el.querySelector && (el.querySelector('svg') || el.querySelector('i.material-icons'))) return true;
    }
    return false;
  };

  const tryStart = () => {
    try {
      // Wenn „Pause“ sichtbar ist, läuft’s bereits
      const anyPause = deepQueryAll(document, SEL_BTN)
        .some(b => /pause|stopp|anhalten/i.test((b.innerText||b.textContent||'') + ' ' + ((b.getAttribute && (b.getAttribute('aria-label')||b.title))||'')));
      if (anyPause) return true;

      // 1) Ripple → Button
      const ripples = deepQueryAll(document, SEL_RIPPLE).filter(isVisible);
      for (const r of ripples) {
        const btn = r.closest(SEL_BTN);
        if (btn && isVisible(btn)) { dispatchCombo(btn, r); return true; }
      }

      // 2) sichtbare Play-Buttons
      const btns = deepQueryAll(document, SEL_BTN).filter(isVisible);
      for (const b of btns) {
        if (playLike(b)) { dispatchCombo(b, null); return true; }
      }

      // 3) Fallback: Canvas + Keys
      const canvas = document.querySelector('canvas') || document.querySelector('div[role="presentation"]');
      if (canvas && isVisible(canvas)) {
        try {
          const rc = canvas.getBoundingClientRect();
          const x = Math.floor(rc.left + rc.width * 0.15);
          const y = Math.floor(rc.top + rc.height * 0.85);
          const opts = {bubbles:true, cancelable:true, clientX:x, clientY:y, pointerId:1, composed:true};
          canvas.dispatchEvent(new PointerEvent('pointerdown', opts));
          canvas.dispatchEvent(new MouseEvent('mousedown', opts));
          canvas.dispatchEvent(new PointerEvent('pointerup', opts));
          canvas.dispatchEvent(new MouseEvent('mouseup', opts));
          canvas.dispatchEvent(new MouseEvent('click', opts));
        } catch(_) {}
      }
      try { window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true})); } catch(_) {}
      try { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true})); } catch(_) {}

      return false;
    } catch (e) { return false; }
  };

  const init = () => { addBaseCSS(); tryStart(); };

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('load', init);

  // UI kommt dynamisch → bei Änderungen erneut versuchen
  try {
    const mo = new MutationObserver((muts) => {
      // nur reagieren, wenn Ripple/Buttons beteiligt sind → schneller
      const hit = muts.some(m =>
        Array.from(m.addedNodes || []).some(n =>
          n.nodeType === 1 && (n.matches?.(SEL_RIPPLE) || n.matches?.(SEL_BTN) || n.querySelector?.(SEL_RIPPLE) || n.querySelector?.(SEL_BTN))
        )
      );
      if (hit) tryStart();
    });
    mo.observe(document.documentElement, {childList:true, subtree:true});
  } catch(_) {}

  // Eng getaktete Frühversuche + periodisches Keep-Alive
  let early = 0;
  const earlyIv = setInterval(() => {
    early++;
    init();
    if (early >= 20) clearInterval(earlyIv); // ~20 Sekunden
  }, 1000);

  setInterval(() => { tryStart(); }, 25000);
})();
