/* MagicMirror² Module: MMM-WetterOnlineRadar
 * v1.7.0 — Start erst nach 10s, zuverlässiger Play-Klick weit rechts,
 * kein Dauergeklicke, Reload alle 5 Min (konfigurierbar).
 * License: MIT
 */
Module.register("MMM-WetterOnlineRadar", {
  defaults: {
    // Standardort (Berlin) – wird von coords überschrieben:
    coords: { lat: 52.5200, lon: 13.4050 },
    zoomLevel: 8,                     // wo-cloud: 6..12 üblich
    // Optional: feste URL (überschreibt coords/zoomLevel komplett):
    url: null,

    // Lade-/Darstellungs-Optionen
    reloadInterval: 5 * 60 * 1000,    // <- NUR alle 5 Minuten neu laden
    width: "560px",
    height: "360px",
    zoomCss: 1.0,                     // CSS-Scale (Feincropping)
    useWebview: true,                 // MUSS true sein für trusted input events
    blockPointer: true,
    autoPlay: true,

    // Klick-Tuning (Play-Zone-Fallback)
    playZoneXFactor: 0.86,            // weiter rechts (0.86 ~ rechts unten)
    playZoneBottomOffset: 26,         // Y = Höhe - Offset

    // User-Agent für robustes Laden im Electron
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",

    // keine Keep-Alive-Kicks mehr
    keepAliveMs: 0,

    // Verzögerung bis zum ersten Startversuch NACH dem Laden (ms)
    firstStartDelay: 10000
  },

  start() {
    this._reloadTimer = null;
    this._webview = null;
    this._iframe  = null;
    this._firstStartTimer = null;
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
      Object.assign(wv.style, {
        width: "100%",
        height: "100%",
        border: "0",
        transform: `scale(${this.config.zoomCss})`,
        transformOrigin: "0 0"
      });
      if (this.config.blockPointer) wv.style.pointerEvents = "none";

      // UA-Override
      if (typeof wv.setUserAgentOverride === "function") {
        try { wv.setUserAgentOverride(this.config.userAgent); } catch (e) {}
      }

      // trusted Input in den Webview
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

      // Preload meldet Koordinaten des echten Play-Buttons, wenn wir ihn anfordern
      wv.addEventListener("ipc-message", (ev) => {
        if (ev.channel === "mm-wro-autoplay-target" && this.config.autoPlay) {
          const { x, y } = ev.args[0] || {};
          if (typeof x === "number" && typeof y === "number") {
            this._checkAndStart(() => {
              // 1) neutraler Fokus-Klick in die Kartenmitte
              this._focusCenter(sendMouseClick);
              // 2) gezielter Klick auf Play
              setTimeout(() => sendMouseClick(x, y, 1), 140);
            });
          }
        }
      });

      const scheduleFirstStart = () => {
        if (this._firstStartTimer) clearTimeout(this._firstStartTimer);
        this._firstStartTimer = setTimeout(() => {
          // Prüfen & starten – EINMALIG nach 10s
          this._checkAndStart(async () => {
            // 1) erst den Preload bitten, die Koordinaten zu schicken
            try {
              await wv.executeJavaScript("window.__mmWROEmitPlayTarget && window.__mmWROEmitPlayTarget()");
            } catch(_) {}

            // 2) kleine Gnadenfrist, dann prüfen und ggf. Fallback-Klick/Key
            setTimeout(() => {
              this._checkAndStart(() => this._forceStartFallback(sendMouseClick, sendKeyTap));
            }, 500);
          });
        }, Math.max(0, this.config.firstStartDelay|0));
      };

      wv.addEventListener("did-finish-load", () => {
        // Scrollbars weg
        try {
          wv.executeJavaScript(`(function(){var s=document.createElement('style');s.textContent='*::-webkit-scrollbar{width:0;height:0}';document.documentElement.appendChild(s);}())`);
        } catch(e){}
        scheduleFirstStart();
      });

      // Keine dauerhaften Keep-Alive-Kicks mehr.
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
      Object.assign(iframe.style, {
        width: "100%",
        height: "100%",
        border: "0",
        transform: `scale(${this.config.zoomCss})`,
        transformOrigin: "0 0"
      });
      if (this.config.blockPointer) iframe.style.pointerEvents = "none";
      root.appendChild(iframe);
      this._iframe = iframe;
    }

    this._scheduleReload();
    return root;
  },

  // —— Prüfen „läuft schon?“ & ggf. starten ——
  _checkAndStart(doStart) {
    if (!this._webview || !this.config.autoPlay) return;
    try {
      this._webview.executeJavaScript(
        "(window.__mmWROIsPlaying && window.__mmWROIsPlaying())"
      ).then((isPlaying) => {
        if (!isPlaying) doStart && doStart();
      }).catch(() => { doStart && doStart(); });
    } catch (_) { doStart && doStart(); }
  },

  _focusCenter(sendMouseClick) {
    try {
      this._webview.executeJavaScript("({w:window.innerWidth,h:window.innerHeight})")
        .then(dim => {
          if (!dim) return;
          const cx = Math.floor(dim.w * 0.5);
          const cy = Math.floor(dim.h * 0.5);
          sendMouseClick(cx, cy, 1); // Fokus ohne Tabs/Buttons zu treffen
        }).catch(()=>{});
    } catch(_) {}
  },

  _forceStartFallback(sendMouseClick, sendKeyTap) {
    // 1) Fokus in die Karte
    this._focusCenter(sendMouseClick);

    // 2) Klick in die „Play-Zone“ deutlich rechts unten (nicht auf Tabs!)
    setTimeout(() => {
      try {
        const xf = Math.min(0.98, Math.max(0.60, Number(this.config.playZoneXFactor) || 0.86));
        const yOff = Math.max(8, Number(this.config.playZoneBottomOffset) || 26);
        this._webview.executeJavaScript("({w:window.innerWidth,h:window.innerHeight})")
          .then(dim => {
            if (!dim) return;
            const px = Math.floor(dim.w * xf);       // weiter rechts
            const py = Math.floor(dim.h - yOff);     // an der Steuerleiste
            sendMouseClick(px, py, 1);
          }).catch(()=>{});
      } catch(_) {}
    }, 150);

    // 3) Taste Space/Enter als Reserve
    setTimeout(() => sendKeyTap(" "), 320);
    setTimeout(() => sendKeyTap("Enter"), 440);
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
      // nach jedem Reload wieder 10s warten und EINMAL starten
      if (this._webview) {
        this._webview.addEventListener("did-finish-load", () => {
          if (this._firstStartTimer) clearTimeout(this._firstStartTimer);
          this._firstStartTimer = setTimeout(() => {
            this._checkAndStart(async () => {
              try {
                await this._webview.executeJavaScript("window.__mmWROEmitPlayTarget && window.__mmWROEmitPlayTarget()");
              } catch(_) {}
              setTimeout(() => {
                this._checkAndStart(() => this._forceStartFallback(
                  (x,y,c)=>{ try {
                    this._webview.focus();
                    this._webview.sendInputEvent({ type:"mouseMove", x, y, movementX:0, movementY:0 });
                    this._webview.sendInputEvent({ type:"mouseDown", x, y, button:"left", clickCount:c||1 });
                    this._webview.sendInputEvent({ type:"mouseUp",   x, y, button:"left", clickCount:c||1 });
                  } catch(e){}; },
                  (k)=>{ try {
                    this._webview.focus();
                    this._webview.sendInputEvent({ type:"keyDown", keyCode:k });
                    this._webview.sendInputEvent({ type:"char",    keyCode:k });
                    this._webview.sendInputEvent({ type:"keyUp",   keyCode:k });
                  } catch(e){}; }
                ));
              }, 500);
            });
          }, Math.max(0, this.config.firstStartDelay|0));
        }, { once: true });
      }
    }, this.config.reloadInterval);
  }
});
