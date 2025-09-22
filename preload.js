// Läuft im Kontext des geladenen Inhalts (wo-cloud Radarframe empfohlen).
// Aufgabe: UI sauber halten + die Position des Play/Ripple-Buttons ermitteln
// und an den Host senden, damit dieser „echte“ Clicks (sendInputEvent) ausführt.

(() => {
  // ---- Utility ----
  const HIDE_CSS = `
    html, body { background: transparent !important; overflow: hidden !important; margin:0!important; }
    *::-webkit-scrollbar{width:0;height:0}
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

  // ---- Ziel finden & Host informieren ----
  const { ipcRenderer } = require("electron");

  const emitTarget = (x, y) => {
    try { ipcRenderer.sendToHost("mm-wro-autoplay-target", { x, y }); } catch(_) {}
  };

  const tryFindAndEmitPlay = () => {
    try {
      // 0) Läuft es schon? „Pause“ sichtbar → nichts tun
      const BTN = 'button, [role="button"], .mat-mdc-icon-button, .mat-icon-button, .icon-button, .timeline button, .controls button, .toolbar button';
      const anyPause = deepQueryAll(document, BTN)
        .some(b => /pause|stopp|anhalten/i.test(((b.innerText||b.textContent||'') + ' ' + (b.getAttribute?.('aria-label')||b.title||'')).toLowerCase()));
      if (anyPause) return true;

      // 1) Angular Material Ripple → auf den Button klicken lassen
      const RIP = 'span.ng-ripple, .ng-ripple, span.ng-ripple.animate';
      const ripples = deepQueryAll(document, RIP).filter(isVisible);
      for (const r of ripples) {
        const btn = r.closest(BTN);
        if (btn && isVisible(btn)) {
          const { x, y } = center(btn);
          emitTarget(x, y);
          return true;
        }
      }

      // 2) sonst: alle sichtbaren Buttons nach „play“-Semantik
      const playLike = (el) => {
        const txt  = (el.innerText||el.textContent||'').toLowerCase();
        const aria = ((el.getAttribute && (el.getAttribute('aria-label')||el.title)) || '').toLowerCase();
        if (/(play|start|abspielen|animation|loop|wiedergabe|starten)/i.test(txt)) return true;
        if (/(play|start|abspielen|animation|loop|wiedergabe|starten)/i.test(aria)) return true;
        if (!txt && !aria && (el.querySelector?.('svg') || el.querySelector?.('i.material-icons'))) return true;
        return false;
      };

      const btns = deepQueryAll(document, BTN).filter(isVisible);
      for (const b of btns) {
        if (playLike(b)) {
          const { x, y } = center(b);
          emitTarget(x, y);
          return true;
        }
      }

      // 3) Fallback: Timeline/Canvas-Bereich links unten grob anvisieren
      const cx = 72;
      const cy = Math.floor(window.innerHeight * 0.90);
      emitTarget(cx, cy);
      return false;
    } catch(_) {
      return false;
    }
  };

  // ---- Initialisierung & Beobachtung ----
  const kick = () => { injectCSS(); tryFindAndEmitPlay(); };

  document.addEventListener('DOMContentLoaded', kick);
  window.addEventListener('load', kick);

  // UI ist SPA → auf spätes Laden warten
  try {
    const mo = new MutationObserver((muts) => {
      const hit = muts.some(m =>
        Array.from(m.addedNodes||[]).some(n =>
          n.nodeType === 1 && (
            n.matches?.('span.ng-ripple, .ng-ripple, span.ng-ripple.animate') ||
            n.matches?.('button, [role="button"], .mat-mdc-icon-button, .mat-icon-button, .icon-button') ||
            n.querySelector?.('span.ng-ripple, .ng-ripple, span.ng-ripple.animate, button, [role="button"], .mat-mdc-icon-button, .mat-icon-button, .icon-button')
          )
        )
      );
      if (hit) tryFindAndEmitPlay();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch(_) {}

  // mehrere Startversuche am Anfang (erste 20s), dann Keep-Alive alle 25s
  let early = 0;
  const earlyIv = setInterval(() => {
    early++;
    kick();
    if (early >= 20) clearInterval(earlyIv);
  }, 1000);

  setInterval(() => kick(), 25000);
})();
