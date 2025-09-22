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

  // Versucht die Animation im wo-cloud Frame zu starten
  const tryStartAnimation = () => {
    try {
      // 1) Buttons mit Play/Start/Abspielen/Animation etc. suchen
      const nodes = Array.from(document.querySelectorAll('button, a, [role="button"], .icon-button, .control, .controls, .toolbar, .timeline, .leaflet-control'));
      const isPlay = el => {
        const t = (el.innerText || el.textContent || '').toLowerCase();
        const a = ((el.getAttribute('aria-label') || el.title) || '').toLowerCase();
        return /(play|start|abspielen|animation|loop|wiedergabe|los)/.test(t) || /(play|start|abspielen|animation|loop|wiedergabe|los)/.test(a);
      };
      let clicked = false;
      for (const el of nodes) {
        if (isPlay(el)) {
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          clicked = true;
          break;
        }
      }
      // 2) Fallback: Canvas fokussieren + SPACE
      if (!clicked) {
        const canvas = document.querySelector('canvas');
        if (canvas) {
          try { canvas.dispatchEvent(new MouseEvent('click', { bubbles: true })); } catch(e){}
        }
        try { window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true })); } catch(e){}
      }
    } catch (e) { /* ignore */ }
  };

  const init = () => { injectCSS(); tryStartAnimation(); };

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('load', init);

  // Mehrfach in den ersten Sekunden + dann regelmäßig
  let earlyTries = 0;
  const early = setInterval(() => {
    earlyTries++;
    init();
    if (earlyTries >= 10) clearInterval(early);
  }, 1500);

  setInterval(() => { tryStartAnimation(); }, 30000);
})();
