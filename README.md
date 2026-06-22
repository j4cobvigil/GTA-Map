# Open World Google Maps Skin

This is an original Google Maps JavaScript API skin inspired by open-world crime game maps: high-contrast cream roads, dark outlines, muted green terrain, teal water, reduced icon clutter, and strong label strokes.

## Files

- `open-world-game-map-style.json` is the reusable Google Maps style array.
- `open-world-game-map-style.js` exposes `openWorldGameMapStyle`, `openWorldGameMapOptions`, and `createOpenWorldGameMap(...)`.
- `index.html` is a local preview page. Open it in a browser and enter a Google Maps JavaScript API key, or append `?key=YOUR_API_KEY` to the URL.
- `serve-preview.cjs` starts a small localhost preview server.

## Preview

```bash
node serve-preview.cjs
```

Then open `http://127.0.0.1:5189/` and enter a Google Maps JavaScript API key.

## Drop-In Usage

```html
<div id="map"></div>
<script src="open-world-game-map-style.js"></script>
<script>
  function initMap() {
    createOpenWorldGameMap(document.getElementById("map"), {
      center: { lat: 34.0522, lng: -118.2437 },
      zoom: 12
    });
  }
</script>
<script async defer src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&callback=initMap"></script>
```

If your project uses Google Cloud map IDs instead of local JavaScript styles, use the JSON file as the palette/reference and recreate the rules in the Google Maps style editor.
