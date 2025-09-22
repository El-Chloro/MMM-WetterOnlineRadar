// Läuft im Kontext des WO-Radarframes.
// Findet den echten Play-Button (auch in Shadow-DOM), prüft ob schon „Pause“ zu sehen ist,
// meldet Koordinaten an den Host (der mit trusted Events klickt) und bietet Prüffunktionen.

(() => {
  const HIDE_CSS = `
    html, body { background: transparent !important; overflow: hidden !important; margin:0!important; }
    *::-webkit-scrollbar{width:0;height:0}
    header, footer, nav, .wo-Header, .wo-Footer,
    .ad, [id*="ad"], [class*="ad"], .banner,
    .cookie, [id*="cookie"], [class*="cookie"],
    [id*="consent"], [class*="consent"], [aria-label*="Cookie" i], [aria-label*="Cookies" i],
    .modal, .popup, .overlay, .dialog, .backdrop,
    .wo-AppInstall, .wo-AppBanner, .wo-MemberPrompt, .wo-LoginPrompt, .wo-Modal, .wo-Layer,
    .tracking-consent, .gdpr, .cmp-ui, .cmp-layer {
      display: none !important; visibility: hidden !important; opacity: 0 !important;
    }
  `;

  const injectCSS = () => {
    try {
      if (!document.querySelector('style[data-mm-wro]')) {
        const s = document.createElement('style');
        s.type = 'text/css';
        s.setAttribute('data-mm-wro','1');
        s.textContent = HIDE_CSS;
        (document.head || document.documentElement).appendChild(s);
      }
    } catch(_) {}
  };

  const isVisible = (el) => {
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

  const center = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.floor(r.left + r.width/2), y: Math.floor(r.top + r.height/2) };
  };

  // „läuft schon?“ → sichtbarer Button mit Pause/Stopp/Anhalten
  const isPlaying = () => {
    const BTN = 'button, [role="button"], .mat-mdc-icon-button, .mat-icon-button, .icon-button, .timeline button, .controls button, .toolbar button';
    return deepQueryAll(document, BTN)
      .filter(isVisible)
      .some(b => {
        const text = ((b.innerText||b.textContent||'') + ' ' + (b.getAttribute?.('aria-label')||b.title||'')).toLowerCase();
        return /pause|stopp|stop|anhalten/.test(text);
      });
  };

  const findPlayButton = () => {
    const BTN = 'button, [role="button"], .mat-mdc-icon-button, .mat-icon-button, .icon-button, .timeline button, .controls button, .toolbar button';

    // 1) Semantik (de+en)
    const sema = ['play','start','wiedergabe','abspielen','animation','starten'];
    const semaSel = sema.map(s => `button[aria-label*="${s}" i], button[title*="${s}" i], [role="button"][aria-label*="${s}" i]`).join(',');
    let candidates = deepQueryAll(document, semaSel).filter(isVisible);
    if (candidates.length) return candidates[0];

    // 2) Material-Icons
    const icons = deepQueryAll(document, '.mat-icon, i.material-icons, .material-icons').filter(isVisible);
    for (const ic of icons) {
      const t = (ic.innerText || ic.textContent || '').trim().toLowerCase();
      if (t === 'play_arrow' || t === 'play' || t === 'start') {
        const btn = ic.closest(BTN);
        if (btn && isVisible(btn)) return btn;
      }
    }

    // 3) Ripple innerhalb von Buttons
    const rip = deepQueryAll(document, 'span.ng-ripple, .ng-ripple, span.ng-ripple.animate').filter(isVisible);
    for (const r of rip) {
      const btn = r.closest(BTN);
      if (btn && isVisible(btn)) return btn;
    }

    // 4) Heuristik: sichtbare Buttons nah am unteren Rand
    const allBtns = deepQueryAll(document, BTN).filter(isVisible);
    const h = window.innerHeight || 0;
    const bottomBtns = allBtns.filter(b => b.getBoundingClientRect().top > h * 0.78);
    if (bottomBtns.length) return bottomBtns[0];

    return null;
  };

  const { ipcRenderer } = require("electron");
  const emitTarget = (x, y) => { try { ipcRenderer.sendToHost("mm-wro-autoplay-target", { x, y }); } catch(_) {} };

  const tryAutoplay = () => {
    try {
      if (isPlaying()) return true;
      const btn = findPlayButton();
      if (btn) { const { x, y } = center(btn); emitTarget(x, y); return true; }
      return false;
    } catch (_) { return false; }
  };

  const init = () => { injectCSS(); tryAutoplay(); };

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('load', init);

  try {
    const mo = new MutationObserver(() => { tryAutoplay(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch(_) {}

  // frühe Versuche innerhalb der ersten ~20s
  let early = 0;
  const earlyIv = setInterval(() => {
    early++;
    init();
    if (early >= 20) clearInterval(earlyIv);
  }, 1000);

  // Externe Hooks für den Host
  window.__mmWROKick = () => { init(); };
  window.__mmWROIsPlaying = () => { try { return !!isPlaying(); } catch(_) { return false; } };

  // periodische Prüfung (Keep-Alive), Klick macht der Host erst nach Koordinaten
  setInterval(() => { tryAutoplay(); }, 25000);
})();
