# MMM-WetterOnlineRadar (v1.1)

**Standard-Ort: Berlin** (WetterRadar-Ansicht, `?wro=true`). In deiner `config.js` kannst du z. B. **Dresden** setzen.

## config.js-Beispiel (Dresden)
```js
{
  module: "MMM-WetterOnlineRadar",
  position: "top_right",
  config: {
    url: "https://www.wetteronline.de/regenradar/dresden",
    reloadInterval: 15 * 60 * 1000,
    width: "600px",
    height: "400px",
    zoom: 1.0,
    useWebview: true,
    blockPointer: true
  }
}
```

- Aggressive **Radar-only**-Darstellung via Preload (Banner/Overlays/Consent werden versteckt; Karte wird auf Vollfläche gestreckt).
- Seite wird automatisch alle 15 Minuten neu geladen.
- Mit `zoom` kannst du Ränder/Bedienelemente aus dem Bild schieben.

**Hinweis:** Iframe-Einbettung kann durch Sicherheitsheader blockiert werden. Darum standardmäßig `<webview>` nutzen (Electron `webviewTag: true`).
