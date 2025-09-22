/* MagicMirror² Module: MMM-WetterOnlineRadar
 * v1.6.1 — startet die WO-Radar-Animation robust (Klick, Key, Play-Zone-Fallback)
 * License: MIT
 */
Module.register("MMM-WetterOnlineRadar", {
  defaults: {
    // Standardort (Berlin) – wird von coords überschrieben:
    coords: { lat: 52.5200, lon: 13.4050 },
    zoomLevel: 8,                 // wo-cloud: 6..12 üblich
    // Optional: feste URL (überschreibt coords/zoomLevel komplett):
    url: null,

    reloadInterval: 15 * 60 * 1000,
    width: "560px",
    height: "360px",
    zoomCss: 1.0,                 // CSS-Scale (Feincropping)
    useWebview: true,             // MUSS true sein für trusted input events
    blockPointer: true,
    autoPlay: true,

    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",

    // Wie oft wir die „läuft schon?“-Prüfung + ggf. Start anstoßen:
    keepAliveMs: 25000,

    // Wieviele Startversuche in den ersten Sekunden (je 1 Sek.)?
    earlyTries: 20
  },

  start() {
    this._reloadTimer = null;
    this._keepAliveTimer = null;
    this._webview = null;
    this._earlyTryCount = 0;
    this._earlyTimer = null;
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

      // —— Trusted Input vom Host in den Webview ——
      const sendMouseClick = (x, y, clickCount = 1) => {
        try {
          wv.focus();
          wv.sendInputEvent({ type: "mouseMove", x, y, movementX: 0, movementY: 0 });
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

      // gezielter Start, wenn der Preload den Button gefunden hat
      wv.addEventListener("ipc-message", (ev) => {
        if (ev.channel === "mm-wro-autoplay-target" && this.config.autoPlay) {
          const { x, y } = ev.args[0] || {};
          if (typeof x === "number" && typeof y === "number") {
            this._checkAndStart(() => {
              // Fokus neutral setzen (Center-Klick), dann gezielt Play klicken
              this._focusCenter(sendMouseClick);
              setTimeout(() => sendMouseClick(x, y, 1), 120);
              setTimeout(() => sendKeyTap(" "), 260);   // falls Click „verschluckt“ wird
            });
          }
        }
      });

      const kickDetection = () => {
        try { wv.executeJavaScript("window.__mmWROKick && window.__mmWROKick()"); } catch (e) {}
        // zusätzlich Host-seitige Prüfung & Startsequenz
        this._checkAndStart(() => this._forceStartSequence(sendMouseClick, sendKeyTap));
      };

      wv.addEventListener("dom-ready", kickDetection);
      wv.addEventListener("did-finish-load", () => {
        try {
          wv.executeJavaScript(`(function(){var s=document.createElement('style');s.textContent='*::-webkit-scrollbar{width:0;height:0}';document.documentElement.appendChild(s);}())`);
        } catch(e){}
        kickDetection();
        // frühe, wiederholte Versuche (1x pro Sekunde)
        if (this._earlyTimer) clearInterval(this._earlyTimer);
        this._earlyTryCount = 0;
        this._earlyTimer = setInterval(() => {
          this._earlyTryCount++;
          this._checkAndStart(() => this._forceStartSequence(sendMouseClick, sendKeyTap));
          if (this._earlyTryCount >= (this.config.earlyTries|0 || 20)) {
            clearInterval(this._earlyTimer);
            this._earlyTimer = null;
          }
        }, 1000);
      });
      wv.addEventListener("did-navigate-in-page", kickDetection);
      wv.addEventListener("page-title-updated",   kickDetection);

      // Keep-Alive
      if (!this._keepAliveTimer && this.config.keepAliveMs > 0) {
        this._keepAliveTimer = setInterval(kickDetection, this.config.keepAliveMs);
      }

      root.appendChild(wv);
      this._webview = wv;
    } else {
      // Hinweis: in <iframe> sind trusted Events nicht möglich → Autoplay unsicher
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

  // —— Hilfsroutinen: „läuft schon?“ prüfen & falls nötig starten ——
  _checkAndStart(doStart) {
    if (!this._webview || !this.config.autoPlay) return;
    try {
      this._webview.executeJavaScript(
        "(window.__mmWROIsPlaying && window.__mmWROIsPlaying())"
      ).then((isPlaying) => {
        if (!isPlaying) doStart && doStart();
      }).catch(()=>{ doStart && doStart(); });
    } catch (_) { doStart && doStart(); }
  },

  _focusCenter(sendMouseClick) {
    // neutraler Klick mitten in die Karte, gibt Fokus ohne Tabs/Buttons zu treffen
    try {
      this._webview.executeJavaScript("({w:window.innerWidth,h:window.innerHeight})")
        .then(dim => {
          if (!dim) return;
          const cx = Math.floor(dim.w * 0.5);
          const cy = Math.floor(dim.h * 0.5);
          sendMouseClick(cx, cy, 1);
        }).catch(()=>{});
    } catch(_) {}
  },

  _forceStartSequence(sendMouseClick, sendKeyTap) {
    // 1) Fokus in die Karte
    this._focusCenter(sendMouseClick);

    // 2) Key-Fallback
    setTimeout(() => sendKeyTap(" "), 120);
    setTimeout(() => sendKeyTap("Enter"), 240);

    // 3) Klick in die „Play-Zone“ rechts unten (sicher weg von den Tabs)
    setTimeout(() => {
      try {
        this._webview.executeJavaScript("({w:window.innerWidth,h:window.innerHeight})")
          .then(dim => {
            if (!dim) return;
            const px = Math.floor(dim.w * 0.62);       // rechts der Mitte
            const py = Math.floor(dim.h - 28);         // Steuerleiste
            sendMouseClick(px, py, 1);
          }).catch(()=>{});
      } catch(_) {}
    }, 360);
  },

  // —— URL bauen / neu laden ——
  _buildRadarUrl() {
    if (this.config.url && typeof this.config.url === "string") {
      return this._cacheBusted(this.config.url);
    }
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
