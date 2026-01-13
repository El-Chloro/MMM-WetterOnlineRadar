// Läuft im Kontext des WO-Radarframes.
// Keine Autosuche/Autoklicks ohne Anforderung. Stellt nur Hilfsfunktionen bereit:
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
    wo-desktop-compact,
    wo-desktop-compact *,
    wo-control-container,
    wo-control-container *,
    wo-base-control,
    wo-base-control *,
    wo-info-label,
    wo-info-label *,
    wo-layer-toggle,
    wo-layer-toggle *,
    wo-play-pause-control,
    wo-play-pause-control *,
    wo-time-label,
    wo-time-label *,
    wo-toggle,
    wo-toggle *,
    wo-controls,
    wo-controls *,
    wo-time-control,
    wo-time-control *,
    .btn,
    .btn * {
      --control-background: #111 !important;
      --control-active-background: #222 !important;
      --control-border: 1px solid #111 !important;
      --control-border-radius: 2px !important;
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
      accent-color: #111 !important;
      color: #fff !important;
    }

    wo-control-container.bottom,
    wo-control-container.bottom *,
    wo-logo,
    wo-logo *,
    wo-info-label,
    wo-info-label * {
      background-color: #111 !important;
      border-color: #111 !important;
      color: #fff !important;
    }

    .btn,
    .btn.secondary,
    .btn.quarterly,
    wo-control-container button,
    wo-control-container a,
    wo-control-container .btn,
    wo-base-control,
    wo-base-control button,
    wo-base-control .main,
    wo-base-control .date,
    wo-layer-toggle button,
    wo-layer-toggle .btn,
    wo-play-pause-control button,
    wo-time-label,
    wo-time-label .main,
    wo-time-label .date,
    wo-toggle button,
    wo-toggle .btn,
    wo-desktop-compact .controls button,
    wo-desktop-compact .controls .btn {
      background-color: #111 !important;
      border-color: #111 !important;
      color: #fff !important;
      box-shadow: none !important;
    }

    .btn:hover,
    .btn:active,
    wo-control-container button:hover,
    wo-control-container button:active,
    wo-layer-toggle button:hover,
    wo-layer-toggle button:active,
    wo-play-pause-control button:hover,
    wo-play-pause-control button:active,
    wo-toggle button:hover,
    wo-toggle button:active {
      background-color: #222 !important;
      border-color: #222 !important;
      color: #fff !important;
    }

    .btn.disabled,
    .btn.secondary.disabled,
    .btn.quarterly.disabled,
    wo-control-container button[disabled],
    wo-control-container button[aria-disabled="true"],
    wo-play-pause-control button[disabled],
    wo-play-pause-control button[aria-disabled="true"] {
      background-color: #2a2a2a !important;
      border-color: #2a2a2a !important;
      color: #999 !important;
    }

    wo-time-control-slider .fill {
      background: #333 !important;
    }

    wo-time-control-slider .knob,
    wo-time-control-slider .knob:before {
      background: #fff !important;
      border-color: #fff !important;
    }

    svg [fill="#10658e"],
    svg [fill="#00537f"],
    svg [fill="#27759c"],
    svg [stroke="#10658e"],
    svg [stroke="#00537f"],
    svg [stroke="#27759c"],
    svg [fill="#003959"],
    svg [stroke="#003959"] {
      fill: #fff !important;
      stroke: #fff !important;
    }


    .item[_ngcontent-ng-c1920928032] {
      display: flex !important;
      justify-content: center !important;
      align-items: center !important;
      width: 70px !important;
      border-right: 1px solid #333 !important;
      box-sizing: content-box !important;
      overflow: hidden !important;
    }

    [_nghost-ng-c3042192997] {
      background: center no-repeat !important;
      background-color: #111 !important;
      height: 100% !important;
      color: #fff !important;
      display: flex !important;
      justify-content: center !important;
      align-items: center !important;
      min-width: 40px !important;
    }

    wo-logo[_ngcontent-ng-c3097851228],
    wo-control-container[_ngcontent-ng-c3097851228],
    wo-info-label[_ngcontent-ng-c3097851228] {
      --control-border-radius: 2px !important;
      --control-background: #111 !important;
      --control-active-background: #333 !important;
      --control-active-font-weight: 500 !important;
      --control-border: #333 !important;
      --zoom-icon-size: 36px !important;
      --layer-toggle-icon-size: 28px !important;
      --play-icon-size: 16px !important;
      --pause-icon-size: 14px !important;
      --stop-icon-size: 18px !important;
      --time-label-width: auto !important;
      --time-label-height: 40px !important;
      --control-margin: 8px !important;
    }

  `;



  const injectCSS = () => {
    try {
      const existing = document.querySelector('style[data-mm-wro]');
      if (existing) {
        existing.textContent = HIDE_CSS;
        return;
      }
      const s = document.createElement('style');
      s.type = 'text/css';
      s.setAttribute('data-mm-wro','1');
      s.textContent = HIDE_CSS;
      (document.head || document.documentElement).appendChild(s);
    } catch(_) {}
  };

  const scheduleCssRefresh = () => {
    try {
      if (window.__mmWROCssRefreshTimer) clearTimeout(window.__mmWROCssRefreshTimer);
      window.__mmWROCssRefreshTimer = setTimeout(injectCSS, 10000);
    } catch(_) {
      setTimeout(injectCSS, 10000);
    }
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

  let ipcRenderer = null;
  try {
    ({ ipcRenderer } = require("electron"));
  } catch (_) {
    ipcRenderer = null;
  }
  const emitTarget = (x, y) => {
    try {
      if (ipcRenderer && typeof ipcRenderer.sendToHost === "function") {
        ipcRenderer.sendToHost("mm-wro-autoplay-target", { x, y });
      }
    } catch(_) {}
  };

  // —— Exporte ins Host-Fenster ——
  window.__mmWROIsPlaying = () => { try { return !!isPlaying(); } catch(_) { return false; } };

  window.__mmWROEmitPlayTarget = () => {
    try {
      injectCSS();
      scheduleCssRefresh();
      if (isPlaying()) return false;
      const btn = findPlayButton();
      if (!btn) return false;
      const { x, y } = center(btn);
      emitTarget(x, y);
      return true;
    } catch (_) { return false; }
  };

  window.__mmWROAutoPlay = () => {
    try {
      injectCSS();
      scheduleCssRefresh();
      if (isPlaying()) return true;
      const btn = findPlayButton();
      if (!btn) return false;
      try { btn.click(); } catch(_) {}
      return true;
    } catch (_) { return false; }
  };

  window.__mmWROKick = () => { injectCSS(); scheduleCssRefresh(); return true; };

  // gleich zu Beginn CSS setzen
  const initialCss = () => {
    injectCSS();
    scheduleCssRefresh();
  };

  document.addEventListener('DOMContentLoaded', initialCss);
  window.addEventListener('load', initialCss);
})();
