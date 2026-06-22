# Open World Google Maps Skin

This is an original Google Maps JavaScript API route map inspired by open-world crime game maps: high-contrast cream roads, dark outlines, muted green terrain, teal water, reduced icon clutter, and strong label strokes.

## Files

- `open-world-game-map-style.json` is the reusable Google Maps style array.
- `open-world-game-map-style.js` exposes `openWorldGameMapStyle`, `openWorldGameMapOptions`, and `createOpenWorldGameMap(...)`.
- `index.html` is the route map page. It accepts addresses or latitude/longitude pairs for directions, with Places autocomplete when enabled. If the Start field is blank, it uses the browser's current location.
- After routing, `Start Drive` enters a tilted chase-camera navigation mode using live browser GPS when permission is granted. `Preview Drive` animates the vehicle along the route without GPS.
- `config.js` is a blank committed runtime config. GitHub Actions overwrites it during Pages deployment.
- `serve-preview.cjs` starts a small localhost preview server.

## GitHub Pages

This project is ready to run through GitHub Pages.

1. Push the repo to GitHub on the `main` or `master` branch.
2. In the repo, go to Settings -> Pages and set the source to GitHub Actions.
3. Go to Settings -> Secrets and variables -> Actions -> Variables.
4. Add a repository variable named `GOOGLE_MAPS_API_KEY`.
5. Add `GOOGLE_MAPS_MAP_ID` after you create and style the vector Map ID in Google Cloud.
6. Run the workflow named `Deploy static Google Maps skin to GitHub Pages`.

The workflow writes `config.js` only inside the Pages artifact, so the API key is not committed to the repository. It is still visible to browsers at runtime because Google Maps JavaScript API keys are client-side keys. Restrict the key in Google Cloud to the Maps JavaScript API and to your GitHub Pages referrer, for example:

```text
https://j4cobvigil.github.io/GTA-Map/*
```

After deployment, the site should be available at:

```text
https://j4cobvigil.github.io/GTA-Map/
```

If the deployed page still asks for an API key, GitHub Pages is probably serving the committed blank `config.js`. Check that Settings -> Pages is set to GitHub Actions, confirm the `GOOGLE_MAPS_API_KEY` repository variable exists, then rerun the Pages workflow.

Autocomplete and nearby business icons use the Places library. In Google Cloud, make sure the same API key is allowed to use:

- Maps JavaScript API
- Places API

Live GPS navigation requires HTTPS and browser location permission. GitHub Pages is HTTPS, so the phone will prompt for location access when `Start Drive` is tapped. The web app can simulate the Google Maps app navigation feel, but it is still browser-based and does not have the full native Google Maps turn-by-turn navigation SDK.

When `GOOGLE_MAPS_MAP_ID` is present, the app uses that vector map by default so tilt/rotation work in navigation. Since your Map ID is styled in Google Cloud, that is the preferred path. To compare against the old local JSON fallback, open the site with `?flat=1`. To explicitly disable vector mode from GitHub, add an Actions variable named `GOOGLE_MAPS_USE_VECTOR_MAP_ID` with the value `false`.

## Preview

```bash
node serve-preview.cjs
```

Then open `http://127.0.0.1:5189/` and enter a Google Maps JavaScript API key. If your key is restricted only to `https://j4cobvigil.github.io/GTA-Map/*`, it will not work on localhost.

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
