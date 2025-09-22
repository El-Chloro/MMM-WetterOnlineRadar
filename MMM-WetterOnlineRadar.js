Module.register("MMM-WetterOnlineRadar", {
  defaults: {
    url: "https://www.wetteronline.de/wetterradar/berlin?wro=true",
    reloadInterval: 15 * 60 * 1000,
    width: "600px",
    height: "400px",
    zoom: 1.0,
    useWebview: true,
    blockPointer: true,
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36"
  },

  start() { this._reloadTimer = null; },
  getStyles() { return [this.file("styles.css")]; },

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
      wv.setAttribute("disablewebsecurity", "");
      wv.style.width = "100%"; wv.style.height = "100%"; wv.style.border = "0";
      wv.style.transform = `scale(${this.config.zoom})`; wv.style.transformOrigin = "0 0";
      if (this.config.blockPointer) wv.style.pointerEvents = "none";
      if (typeof wv.setUserAgentOverride === "function") { try { wv.setUserAgentOverride(this.config.userAgent); } catch(e){} }
      wv.addEventListener("did-finish-load", () => {
        try { wv.executeJavaScript(`(function(){ var s=document.createElement('style'); s.textContent='*::-webkit-scrollbar{width:0;height:0}'; document.documentElement.appendChild(s);}())`); } catch(e){}
      });
      wrapper.appendChild(wv); this._webview = wv;
    } else {
      const iframe = document.createElement("iframe");
      iframe.className = "wro-iframe";
      iframe.src = url; iframe.loading = "eager"; iframe.referrerPolicy = "no-referrer";
      iframe.sandbox = "allow-scripts allow-forms allow-same-origin";
      iframe.style.width = "100%"; iframe.style.height = "100%"; iframe.style.border = "0";
      iframe.style.transform = `scale(${this.config.zoom})`; iframe.style.transformOrigin = "0 0";
      if (this.config.blockPointer) iframe.style.pointerEvents = "none";
      wrapper.appendChild(iframe); this._iframe = iframe;
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
      if (!url.searchParams.has("wro")) url.searchParams.set("wro", "true");
      url.searchParams.set("_ts", String(Date.now()));
      return url.toString();
    } catch (e) {
      return this.config.url + (this.config.url.includes("?") ? "&" : "?") + "_ts=" + Date.now();
    }
  }
});
