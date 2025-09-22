/* MagicMirror² Module: MMM-WetterOnlineRadar
 * v1.1.0 — embeds ONLY the wo-cloud radar frame (no website chrome)
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
    // If you know exactly which frame URL you want, set radarFrameUrl and it will be used as-is.
    radarFrameUrl: null,
    // UA override helps some Electron builds
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
      // Keep web security ON; only UA override is used.
      wv.style.width = "100%";
      wv.style.height = "100%";
      wv.style.border = "0";
      wv.style.transform = `scale(${this.config.zoomCss})`;
      wv.style.transformOrigin = "0 0";
      if (this.config.blockPointer) wv.style.pointerEvents = "none";
      if (typeof wv.setUserAgentOverride === "function") {
        try { wv.setUserAgentOverride(this.config.userAgent); } catch (e) {}
      }
      wv.addEventListener("did-finish-load", () => {
        try {
          wv.executeJavaScript(`(function(){var s=document.createElement('style');s.textContent='*::-webkit-scrollbar{width:0;height:0}';document.documentElement.appendChild(s);}())`);
        } catch(e){}
      });
      root.appendChild(wv);
      this._webview = wv;
    } else {
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
