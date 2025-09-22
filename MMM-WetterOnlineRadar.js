/* MagicMirror² Module: MMM-WetterOnlineRadar
 * Auto-starts WetterOnline radar animation using trusted input events.
 * Default view = Berlin; set your own URL if needed (prefer the wo-cloud frame).
 * License: MIT
 */

Module.register("MMM-WetterOnlineRadar", {
  defaults: {
    // Empfohlen: direkt den "wo-cloud" Frame nutzen (Animation-UI im selben Origin)
    // Default: Berlin
    url: "https://radar.wo-cloud.com/desktop/rr/compact?wrx=52.5200,13.4050&wrm=8&wry=52.5200,13.4050",
    // Alle 15 Minuten neu laden
    reloadInterval: 15 * 60 * 1000,
    // Modulgröße
    width: "560px",
    height: "360px",
    // optionales Zoomen (CSS-Scale, nicht Karten-Zoom)
    zoom: 1.0,
    // <webview> benutzen (empfohlen, nötig für echte Input-Events)
    useWebview: true,
    // Pointer in MM sperren (wir schicken Events trotzdem „von außen“)
    blockPointer: true,
    // Force Desktop UA
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    // Wie energisch wir starten
    autoPlay: true,
    // Keep-Alive: Animation regelmäßig „anstupsen“
    keepAliveMs: 25000
  },

  start() {
    this._reloadTimer = null;
    this._keepAliveTimer = null;
    this._webview = null;
  },

  getStyles() {
    return [this.file("styles.css")];
  },

  getDom() {
    const wrapper = document.createElement("div");
    wrapper.className = "wro-wrapper";
    wrapper.style.width = this.config.width;
    wrapper.style.height = this.config.height;
    wrapper.style.overflow = "hidden";

    const url = this._cacheBustedUrl();

    if (this.config.useWebview) {
      const wv = document.createElement("webview");
      wv.className = "wro-webview";
      wv.setAttribute("src", url);
      wv.setAttribute("preload", this.file("preload.js"));
      wv.setAttribute("partition", "persist:mmm-wro");
      wv.setAttribute("allowpopups", "false");
      // Größe / Darstellung
      wv.style.width = "100%";
      wv.style.height = "100%";
      wv.style.border = "0";
      wv.style.transform = `scale(${this.config.zoom})`;
      wv.style.transformOrigin = "0 0";
      if (this.config.blockPointer) wv.style.pointerEvents = "none";

      // UA-Override
      if (typeof wv.setUserAgentOverride === "function") {
        try { wv.setUserAgentOverride(this.config.userAgent); } catch (e) {}
      }

      // --- trusted input helpers ---
      const sendMouseClick = (x, y, clickCount = 1) => {
        try {
          wv.focus();
          // kleine Bewegung davor (manche UIs reagieren erst auf hover)
          wv.sendInputEvent({ type: "mouseMove", x, y, movementX: 0, movementY: 0 });
          // echte Klicks
          wv.sendInputEvent({ type: "mouseDown", x, y, button: "left", clickCount });
          wv.sendInputEvent({ type: "mouseUp",   x, y, button: "left", clickCount });
        } catch (e) {}
      };

      const sendKeyTap = (key) => {
        try {
          wv.focus();
          wv.sendInputEvent({ type: "keyDown", keyCode: key });
          wv.sendInputEvent({ type: "char",    keyCode: key });
          wv.sendInputEvent({ type: "keyUp",   keyCode: key });
        } catch (e) {}
      };

      // IPC: Preload meldet Zielkoordinaten der Play-Schaltfläche
      wv.addEventListener("ipc-message", (ev) => {
        if (ev.channel === "mm-wro-autoplay-target" && this.config.autoPlay) {
          const { x, y } = ev.args[0] || {};
          if (typeof x === "number" && typeof y === "number") {
            // mehrere Impulse, um „Ripple + Button“ sicher zu treffen
            sendMouseClick(x, y, 1);
            setTimeout(() => sendMouseClick(x, y, 1), 180);
            setTimeout(() => sendMouseClick(x, y, 2), 420); // Doppelklick
            // und zusätzlich Space/Enter als Fallback
            setTimeout(() => sendKeyTap(" "), 580);
            setTimeout(() => sendKeyTap("Enter"), 760);
          }
        }
      });

      const scheduleAutoPlayBurst = () => {
        if (!this.config.autoPlay) return;
        // Falls Preload nichts meldet (z. B. UI sehr spät),
        // tippen wir in die typische Timeline-Ecke (links unten)
        const pokeFallback = () => {
          // Koordinaten „ungefähr“: 72 px vom linken Rand, 90% Höhe
          const ex = 72, eyPct = 0.90;
          wv.executeJavaScript(`({w:window.innerWidth,h:window.innerHeight})`).then(dim => {
            if (!dim) return;
            const y = Math.floor(dim.h * eyPct);
            sendMouseClick(ex, y, 1);
            setTimeout(() => sendMouseClick(ex, y, 1), 200);
            setTimeout(() => sendKeyTap(" "), 400);
          }).catch(()=>{});
        };
        // mehrere Versuche in den ersten Sekunden
        const attempts = [200, 800, 1600, 2600, 3800, 5200, 7000, 9000, 12000];
        attempts.forEach((ms, i) => setTimeout(() => pokeFallback(), ms));
      };

      // Events aus dem Webview – früh und oft anstoßen
      wv.addEventListener("dom-ready", () => scheduleAutoPlayBurst());
      wv.addEventListener("did-finish-load", () => {
        // Scrollbars entfernen
        try {
          wv.executeJavaScript(`
            (function(){
              var s=document.createElement('style');
              s.textContent='*::-webkit-scrollbar{width:0;height:0}';
              document.documentElement.appendChild(s);
            })();
          `);
        } catch(e){}
        scheduleAutoPlayBurst();
      });
      wv.addEventListener("did-navigate-in-page", () => scheduleAutoPlayBurst());
      wv.addEventListener("page-title-updated",   () => scheduleAutoPlayBurst());

      // Keep-alive: Animation in Intervallen wieder „anstoßen“
      if (!this._keepAliveTimer && this.config.keepAliveMs > 0) {
        this._keepAliveTimer = setInterval(() => scheduleAutoPlayBurst(), this.config.keepAliveMs);
      }

      wrapper.appendChild(wv);
      this._webview = wv;
    } else {
      // <iframe> – hier sind echte Input-Events NICHT möglich (Autoplay unsicher)
      const iframe = document.createElement("iframe");
      iframe.className = "wro-iframe";
      iframe.src = url;
      iframe.loading = "eager";
      iframe.referrerPolicy = "no-referrer";
      iframe.sandbox = "allow-scripts allow-forms allow-same-origin";
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.border = "0";
      iframe.style.transform = `scale(${this.config.zoom})`;
      iframe.style.transformOrigin = "0 0";
      if (this.config.blockPointer) iframe.style.pointerEvents = "none";
      wrapper.appendChild(iframe);
      this._iframe = iframe;
    }

    this._scheduleReload();
    return wrapper;
  },

  _scheduleReload() {
    if (this._reloadTimer) clearInterval(this._reloadTimer);
    this._reloadTimer = setInterval(() => {
      const u = this._cacheBustedUrl();
      if (this._webview && typeof this._webview.loadURL === "function") this._webview.loadURL(u);
      else if (this._iframe) this._iframe.src = u;
    }, this.config.reloadInterval);
  },

  _cacheBustedUrl() {
    try {
      const url = new URL(this.config.url);
      url.searchParams.set("_ts", String(Date.now()));
      return url.toString();
    } catch (e) {
      return this.config.url + (this.config.url.includes("?") ? "&" : "?") + "_ts=" + Date.now();
    }
  }
});
