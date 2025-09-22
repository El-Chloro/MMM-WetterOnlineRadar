# MMM-WetterOnlineRadar (v1.1)

**Standard-Ort: Berlin** (intern über Koordinaten). In der `config.js` kannst du einen beliebigen Ort setzen.
Die Einbettung nutzt **ausschließlich den WetterOnline Radar-Frame (wo-cloud)** – *ohne* restliche Website/Chromes/Popups.

## Warum „data get loaded“?
Wenn die komplette wetteronline.de-Seite eingebettet wird, blockieren CMP/Ads/CSP teils den Ladevorgang. Dieses Modul lädt direkt den **Frame**:
`https://radar.wo-cloud.com/desktop/rr/compact?wrx=LAT,LON&wrm=ZOOM&wry=LAT,LON`  
→ Dadurch entfällt das ganze Drumherum und der Radar läuft stabil.

## Installation
1. Ordner `MMM-WetterOnlineRadar` nach `~/MagicMirror/modules/` kopieren.
2. (Empfohlen) In `~/MagicMirror/js/electron.js` `webviewTag: true` aktivieren. MM neu starten.

## config.js-Beispiel (hier **Dresden**)
```js
{
  module: "MMM-WetterOnlineRadar",
  position: "top_right",
  config: {
    // Dresden (51.0504, 13.7373)
    coords: { lat: 51.0504, lon: 13.7373 },
    zoomLevel: 8,                // 6..12 üblich
    reloadInterval: 15 * 60 * 1000,
    width: "560px",
    height: "360px",
    zoomCss: 1.0,                // 1.05..1.15 schiebt Ränder aus dem Bild
    useWebview: true,
    blockPointer: true
  }
}
```

### Optional direkt per URL (falls du was eigenes hast)
```js
radarFrameUrl: "https://radar.wo-cloud.com/desktop/rr/compact?wrx=51.0504,13.7373&wrm=8&wry=51.0504,13.7373"
```

## Größen & Zuschnitt
- Neue Defaults: **560×360 px**, mit `zoomCss` kannst du fein „reinzoomen“, ohne die Kachel neu zu berechnen.

## Troubleshooting
- **Weißer Screen / „data get loaded“** → Nutze dieses Modul (Frame-URL). Stelle sicher, dass `webviewTag: true` aktiv ist.
- **Nichts lädt im `<iframe>`** → Viele Seiten verbieten Iframe. Der **wo-cloud Frame** ist dafür gedacht und funktioniert im Webview am zuverlässigsten.

## Lizenz
MIT
