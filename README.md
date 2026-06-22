# Open World Google Maps Skin

This is an original Google Maps JavaScript API skin inspired by open-world crime game maps: high-contrast cream roads, dark outlines, muted green terrain, teal water, reduced icon clutter, and strong label strokes.

## Files

- `open-world-game-map-style.json` is the reusable Google Maps style array.
- `open-world-game-map-style.js` exposes `openWorldGameMapStyle`, `openWorldGameMapOptions`, and `createOpenWorldGameMap(...)`.
- `index.html` is a local preview page. Open it in a browser and enter a Google Maps JavaScript API key, or append `?key=YOUR_API_KEY` to the URL.
- `config.js` is a blank committed runtime config. GitHub Actions overwrites it during Pages deployment.
- `serve-preview.cjs` starts a small localhost preview server.

## GitHub Pages

This project is ready to run through GitHub Pages.

1. Push the repo to GitHub on the `main` or `master` branch.
2. In the repo, go to Settings -> Pages and set the source to GitHub Actions.
3. Go to Settings -> Secrets and variables -> Actions -> Variables.
4. Add a repository variable named `GOOGLE_MAPS_API_KEY`.
5. Run the workflow named `Deploy static Google Maps skin to GitHub Pages`.

The workflow writes `config.js` only inside the Pages artifact, so the API key is not committed to the repository. It is still visible to browsers at runtime because Google Maps JavaScript API keys are client-side keys. Restrict the key in Google Cloud to the Maps JavaScript API and to your GitHub Pages referrer, for example:

```text
https://j4cobvigil.github.io/GTA-Map/*
```

After deployment, the site should be available at:

```text
https://j4cobvigil.github.io/GTA-Map/
```

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
