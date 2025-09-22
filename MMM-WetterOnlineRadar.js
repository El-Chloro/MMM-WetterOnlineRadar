/* MagicMirror² Module: MMM-WetterOnlineRadar
 * v1.1.0 — embeds ONLY the wo-cloud radar frame (no website chrome) and auto-starts the animation
 * Default: Berlin; README example uses Dresden.
 * License: MIT
 */
Module.register("MMM-WetterOnlineRadar", {
  defaults: {
    // Default Berlin center (WetterRadar)
    coords: { lat: 52.5200, lon: 13.4050 },
    zoomLevel: 8,            // wo-cloud zoom (approx 6–12)
    layer: "rain",           // rain layer for /rr/ endpoint
    reloadInterval: 15 * 60 * 1000,
    width: "560px",
    height: "360px",
    zoomCss: 1.0,            // CSS scale for fine cropping
    useWebview: true,
    blockPointer: true,
    autoPlay: true,          // versucht die Animation automatisch zu starten
    // Wenn du eine feste Frame-URL hast, kannst du die direkt setzen:
    radarFrameUrl: null,
    // UA override hilft einigen Electron-Builds
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
  },

  start() { this._timer = null; },

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
      // Web Security bleibt AN; nur UA-Override wird verwendet.
      wv.style.width = "100%";
      wv.style.height = "100%";
      wv.style.border = "0";
      wv.style.transform = `scale(${this.config.zoomCss})`;
      wv.style.transformOrigin = "0 0";
      if (this.config.blockPointer) wv.style.pointerEvents = "none";
      if (typeof wv.setUserAgentOverride === "function") {
        try { wv.setUserAgentOverride(this.config.userAgent); } catch (e) {}
      }

      // ————— Robustes Autoplay: tiefe Suche + echte Events + Keyboard-Fallbacks —————
      const tryStartJS = `
        (function() {
          const PLAY_PATTERNS = /(play|start|abspielen|animation|loop|wiedergabe|los|starten|autoplay|resume)/i;
          const ICON_PATTERNS = /[▶►⯈⏵]/;

          // Sichtbar?
          const isVisible = el => {
            if (!el) return false;
            const r = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
          };

          // Tiefe Query, inkl. Shadow-DOM
          const deepQueryAll = (root, selector, out=[]) => {
            try {
              root.querySelectorAll(selector).forEach(n => out.push(n));
            } catch(_) {}
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

          // Kandidaten sammeln
          const candidates = new Set();
          deepQueryAll(document, 'button, a, [role="button"], .icon-button, .control, .controls, .toolbar, .timeline, .leaflet-control').forEach(el => {
            const txt = textOf(el).toLowerCase();
            if (PLAY_PATTERNS.test(txt) || ICON_PATTERNS.test(txt)) candidates.add(el);
            // Material Icons?
            if (!txt && el.querySelector && (el.querySelector('svg') || el.querySelector('i.material-icons'))) candidates.add(el);
          });

          // Wenn "Pause" auftaucht, spielt die Animation bereits → nichts tun
          const pauseLike = Array.from(candidates).find(el => /pause|stopp|anhalten/i.test(textOf(el)));
          if (pauseLike && isVisible(pauseLike)) return true;

          let clicked = false;
          // sichtbare Kandidaten zuerst
          for (const el of Array.from(candidates).filter(isVisible)) {
            try { dispatchClickLike(el); clicked = true; break; } catch(_) {}
          }

          // Fallback: Timeline/Canvas fokussieren + Space/K/Enter
          if (!clicked) {
            const canvas = document.querySelector('canvas') || document.querySelector('div[role="presentation"]');
            if (canvas && isVisible(canvas)) {
              try { dispatchClickLike(canvas); } catch(_) {}
            }
            try { window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true })); } catch(_) {}
            try { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', bubbles: true })); } catch(_) {}
            try { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true })); } catch(_) {}
          }
          return true;
        })();
      `;

      const scheduleTryStart = () => {
        if (!this.config.autoPlay) return;

        // Sofort + eng getaktete Versuche (damit wir den Moment nach dem App-Init treffen)
        const burst = (count, delay) => {
          let n = 0;
          const iv = setInterval(() => {
            n++;
            try { wv.executeJavaScript(tryStartJS); } catch(e){}
            if (n >= count) clearInterval(iv);
          }, delay);
        };
        // kleine Staffelung
        setTimeout(() => { try { wv.executeJavaScript(tryStartJS); } catch(e){} }, 300);
        burst(12, 1000);   // 12x jede Sekunde
        setTimeout(() => burst(8, 1500), 1500);
        setTimeout(() => burst(6, 2000), 3000);

        // Danach Keep-Alive: alle 25s anstupsen (falls Radar pausiert)
        if (!this._keepAliveTimer) {
          this._keepAliveTimer = setInterval(() => {
            if (!this.config.autoPlay) { clearInterval(this._keepAliveTimer); this._keepAliveTimer = null; return; }
            try { wv.executeJavaScript(tryStartJS); } catch(e){}
          }, 25000);
        }
      };

      wv.addEventListener("dom-ready", () => scheduleTryStart());
      wv.addEventListener("did-finish-load", () => {
        // Scrollbar aus
        try {
          wv.executeJavaScript(`(function(){var s=document.createElement('style');s.textContent='*::-webkit-scrollbar{width:0;height:0}';document.documentElement.appendChild(s);}())`);
        } catch(e){}
        scheduleTryStart();
      });

      // Falls die App intern via History/Router neu lädt:
      wv.addEventListener("did-navigate-in-page", () => scheduleTryStart());
      wv.addEventListener("page-title-updated", () => scheduleTryStart());

      root.appendChild(wv);
      this._webview = wv;
    } else {
      // Hinweis: In iframe-Konfiguration kann kein Script in die Fremdseite injiziert werden (Same-Origin).
      // Für Autoplay bitte useWebview:true lassen.
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

  // Build the clean wo-cloud radar frame URL
  _buildRadarUrl() {
    if (this.config.radarFrameUrl) return this._cacheBusted(this.config.radarFrameUrl);

    const { coords, zoomLevel, layer } = this.config;
    const lat = (coords && typeof coords.lat === "number") ? coords.lat : 52.52;
    const lon = (coords && typeof coords.lon === "number") ? coords.lon : 13.405;

    // Compact RainRadar frame used by wetteronline.de:
    // https://radar.wo-cloud.com/desktop/rr/compact?wrx=LAT,LON&wrm=ZOOM&wry=LAT,LON
    const u = new URL("https://radar.wo-cloud.com/desktop/rr/compact");
    u.searchParams.set("wrx", `${lat.toFixed(4)},${lon.toFixed(4)}`);
    u.searchParams.set("wry", `${lat.toFixed(4)},${lon.toFixed(4)}`);
    u.searchParams.set("wrm", String(zoomLevel || 8));
    if (layer && String(layer).toLowerCase() === "rain") {
      // default for /rr/ is rain; keep as-is
    }
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
