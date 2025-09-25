// Läuft im Kontext des WO-Radarframes.
// Keine Autosuche/Autoklicks mehr. Stellt nur Hilfsfunktionen bereit:
//  - __mmWROIsPlaying():  true/false
//  - __mmWROEmitPlayTarget(): findet den Play-Button (auch Shadow DOM) und sendet Koordinaten
//  - __mmWROKick(): nur für evtl. spätere Zwecke (CSS erneut setzen).

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
    :root,
    body,
    .wo-RadarFrame,
    .wo-RadarFrame * {
      --wo-color-primary: #111 !important;
      --wo-color-primary-rgb: 17,17,17 !important;
      --wo-color-accent: #111 !important;
      --mdc-theme-primary: #111 !important;
      --mdc-theme-on-primary: #fff !important;
      --mdc-filled-button-container-color: #111 !important;
      --mdc-filled-button-label-text-color: #fff !important;
      --mdc-outlined-button-outline-color: #111 !important;
      --mdc-protected-button-container-color: #111 !important;
      --mdc-protected-button-label-text-color: #fff !important;
      --mdc-slider-active-track-color: #111 !important;
      --mdc-slider-inactive-track-color: #111 !important;
      --mdc-slider-focus-handle-color: #111 !important;
      --mdc-slider-hover-handle-color: #111 !important;
      --mdc-slider-pressed-handle-color: #111 !important;
      --mdc-slider-handle-color: #fff !important;
      accent-color: #111 !important;
    }
    .wo-RadarFrame .timeline,
    .wo-RadarFrame .timeline *,
    .wo-RadarFrame .controls,
    .wo-RadarFrame .controls *,
    .wo-RadarFrame .toolbar,
    .wo-RadarFrame .toolbar *,
    .wo-RadarFrame .mat-mdc-slider,
    .wo-RadarFrame .mat-mdc-slider *,
    .wo-RadarFrame button,
    .wo-RadarFrame [role="button"] {
      background-color: #111 !important;
      border-color: #111 !important;
      color: #fff !important;
      box-shadow: none !important;
    }
    .wo-RadarFrame .mat-mdc-slider .mdc-slider__track--active_fill,
    .wo-RadarFrame .mat-mdc-slider .mdc-slider__track--inactive,
    .wo-RadarFrame .mat-mdc-slider .mdc-slider__track--inactive::after {
      background-color: #111 !important;
      border-color: #111 !important;
    }
    .wo-RadarFrame .mat-mdc-slider .mdc-slider__thumb,
    .wo-RadarFrame .mat-mdc-slider .mdc-slider__focus-ring {
      background-color: #fff !important;
      border-color: #fff !important;
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

  // —— Exporte ins Host-Fenster ——
  window.__mmWROIsPlaying = () => { try { return !!isPlaying(); } catch(_) { return false; } };

  window.__mmWROEmitPlayTarget = () => {
    try {
      injectCSS();
      if (isPlaying()) return false;
      const btn = findPlayButton();
      if (!btn) return false;
      const { x, y } = center(btn);
      emitTarget(x, y);
      return true;
    } catch (_) { return false; }
  };

  window.__mmWROKick = () => { injectCSS(); return true; };

  // gleich zu Beginn CSS setzen; KEINE Autoklicks!
  document.addEventListener('DOMContentLoaded', injectCSS);
  window.addEventListener('load', injectCSS);
})();
