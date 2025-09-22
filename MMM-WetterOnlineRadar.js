/* MagicMirror² Module: MMM-WetterOnlineRadar
 * v1.6.0 — lädt NUR den wo-cloud Radar-Frame und startet die Animation zuverlässig
 * Default: Berlin; Koordinaten/Zoom aus config werden korrekt beachtet.
 * License: MIT
 */
Module.register("MMM-WetterOnlineRadar", {
  defaults: {
    // Standard: Berlin
    coords: { lat: 52.5200, lon: 13.4050 },
    zoomLevel: 8,                 // wo-cloud: 6..12 üblich
    // Optional: feste URL (überschreibt coords/zoomLevel)
    url: null,

    reloadInterval: 15 * 60 * 1000,
    width: "560px",
    height: "360px",
    zoomCss: 1.0,                 // CSS-Scale (feines Cropping)
    useWebview: true,             // MUSS true sein, damit „trusted“ Input-Events gehen
    blockPointer: true,
    autoPlay: true,

    // User-Agent für robustes Laden im Electron
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",

    // Wie oft wir den Preload bitten, „schau mal ob Play nötig ist“:
    keepAliveMs: 25000
  },

  start() {
    this._reloadTimer = null;
    this._keepAliveTimer = null;
    this._webview = null;
  },

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

      // Darstellung
      wv.style.width = "100%";
      wv.style.height = "100%";
      wv.style.border = "0";
      wv.style.transform = `scale(${this.config.zoomCss})`;
      wv.style.transformOrigin = "0 0";
      if (this.config.blockPointer) wv.style.pointerEvents = "none";

      // UA-Override
      if (typeof wv.setUserAgentOverride === "function") {
        try { wv.setUserAgentOverride(this.config.userAgent); } catch (e) {}
      }

      // --- Trusted Input vom Host in den Webview ---
      const sendMouseClick = (x, y) => {
        try {
          wv.focus();
          // kleiner Hover-Impuls
          wv.sendInputEvent({ type: "mouseMove", x, y, movementX: 0, movementY: 0 });
          // echter Klick
          wv.sendInputEvent({ type: "mouseDown", x, y, button: "left", clickCount: 1 });
          wv.sendInputEvent({ type: "mouseUp",   x, y, button: "left", clickCount: 1 });
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

      // Preload meldet „hier ist der Play-Button“
      wv.addEventListener("ipc-message", (ev) => {
        if (ev.channel === "mm-wro-autoplay-target" && this.config.autoPlay) {
          const { x, y } = ev.args[0] || {};
          if (typeof x === "number" && typeof y === "number") {
            // gezielt NUR den Play-Button treffen (kein Fallback-Klick unten links mehr!)
            sendMouseClick(x, y);
            // kleiner Key-Fallback, falls der Klick mal „verschluckt“ wird
            setTimeout(() => sendKeyTap(" "), 200);
          }
        }
      });

      const kickDetection = () => {
        // Preload anstupsen: „schau mal, ob Play nötig ist“
        try { wv.executeJavaScript("window.__mmWROKick && window.__mmWROKick()"); } catch (e) {}
      };

      wv.addEventListener("dom-ready", kickDetection);
      wv.addEventListener("did-finish-load", () => {
        // Scrollbars weg
        try {
          wv.executeJavaScript(`(function(){var s=document.createElement('style');s.textContent='*::-webkit-scrollbar{width:0;height:0}';document.documentElement.appendChild(s);}())`);
        } catch(e){}
        kickDetection();
      });
      wv.addEventListener("did-navigate-in-page", kickDetection);
      wv.addEventListener("page-title-updated",   kickDetection);

      // Keep-Alive nur noch als „Kick“ (keine blinden Klicks/Keys)
      if (!this._keepAliveTimer && this.config.keepAliveMs > 0) {
        this._keepAliveTimer = setInterval(kickDetection, this.config.keepAliveMs);
      }

      root.appendChild(wv);
      this._webview = wv;
    } else {
      // Hinweis: In iframe können wir keine „trusted“ Events schicken → Autoplay unsicher
      const iframe = document.createElement("iframe");
      iframe.className = "wro-iframe";
      iframe.src = url;
      iframe.loading = "eager";
      iframe.referrerPolicy = "no-referrer";
      iframe.sandbox = "allow-scripts allow-forms allow-same-origin";
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
    // 1) explizite URL aus config hat Vorrang
    if (this.config.url && typeof this.config.url === "string") {
      return this._cacheBusted(this.config.url);
    }
    // 2) aus Koordinaten bauen (wo-cloud compact frame)
    const { coords, zoomLevel } = this.config;
    const lat = (coords && typeof coords.lat === "number") ? coords.lat : 52.52;
    const lon = (coords && typeof coords.lon === "number") ? coords.lon : 13.405;
    const zoom = typeof zoomLevel === "number" ? zoomLevel : 8;

    const u = new URL("https://radar.wo-cloud.com/desktop/rr/compact");
    u.searchParams.set("wrx", `${lat.toFixed(4)},${lon.toFixed(4)}`);
    u.searchParams.set("wry", `${lat.toFixed(4)},${lon.toFixed(4)}`);
    u.searchParams.set("wrm", String(zoom));
    return this._cacheBusted(u.toString());
  },

  _cacheBusted(url) {
    try { const u = new URL(url); u.searchParams.set("_ts", Date.now().toString()); return u.toString(); }
    catch { return url + (url.includes("?") ? "&" : "?") + "_ts=" + Date.now(); }
  },

  _scheduleReload() {
    if (this._reloadTimer) clearInterval(this._reloadTimer);
    this._reloadTimer = setInterval(() => {
      const u = this._buildRadarUrl();
      if (this._webview && typeof this._webview.loadURL === "function") this._webview.loadURL(u);
      else if (this._iframe) this._iframe.src = u;
    }, this.config.reloadInterval);
  }
});
