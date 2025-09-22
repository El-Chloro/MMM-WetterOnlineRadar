/* MagicMirror² Module: MMM-WetterOnlineRadar
 * v1.5.0 — loads ONLY the wo-cloud radar frame and reliably auto-starts the animation
 * Default: Berlin; README example uses Dresden.
 * License: MIT
 */
Module.register("MMM-WetterOnlineRadar", {
  defaults: {
    // Default Berlin center
    coords: { lat: 52.5200, lon: 13.4050 },
    zoomLevel: 8,                 // wo-cloud zoom (approx 6–12)
    layer: "rain",                // /rr/ uses rain layer
    reloadInterval: 15 * 60 * 1000,
    width: "560px",
    height: "360px",
    zoomCss: 1.0,                 // CSS scale for fine cropping (e.g. 1.06)
    useWebview: true,
    blockPointer: true,           // UI bleibt „touchless“; interne Klicks laufen trotzdem
    autoPlay: true,
    radarFrameUrl: null,          // optional: feste URL statt Koordinatenaufbau
    // UA override hilft einigen Electron-Builds
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
  },

  start() { this._timer = null; this._keepAliveTimer = null; },

  getStyles() { return [this.file("styles.css")]; },

  getDom() {
    const root = document.createElement("div");
    root.className = "wro-wrapper";
    root.style.width = this.config.width;
    root.style.height = this.config.height;
    root.style.overflow = "hidden";

    const url = this._buildRadarUrl();

    if (this.config.useWebview) {
      const wv = document.createElement("webview");
      wv.className = "wro-webview";
      wv.setAttribute("src", url);
      wv.setAttribute("preload", this.file("preload.js"));
      wv.setAttribute("partition", "persist:mmm-wro");
      wv.setAttribute("allowpopups", "false");
      // Größe/Skalierung
      wv.style.width = "100%";
      wv.style.height = "100%";
      wv.style.border = "0";
      wv.style.transform = `scale(${this.config.zoomCss})`;
      wv.style.transformOrigin = "0 0";
      if (this.config.blockPointer) wv.style.pointerEvents = "none";

      // UA-Override (falls von Electron unterstützt)
      if (typeof wv.setUserAgentOverride === "function") {
        try { wv.setUserAgentOverride(this.config.userAgent); } catch (e) {}
      }

      // Autoplay-Skript, das gezielt Ripple → Button trifft (inkl. Shadow-DOM)
      const tryStartJS = `
        (function() {
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
            // 1) auf Button-Mitte
            tryPoint(bx, by);
            // 2) falls Ripple da: zusätzlich dort klicken
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
            // Ikonische Buttons ohne Text → oft SVG oder Material-Icon
            if (!txt && !aria) {
              if (el.querySelector && (el.querySelector('svg') || el.querySelector('i.material-icons'))) return true;
            }
            return false;
          };

          // Falls bereits „Pause“ sichtbar ist, läuft die Animation schon
          const anyPause = deepQueryAll(document, SEL_BTN)
            .some(b => /pause|stopp|anhalten/i.test((b.innerText||b.textContent||'') + ' ' + ((b.getAttribute && (b.getAttribute('aria-label')||b.title))||'')));
          if (anyPause) return true;

          // 1) Ripple finden → nächster Button-Vorfahr
          const ripples = deepQueryAll(document, SEL_RIPPLE).filter(isVisible);
          for (const r of ripples) {
            const btn = r.closest(SEL_BTN);
            if (btn && isVisible(btn)) { dispatchCombo(btn, r); return true; }
          }

          // 2) Sonstige Play-Buttons probieren (sichtbar, „play-like“)
          const btns = deepQueryAll(document, SEL_BTN).filter(isVisible);
          for (const b of btns) {
            if (playLike(b)) { dispatchCombo(b, null); return true; }
          }

          // 3) Fallback: Canvas/Timeline anstubsen + Keys (Space / Enter)
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
        })();
      `;

      const scheduleTryStart = () => {
        if (!this.config.autoPlay) return;

        const burst = (count, delay) => {
          let n = 0;
          const iv = setInterval(() => {
            n++;
            try { wv.executeJavaScript(tryStartJS); } catch(e){}
            if (n >= count) clearInterval(iv);
          }, delay);
        };

        // gestaffelte „frühe“ Versuche (Angular UI kommt stückweise)
        setTimeout(() => { try { wv.executeJavaScript(tryStartJS); } catch(e){} }, 200);
        burst(12, 800);            // ~10s
        setTimeout(() => burst(10, 1200), 3000);
        setTimeout(() => burst(6, 2000), 8000);

        // Keep-Alive: alle 25s (Radar pausiert gelegentlich)
        if (!this._keepAliveTimer) {
          this._keepAliveTimer = setInterval(() => {
            if (!this.config.autoPlay) { clearInterval(this._keepAliveTimer); this._keepAliveTimer = null; return; }
            try { wv.executeJavaScript(tryStartJS); } catch(e){}
          }, 25000);
        }
      };

      wv.addEventListener("dom-ready", () => scheduleTryStart());
      wv.addEventListener("did-finish-load", () => {
        // Scrollbars weg
        try {
          wv.executeJavaScript(`(function(){var s=document.createElement('style');s.textContent='*::-webkit-scrollbar{width:0;height:0}';document.documentElement.appendChild(s);}())`);
        } catch(e){}
        scheduleTryStart();
      });
      wv.addEventListener("did-navigate-in-page", () => scheduleTryStart());
      wv.addEventListener("page-title-updated", () => scheduleTryStart());

      root.appendChild(wv);
      this._webview = wv;
    } else {
      // Achtung: In iframe kann kein fremdes DOM gescriptet werden → Autoplay unsicher
      const iframe = document.createElement("iframe");
      iframe.className = "wro-iframe";
      iframe.src = url;
      iframe.loading = "eager";
      iframe.sandbox = "allow-scripts allow-same-origin allow-forms";
      iframe.referrerPolicy = "no-referrer";
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.border = "0";
      iframe.style.transform = `scale(${this.config.zoomCss})`;
      iframe.style.transformOrigin = "0 0";
      if (this.config.blockPointer) iframe.style.pointerEvents = "none";
      root.appendChild(iframe);
      this._iframe = iframe;
    }

    this._scheduleReload();
    return root;
  },

  _buildRadarUrl() {
    if (this.config.radarFrameUrl) return this._cacheBusted(this.config.radarFrameUrl);

    const { coords, zoomLevel } = this.config;
    const lat = (coords && typeof coords.lat === "number") ? coords.lat : 52.52;
    const lon = (coords && typeof coords.lon === "number") ? coords.lon : 13.405;

    // Wo-Cloud compact frame:
    // https://radar.wo-cloud.com/desktop/rr/compact?wrx=LAT,LON&wrm=ZOOM&wry=LAT,LON
    const u = new URL("https://radar.wo-cloud.com/desktop/rr/compact");
    u.searchParams.set("wrx", `${lat.toFixed(4)},${lon.toFixed(4)}`);
    u.searchParams.set("wry", `${lat.toFixed(4)},${lon.toFixed(4)}`);
    u.searchParams.set("wrm", String(zoomLevel || 8));
    return this._cacheBusted(u.toString());
  },

  _cacheBusted(url) {
    try {
      const u = new URL(url);
      u.searchParams.set("_ts", String(Date.now()));
      return u.toString();
    } catch (e) {
      return url + (url.includes("?") ? "&" : "?") + "_ts=" + Date.now();
    }
  },

  _scheduleReload() {
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => {
      const u = this._buildRadarUrl();
      if (this._webview && typeof this._webview.loadURL === "function") this._webview.loadURL(u);
      else if (this._iframe) this._iframe.src = u;
    }, this.config.reloadInterval);
  }
});
