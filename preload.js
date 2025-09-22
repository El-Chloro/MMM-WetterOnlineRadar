(() => {
  const HIDE_CSS = `
    html, body { background: transparent !important; overflow: hidden !important; margin:0!important; padding:0!important; }
    header, footer, nav, aside, .wo-Header, .wo-Footer, .wo-Nav, .wo-AppInstall,
    .wo-AppBanner, .wo-MemberPrompt, .wo-LoginPrompt, .wo-Modal, .wo-Layer,
    .wo-Teaser, .wo-TeaserContainer, .teaser, .banner, .ad, .ads, .advert, .adslot,
    [id*="ad"], [class*="ad"], [id*="cookie"], [class*="cookie"],
    [id*="consent"], [class*="consent"], .cmp-ui, .cmp-container, .qc-cmp2-container,
    .modal, .popup, .overlay, .backdrop, .newsletter, .app-download, .gdpr,
    .tracking-consent, .privacy, .notice, .dialog, .wo-Toolbar, .wo-Topbar, .wo-TopNav,
    .wo-HeaderBanner, .wo-Search, .wo-Breadcrumbs, .wo-Sidebar, .sidebar, .wo-Share,
    .wo-Article, .wo-Content, .content, .text, .article
    { display: none !important; visibility: hidden !important; opacity: 0 !important; }
    #onetrust-banner-sdk, #usercentrics-root { display:none !important; }
    .__mm_fullscreen_map {
      position: fixed !important; inset: 0 !important;
      width: 100vw !important; height: 100vh !important;
      margin: 0 !important; padding: 0 !important; border: 0 !important;
      background: transparent !important; z-index: 1 !important;
    }
  `;

  const injectCSS = () => {
    if (!document.querySelector('style[data-mm-wro]')) {
      const s = document.createElement('style');
      s.type = 'text/css';
      s.setAttribute('data-mm-wro', '1');
      s.textContent = HIDE_CSS;
      (document.head || document.documentElement).appendChild(s);
    }
  };

  const expandMap = () => {
    try {
      const all = Array.from(document.querySelectorAll('div, section, main'));
      let best = null, bestArea = 0;
      for (const el of all) {
        const hasCanvas = el.querySelector('canvas');
        const cls = (el.className || '') + ' ' + (el.id || '');
        const hasMapCls = /\b(map|leaflet|radar|karte|wetterradar)\b/i.test(cls);
        if (!(hasCanvas || hasMapCls)) continue;
        const r = el.getBoundingClientRect();
        const area = r.width * r.height;
        if (area > bestArea) { bestArea = area; best = el; }
      }
      if (best) best.classList.add('__mm_fullscreen_map');
    } catch(e){}
  };

  const tryStartAnimation = () => {
    try {
      const btns = Array.from(document.querySelectorAll('button, a, [role="button"]'));
      for (const el of btns) {
        const txt = (el.innerText || el.getAttribute('aria-label') || el.title || '').toLowerCase();
        if (/play|start|abspielen|animation|loop|wiedergabe|los/.test(txt)) {
          el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          break;
        }
      }
    } catch(e){}
  };

  const removeFixedOverlays = () => {
    try {
      for (const el of Array.from(document.querySelectorAll('div, section, aside, dialog'))) {
        const cs = getComputedStyle(el);
        if ((cs.position === 'fixed' || cs.position === 'sticky') && parseInt(cs.zIndex || '0', 10) > 20) {
          if (el.querySelector('canvas')) continue;
          el.style.display = 'none'; el.style.visibility = 'hidden';
        }
      }
    } catch(e){}
  };

  const init = () => { injectCSS(); expandMap(); tryStartAnimation(); removeFixedOverlays(); };
  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('load', init);
  const mo = new MutationObserver(init);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(init, 3000);
})();
