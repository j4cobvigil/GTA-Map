(function () {
  const routeForm = document.querySelector("#route-form");
  const routeStatus = document.querySelector("#route-status");
  const originInput = document.querySelector("#origin");
  const destinationInput = document.querySelector("#destination");
  const travelModeSelect = document.querySelector("#travel-mode");
  const swapRouteButton = document.querySelector("#swap-route");
  const directionsPanel = document.querySelector("#directions-panel");
  const keyForm = document.querySelector("#key-form");
  const keyInput = document.querySelector("#api-key");
  const fallback = document.querySelector("#fallback");
  const params = new URLSearchParams(window.location.search);
  const urlKey = params.get("key");
  const configuredKey = typeof window.GOOGLE_MAPS_API_KEY === "string"
    ? window.GOOGLE_MAPS_API_KEY.trim()
    : "";
  const businessTypes = [
    "restaurant",
    "gas_station",
    "cafe",
    "store",
    "lodging",
    "atm",
  ];
  const markerStyles = {
    restaurant: { label: "Eats", glyph: "M18 8 L18 24 M24 8 L24 24 M14 8 L14 14 Q14 18 18 18 Q22 18 22 14 L22 8", color: "#f5d77d" },
    gas_station: { label: "Gas", glyph: "M13 10 H23 V28 H13 Z M23 14 H27 L30 18 V28 M16 14 H20", color: "#9fd6d8" },
    cafe: { label: "Cafe", glyph: "M12 16 H25 V21 Q25 26 19 26 Q13 26 12 21 Z M25 18 H30 Q31 18 31 20 Q31 23 25 23 M14 30 H27", color: "#f2c48d" },
    store: { label: "Shop", glyph: "M11 16 H29 L27 28 H13 Z M14 11 H26 L29 16 H11 Z M16 20 H24", color: "#c8db9b" },
    lodging: { label: "Stay", glyph: "M11 27 V12 M11 20 H29 V27 M14 18 H20 M20 20 V27 M29 27 V17", color: "#d8c9ff" },
    atm: { label: "Cash", glyph: "M12 12 H28 V28 H12 Z M16 20 H24 M18 16 H22 M18 24 H22", color: "#8fdb9d" },
    default: { label: "Biz", glyph: "M20 10 L29 18 L26 29 H14 L11 18 Z M20 16 V24", color: "#f1ead2" },
  };
  let map;
  let autocompleteBounds;
  let originAutocomplete;
  let destinationAutocomplete;
  let originPlace = null;
  let destinationPlace = null;
  let directionsService;
  let directionsRenderer;
  let placesService;
  let businessMarkers = [];
  let hasSubmittedRoute = false;
  let routeTimer = 0;
  let businessTimer = 0;
  let lastBusinessSearch = null;

  function setStatus(message, tone = "idle") {
    routeStatus.textContent = message;
    routeStatus.dataset.tone = tone;
  }

  function parseCoordinates(value) {
    const text = value.trim();
    const coordinates = text.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);

    if (!coordinates) {
      return null;
    }

    const lat = Number(coordinates[1]);
    const lng = Number(coordinates[2]);

    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }

    return null;
  }

  function parsePlace(value, selectedPlace) {
    const coordinates = parseCoordinates(value);

    if (coordinates) {
      return coordinates;
    }

    if (
      selectedPlace?.place_id
      && [selectedPlace.formatted_address, selectedPlace.name].includes(value.trim())
    ) {
      return { placeId: selectedPlace.place_id };
    }

    return value.trim();
  }

  function makeBusinessIcon(type) {
    const style = markerStyles[type] || markerStyles.default;
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 48">
        <path d="M20 2 C10.6 2 4 8.7 4 18.1 C4 30.5 20 46 20 46 C20 46 36 30.5 36 18.1 C36 8.7 29.4 2 20 2 Z" fill="#050605"/>
        <path d="M20 5 C12.3 5 7 10.3 7 18 C7 27 16.2 37.7 20 41.7 C23.8 37.7 33 27 33 18 C33 10.3 27.7 5 20 5 Z" fill="${style.color}"/>
        <circle cx="20" cy="18" r="11" fill="#14170f"/>
        <path d="${style.glyph}" fill="none" stroke="#f1ead2" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `.trim();

    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new google.maps.Size(34, 41),
      anchor: new google.maps.Point(17, 41),
    };
  }

  function getPrimaryBusinessType(place) {
    return businessTypes.find((type) => place.types?.includes(type)) || "default";
  }

  function clearBusinessMarkers() {
    businessMarkers.forEach((marker) => marker.setMap(null));
    businessMarkers = [];
  }

  function refreshBusinesses() {
    if (!placesService || !map) {
      return;
    }

    const center = map.getCenter();

    if (!center) {
      return;
    }

    const searchCenter = { lat: center.lat(), lng: center.lng() };
    const movedFarEnough = !lastBusinessSearch
      || Math.abs(lastBusinessSearch.lat - searchCenter.lat) > 0.01
      || Math.abs(lastBusinessSearch.lng - searchCenter.lng) > 0.01;

    if (!movedFarEnough) {
      return;
    }

    lastBusinessSearch = searchCenter;
    clearBusinessMarkers();
    const seenPlaceIds = new Set();

    businessTypes.forEach((type) => {
      placesService.nearbySearch({
        location: center,
        radius: 2200,
        type,
      }, (results, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !results?.length) {
          return;
        }

        const places = results.filter((place) => {
          if (!place.geometry?.location || seenPlaceIds.has(place.place_id) || businessMarkers.length >= 30) {
            return false;
          }

          seenPlaceIds.add(place.place_id);
          return true;
        }).slice(0, 5);

        places.forEach((place) => {
          const type = getPrimaryBusinessType(place);
          const marker = new google.maps.Marker({
            map,
            position: place.geometry.location,
            title: place.name,
            icon: makeBusinessIcon(type),
          });
          const label = markerStyles[type]?.label || markerStyles.default.label;
          const infoWindow = new google.maps.InfoWindow({
            content: `<strong>${place.name || label}</strong><br>${label}`,
          });

          marker.addListener("click", () => infoWindow.open({ anchor: marker, map }));
          businessMarkers.push(marker);
        });
      });
    });
  }

  function queueBusinessRefresh() {
    window.clearTimeout(businessTimer);
    businessTimer = window.setTimeout(refreshBusinesses, 500);
  }

  function setupAutocomplete(input, onSelect) {
    if (!google.maps.places?.Autocomplete) {
      return null;
    }

    const autocomplete = new google.maps.places.Autocomplete(input, {
      bounds: autocompleteBounds,
      componentRestrictions: { country: "us" },
      fields: ["formatted_address", "geometry", "name", "place_id"],
      strictBounds: false,
    });

    autocomplete.bindTo("bounds", map);
    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      onSelect(place);

      if (place.formatted_address) {
        input.value = place.formatted_address;
      } else if (place.name) {
        input.value = place.name;
      }

      if (place.geometry?.location) {
        map.panTo(place.geometry.location);
      }

      queueRoute();
    });

    return autocomplete;
  }

  function initMap() {
    fallback?.remove();
    keyForm.hidden = true;
    keyInput.value = "";
    routeForm.hidden = false;
    directionsPanel.hidden = true;

    map = window.createOpenWorldGameMap(document.querySelector("#map"), {
      center: { lat: 32.4207, lng: -104.2288 },
      zoom: 12,
    });
    autocompleteBounds = new google.maps.LatLngBounds(
      { lat: 32.05, lng: -104.65 },
      { lat: 32.8, lng: -103.85 },
    );
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
      map,
      panel: directionsPanel,
      preserveViewport: false,
      suppressMarkers: false,
      polylineOptions: {
        strokeColor: "#f5d77d",
        strokeOpacity: 0.95,
        strokeWeight: 6,
      },
    });
    placesService = google.maps.places ? new google.maps.places.PlacesService(map) : null;
    originAutocomplete = setupAutocomplete(originInput, (place) => {
      originPlace = place;
    });
    destinationAutocomplete = setupAutocomplete(destinationInput, (place) => {
      destinationPlace = place;
    });

    originInput.addEventListener("input", () => {
      originPlace = null;
      queueRoute();
    });
    destinationInput.addEventListener("input", () => {
      destinationPlace = null;
      queueRoute();
    });
    travelModeSelect.addEventListener("change", queueRoute);
    map.addListener("idle", queueBusinessRefresh);
    directionsRenderer.addListener("directions_changed", updateRouteSummary);

    refreshBusinesses();
    setStatus("Start typing an address or coordinates.", "idle");
  }

  function showManualKeyEntry(message = "Map key missing. Paste the key once, or deploy with the GitHub Actions variable.") {
    keyForm.hidden = false;
    routeForm.hidden = true;
    directionsPanel.hidden = true;
    keyInput.placeholder = "AIza...";
    setStatus(message, "error");
  }

  function loadGoogleMaps(apiKey) {
    const trimmedKey = apiKey.trim();

    if (!trimmedKey || window.google?.maps || document.querySelector("#google-maps-js")) {
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-js";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(trimmedKey)}&loading=async&libraries=places&callback=initOpenWorldMap`;
    script.async = true;
    script.onerror = () => showManualKeyEntry("Could not load Google Maps. Check the API key and network connection.");
    document.head.appendChild(script);
  }

  function updateRouteSummary() {
    const result = directionsRenderer?.getDirections();
    const legs = result?.routes[0]?.legs || [];

    if (!legs.length) {
      return;
    }

    const distanceMeters = legs.reduce((sum, leg) => sum + (leg.distance?.value || 0), 0);
    const durationSeconds = legs.reduce((sum, leg) => sum + (leg.duration?.value || 0), 0);
    const miles = distanceMeters / 1609.344;
    const minutes = Math.round(durationSeconds / 60);

    directionsPanel.hidden = false;
    setStatus(`${miles.toFixed(1)} mi, about ${minutes} min.`, "success");
  }

  function route() {
    const origin = originInput.value.trim();
    const destination = destinationInput.value.trim();

    if (!map || !directionsService || !directionsRenderer) {
      showManualKeyEntry();
      return;
    }

    if (!origin || !destination) {
      setStatus("Enter both a start and destination.", "error");
      return;
    }

    hasSubmittedRoute = true;
    setStatus("Finding route...", "working");
    directionsService.route(
      {
        origin: parsePlace(origin, originPlace),
        destination: parsePlace(destination, destinationPlace),
        travelMode: google.maps.TravelMode[travelModeSelect.value] || google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status !== "OK" || !result) {
          directionsPanel.hidden = true;
          setStatus(`Route failed: ${status.replaceAll("_", " ").toLowerCase()}.`, "error");
          return;
        }

        directionsRenderer.setDirections(result);
        updateRouteSummary();
      },
    );
  }

  function queueRoute() {
    if (!hasSubmittedRoute) {
      return;
    }

    window.clearTimeout(routeTimer);
    routeTimer = window.setTimeout(route, 700);
  }

  window.initOpenWorldMap = initMap;
  window.gm_authFailure = () => {
    showManualKeyEntry("Google rejected this key for the current URL. Check the GitHub Pages referrer restriction.");
  };

  routeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    route();
  });

  swapRouteButton.addEventListener("click", () => {
    const origin = originInput.value;
    const selectedOrigin = originPlace;
    originInput.value = destinationInput.value;
    destinationInput.value = origin;
    originPlace = destinationPlace;
    destinationPlace = selectedOrigin;

    if (originInput.value.trim() && destinationInput.value.trim()) {
      route();
    }
  });

  keyForm.addEventListener("submit", (event) => {
    event.preventDefault();
    loadGoogleMaps(keyInput.value.trim());
  });

  if (urlKey) {
    keyInput.value = urlKey;
    loadGoogleMaps(urlKey);
  } else if (configuredKey) {
    keyForm.hidden = true;
    loadGoogleMaps(configuredKey);
  } else {
    showManualKeyEntry();
  }
})();
