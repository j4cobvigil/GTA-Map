(function () {
  const routeForm = document.querySelector("#route-form");
  const routeStatus = document.querySelector("#route-status");
  const originInput = document.querySelector("#origin");
  const destinationInput = document.querySelector("#destination");
  const travelModeSelect = document.querySelector("#travel-mode");
  const swapRouteButton = document.querySelector("#swap-route");
  const keyForm = document.querySelector("#key-form");
  const keyInput = document.querySelector("#api-key");
  const fallback = document.querySelector("#fallback");
  const params = new URLSearchParams(window.location.search);
  const urlKey = params.get("key");
  const configuredKey = typeof window.GOOGLE_MAPS_API_KEY === "string"
    ? window.GOOGLE_MAPS_API_KEY.trim()
    : "";
  let map;
  let directionsService;
  let directionsRenderer;

  function setStatus(message, tone = "idle") {
    routeStatus.textContent = message;
    routeStatus.dataset.tone = tone;
  }

  function parsePlace(value) {
    const text = value.trim();
    const coordinates = text.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);

    if (!coordinates) {
      return text;
    }

    const lat = Number(coordinates[1]);
    const lng = Number(coordinates[2]);

    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }

    return text;
  }

  function initMap() {
    fallback?.remove();
    keyForm.hidden = true;
    keyInput.value = "";
    routeForm.hidden = false;

    map = window.createOpenWorldGameMap(document.querySelector("#map"), {
      center: { lat: 32.4207, lng: -104.2288 },
      zoom: 12,
    });
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
      map,
      preserveViewport: false,
      polylineOptions: {
        strokeColor: "#f5d77d",
        strokeOpacity: 0.95,
        strokeWeight: 6,
      },
    });
    setStatus("Enter a start and destination.", "idle");
  }

  function showManualKeyEntry(message = "Map key missing. Paste the key once, or deploy with the GitHub Actions variable.") {
    keyForm.hidden = false;
    routeForm.hidden = true;
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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(trimmedKey)}&callback=initOpenWorldMap`;
    script.async = true;
    script.defer = true;
    script.onerror = () => showManualKeyEntry("Could not load Google Maps. Check the API key and network connection.");
    document.head.appendChild(script);
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

    setStatus("Finding route...", "working");
    directionsService.route(
      {
        origin: parsePlace(origin),
        destination: parsePlace(destination),
        travelMode: google.maps.TravelMode[travelModeSelect.value] || google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status !== "OK" || !result) {
          setStatus(`Route failed: ${status.replaceAll("_", " ").toLowerCase()}.`, "error");
          return;
        }

        directionsRenderer.setDirections(result);

        const legs = result.routes[0]?.legs || [];
        const distanceMeters = legs.reduce((sum, leg) => sum + (leg.distance?.value || 0), 0);
        const durationSeconds = legs.reduce((sum, leg) => sum + (leg.duration?.value || 0), 0);
        const miles = distanceMeters / 1609.344;
        const minutes = Math.round(durationSeconds / 60);

        setStatus(`${miles.toFixed(1)} mi, about ${minutes} min.`, "success");
      },
    );
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
    originInput.value = destinationInput.value;
    destinationInput.value = origin;

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
