// Läuft im Kontext des wo-cloud Frames.
// Aufgabe: UI säubern + den *richtigen* Play-Button finden.
// Dann Koordinaten an den Host schicken, der mit „trusted“ Events klickt.
// Keine blinden Klicks mehr in die Tab-Leiste („morgen“)!

(() => {
  const HIDE_CSS = `
    html, body { background: transparent !important; overflow: hidden !important; margin:0!important; }
    *::-webkit-scrollbar{width:0;height:0}
    /* Popups, Banner & CMP aggressiv ausblenden (nur sicherheitsrelevante Klassen/Begriffe) */
    header, footer, nav, .wo-Header, .wo-Footer, .footer, .header, .nav, .navbar,
    .ad, [id*="ad"], [class*="ad"], .banner, .cookie, [id*="cookie"], [class*="cookie"],
    [id*="consent"], [class*="consent"], [aria-label*="Cookie" i], [aria-label*="Cookies" i],
    .modal, .popup, .overlay, .dialog, .backdrop, .newsletter, .qrcode, .share, .social,
    .wo-AppInstall, .wo-AppBanner, .wo-MemberPrompt, .wo-LoginPrompt, .wo-Modal, .wo-Layer,
    .app-download, .tracking-consent, .consent, .notice, .privacy, .gdpr, .cmp-ui, .cmp-layer {
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

  // „läuft schon?“ → erkennbar, wenn ein sichtbarer Button „Pause/Stopp/Anhalten“ signalisiert
  const isPlaying = () => {
    const BTN = 'button, [role="button"], .mat-mdc-icon-button, .mat-icon-button, .icon-button, .timeline button, .controls button, .toolbar button';
    return deepQueryAll(document, BTN)
      .filter(isVisible)
      .some(b => {
        const text = ((b.innerText||b.textContent||'') + ' ' + (b.getAttribute?.('aria-label')||b.title||'')).toLowerCase();
        return /pause|stopp|anhalten/.test(text);
      });
  };

  const findPlayButton = () => {
    const BTN = 'button, [role="button"], .mat-mdc-icon-button, .mat-icon-button, .icon-button, .timeline button, .controls button, .toolbar button';

    // 1) semantische Labels (mehrsprachig)
    const sema = [
      'play','start','wiedergabe','abspielen','animation','starten'
    ];
    const semaSel = sema.map(s => `button[aria-label*="${s}" i], button[title*="${s}" i], [role="button"][aria-label*="${s}" i]`).join(',');
    let candidates = deepQueryAll(document, semaSel).filter(isVisible);
    if (candidates.length) return candidates[0];

    // 2) Icon-Buttons mit Material-Icon „play_arrow“
    const icons = deepQueryAll(document, '.mat-icon, i.material-icons, .material-icons').filter(isVisible);
    for (const ic of icons) {
      const t = (ic.innerText || ic.textContent || '').trim().toLowerCase();
      if (t === 'play_arrow' || t === 'play' || t === 'start') {
        const btn = ic.closest(BTN);
        if (btn && isVisible(btn)) return btn;
      }
    }

    // 3) Angular-Ripple in Button-Hülle
    const rip = deepQueryAll(document, 'span.ng-ripple, .ng-ripple, span.ng-ripple.animate').filter(isVisible);
    for (const r of rip) {
      const btn = r.closest(BTN);
      if (btn && isVisible(btn)) return btn;
    }

    // 4) Heuristik: sichtbare Icon-Buttons rechts unten nach dem Slider-Block
    const allBtns = deepQueryAll(document, BTN).filter(isVisible);
    // Buttons nahe der unteren 20% des Viewports bevorzugen
    const h = window.innerHeight || 0;
    const bottomBtns = allBtns.filter(b => b.getBoundingClientRect().top > h * 0.78);
    if (bottomBtns.length) return bottomBtns[0];

    return null;
  };

  const { ipcRenderer } = require("electron");
  const emitTarget = (x, y) => { try { ipcRenderer.sendToHost("mm-wro-autoplay-target", { x, y }); } catch(_) {} };

  const tryAutoplay = () => {
    try {
      if (isPlaying()) return true;       // läuft schon → nichts tun
      const btn = findPlayButton();
      if (btn) {
        const { x, y } = center(btn);
        emitTarget(x, y);
        return true;
      }
      return false;
    } catch (_) { return false; }
  };

  const init = () => { injectCSS(); tryAutoplay(); };

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('load', init);

  // SPA: auf spätes UI warten
  try {
    const mo = new MutationObserver(() => { tryAutoplay(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch(_) {}

  // Frühe Versuche (erste ~20s)
  let early = 0;
  const earlyIv = setInterval(() => {
    early++;
    init();
    if (early >= 20) clearInterval(earlyIv);
  }, 1000);

  // Extern anstoßbar (vom Host)
  window.__mmWROKick = () => { init(); };

  // Keep-Alive: nur prüfen, nicht blind klicken (der Host klickt erst nach Koordinaten)
  setInterval(() => { tryAutoplay(); }, 25000);
})();
