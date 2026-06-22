(function () {
  const routeForm = document.querySelector("#route-form");
  const routeStatus = document.querySelector("#route-status");
  const originInput = document.querySelector("#origin");
  const destinationInput = document.querySelector("#destination");
  const travelModeSelect = document.querySelector("#travel-mode");
  const swapRouteButton = document.querySelector("#swap-route");
  const startDriveButton = document.querySelector("#start-drive");
  const demoDriveButton = document.querySelector("#demo-drive");
  const directionsPanel = document.querySelector("#directions-panel");
  const navigationHud = document.querySelector("#navigation-hud");
  const navMode = document.querySelector("#nav-mode");
  const navInstruction = document.querySelector("#nav-instruction");
  const navDetail = document.querySelector("#nav-detail");
  const stopNavigationButton = document.querySelector("#stop-navigation");
  const keyForm = document.querySelector("#key-form");
  const keyInput = document.querySelector("#api-key");
  const fallback = document.querySelector("#fallback");
  const params = new URLSearchParams(window.location.search);
  const urlKey = params.get("key");
  const configuredKey = typeof window.GOOGLE_MAPS_API_KEY === "string"
    ? window.GOOGLE_MAPS_API_KEY.trim()
    : "";
  const configuredMapId = typeof window.GOOGLE_MAPS_MAP_ID === "string"
    ? window.GOOGLE_MAPS_MAP_ID.trim()
    : "";
  const useVectorMapId = window.GOOGLE_MAPS_USE_VECTOR_MAP_ID === true
    || params.get("vector") === "1";
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
  let currentRoute = null;
  let routePath = [];
  let routeSteps = [];
  let routeLengthMeters = 0;
  let vehicleMarker = null;
  let navigationMode = null;
  let watchId = null;
  let animationFrame = 0;
  let demoStartedAt = 0;
  let lastVehiclePosition = null;
  let currentLocationCache = null;
  const vehicleIconCache = new Map();

  function setStatus(message, tone = "idle") {
    routeStatus.textContent = message;
    routeStatus.dataset.tone = tone;
  }

  function stripHtml(value) {
    const element = document.createElement("div");
    element.innerHTML = value || "";
    return element.textContent || element.innerText || "Continue";
  }

  function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = value || "";
    return element.innerHTML;
  }

  function metersToMiles(meters) {
    return meters / 1609.344;
  }

  function getSpherical() {
    return google.maps.geometry?.spherical;
  }

  function getSegmentLength(from, to) {
    return getSpherical()?.computeDistanceBetween(from, to) || 0;
  }

  function getPathLength(path) {
    return path.reduce((total, point, index) => {
      if (index === 0) {
        return total;
      }

      return total + getSegmentLength(path[index - 1], point);
    }, 0);
  }

  function getPathPointAtDistance(distanceMeters) {
    if (!routePath.length) {
      return null;
    }

    if (distanceMeters <= 0) {
      return {
        position: routePath[0],
        heading: routePath[1] ? getHeading(routePath[0], routePath[1]) : 0,
      };
    }

    let travelled = 0;

    for (let index = 1; index < routePath.length; index += 1) {
      const from = routePath[index - 1];
      const to = routePath[index];
      const segmentLength = getSegmentLength(from, to);

      if (travelled + segmentLength >= distanceMeters) {
        const fraction = segmentLength ? (distanceMeters - travelled) / segmentLength : 0;
        return {
          position: getSpherical().interpolate(from, to, fraction),
          heading: getHeading(from, to),
        };
      }

      travelled += segmentLength;
    }

    const last = routePath[routePath.length - 1];
    const previous = routePath[routePath.length - 2] || last;
    return {
      position: last,
      heading: getHeading(previous, last),
    };
  }

  function getHeading(from, to) {
    return getSpherical()?.computeHeading(from, to) || 0;
  }

  function getUpcomingStep(distanceMeters) {
    if (!routeSteps.length) {
      return "Follow the highlighted route";
    }

    const activeStep = routeSteps.find((step) => distanceMeters >= step.start && distanceMeters < step.end);
    const nextStep = activeStep || routeSteps.find((step) => step.start > distanceMeters) || routeSteps[routeSteps.length - 1];
    return nextStep.instruction;
  }

  function makeVehicleIcon(heading) {
    const normalizedHeading = Math.round((((heading % 360) + 360) % 360) / 5) * 5;
    const cachedIcon = vehicleIconCache.get(normalizedHeading);

    if (cachedIcon) {
      return cachedIcon;
    }

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 120">
        <defs>
          <linearGradient id="paint" x1="18" x2="78" y1="18" y2="104" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#ff5a47"/>
            <stop offset="0.45" stop-color="#b81919"/>
            <stop offset="1" stop-color="#5a0707"/>
          </linearGradient>
          <linearGradient id="hood" x1="27" x2="69" y1="9" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#ff8a74"/>
            <stop offset="1" stop-color="#851111"/>
          </linearGradient>
          <linearGradient id="glass" x1="29" x2="67" y1="28" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#d8ffff"/>
            <stop offset="0.45" stop-color="#5ba5ad"/>
            <stop offset="1" stop-color="#102b33"/>
          </linearGradient>
          <radialGradient id="chrome" cx="50%" cy="45%" r="58%">
            <stop offset="0" stop-color="#ffffff"/>
            <stop offset="0.28" stop-color="#d8e2e4"/>
            <stop offset="0.55" stop-color="#7b898c"/>
            <stop offset="0.82" stop-color="#f4f7f7"/>
            <stop offset="1" stop-color="#41494c"/>
          </radialGradient>
          <filter id="shadow" x="-25%" y="-20%" width="150%" height="150%">
            <feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#050605" flood-opacity="0.75"/>
          </filter>
        </defs>
        <g transform="rotate(${normalizedHeading} 48 60)" filter="url(#shadow)">
          <path d="M18 39 C19 23 29 11 48 8 C67 11 77 23 78 39 L84 91 C85 102 77 110 65 110 H31 C19 110 11 102 12 91 Z" fill="#050605"/>
          <path d="M22 40 C23 26 32 15 48 12 C64 15 73 26 74 40 L79 91 C80 98 75 104 66 104 H30 C21 104 16 98 17 91 Z" fill="url(#paint)"/>
          <path d="M31 21 C35 15 41 12 48 11 C55 12 61 15 65 21 L70 42 H26 Z" fill="url(#hood)"/>
          <path d="M30 47 L66 47 L71 70 C65 74 56 76 48 76 C40 76 31 74 25 70 Z" fill="#280b0b" opacity="0.72"/>
          <path d="M32 45 C35 35 40 29 48 28 C56 29 61 35 64 45 L60 58 H36 Z" fill="url(#glass)" stroke="#050605" stroke-width="2"/>
          <path d="M25 73 C31 80 39 84 48 84 C57 84 65 80 71 73 L73 96 C68 100 59 102 48 102 C37 102 28 100 23 96 Z" fill="#661010"/>
          <path d="M29 77 L38 83 M67 77 L58 83 M32 96 H64" fill="none" stroke="#ff7a5e" stroke-width="3" stroke-linecap="round"/>
          <path d="M21 43 H12 L13 84 H21 Z M75 43 H84 L83 84 H75 Z" fill="#0d0d0c"/>
          <circle cx="18" cy="48" r="8" fill="#050605"/>
          <circle cx="18" cy="48" r="5" fill="url(#chrome)"/>
          <circle cx="18" cy="82" r="8" fill="#050605"/>
          <circle cx="18" cy="82" r="5" fill="url(#chrome)"/>
          <circle cx="78" cy="48" r="8" fill="#050605"/>
          <circle cx="78" cy="48" r="5" fill="url(#chrome)"/>
          <circle cx="78" cy="82" r="8" fill="#050605"/>
          <circle cx="78" cy="82" r="5" fill="url(#chrome)"/>
          <circle cx="18" cy="48" r="2" fill="#f7ffff"/>
          <circle cx="18" cy="82" r="2" fill="#f7ffff"/>
          <circle cx="78" cy="48" r="2" fill="#f7ffff"/>
          <circle cx="78" cy="82" r="2" fill="#f7ffff"/>
          <path d="M27 27 L35 19 M61 19 L69 27" stroke="#f6d77b" stroke-width="3" stroke-linecap="round"/>
          <path d="M36 15 C43 10 53 10 60 15" fill="none" stroke="#ffb4a2" stroke-width="2" opacity="0.75"/>
        </g>
      </svg>
    `.trim();
    const icon = {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new google.maps.Size(54, 68),
      anchor: new google.maps.Point(27, 34),
    };

    vehicleIconCache.set(normalizedHeading, icon);
    return {
      ...icon,
    };
  }

  function setVehiclePosition(position, heading) {
    if (!vehicleMarker) {
      vehicleMarker = new google.maps.Marker({
        map,
        position,
        clickable: false,
        zIndex: 1000,
        icon: makeVehicleIcon(heading),
      });
      return;
    }

    vehicleMarker.setPosition(position);
    vehicleMarker.setIcon(makeVehicleIcon(heading));
  }

  function moveCamera(position, heading) {
    const cameraCenter = getSpherical()?.computeOffset(position, 80, heading) || position;
    const camera = {
      center: cameraCenter,
      heading,
      tilt: 67.5,
      zoom: 18,
    };

    if (typeof map.moveCamera === "function") {
      map.moveCamera(camera);
      return;
    }

    map.setCenter(camera.center);
    map.setZoom(camera.zoom);
    map.setHeading?.(camera.heading);
    map.setTilt?.(45);
  }

  function updateNavigationHud(distanceMeters, modeLabel) {
    const remaining = Math.max(routeLengthMeters - distanceMeters, 0);
    navMode.textContent = modeLabel;
    navInstruction.textContent = getUpcomingStep(distanceMeters);
    navDetail.textContent = `${metersToMiles(remaining).toFixed(1)} mi remaining`;
  }

  function prepareRoute(result) {
    currentRoute = result;
    routePath = result.routes[0]?.overview_path || [];
    routeLengthMeters = getPathLength(routePath);
    let cursor = 0;

    routeSteps = (result.routes[0]?.legs || []).flatMap((leg) => (
      leg.steps || []
    ).map((step) => {
      const start = cursor;
      const length = step.distance?.value || 0;
      cursor += length;

      return {
        start,
        end: cursor,
        instruction: stripHtml(step.instructions),
      };
    }));

    startDriveButton.disabled = !routePath.length;
    demoDriveButton.disabled = !routePath.length;
  }

  function enterNavigation(modeLabel) {
    if (!currentRoute || !routePath.length) {
      setStatus("Route first, then start drive mode.", "error");
      return false;
    }

    document.body.classList.add("is-driving");
    navigationHud.hidden = false;
    directionsPanel.hidden = true;
    map.setOptions({
      fullscreenControl: false,
      mapTypeControl: false,
      rotateControl: false,
      streetViewControl: false,
      tiltInteractionEnabled: true,
      headingInteractionEnabled: true,
    });
    updateNavigationHud(0, modeLabel);
    return true;
  }

  function stopNavigation() {
    document.body.classList.remove("is-driving");
    navigationHud.hidden = true;
    navigationMode = null;
    lastVehiclePosition = null;

    if (watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }

    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }

    if (vehicleMarker) {
      vehicleMarker.setMap(null);
      vehicleMarker = null;
    }

    if (currentRoute) {
      directionsPanel.hidden = false;
    }

    map.setTilt?.(0);
    map.setHeading?.(0);
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

  function getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (currentLocationCache && Date.now() - currentLocationCache.timestamp < 30000) {
        resolve(currentLocationCache.location);
        return;
      }

      if (!navigator.geolocation) {
        reject(new Error("GPS is not available in this browser."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          currentLocationCache = {
            timestamp: Date.now(),
            location: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            },
          };
          resolve(currentLocationCache.location);
        },
        () => reject(new Error("Location permission was blocked.")),
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 12000,
        },
      );
    });
  }

  async function resolveOrigin(origin) {
    if (origin) {
      return parsePlace(origin, originPlace);
    }

    setStatus("Getting your current location...", "working");
    return getCurrentLocation();
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
            content: `<strong>${escapeHtml(place.name || label)}</strong><br>${escapeHtml(label)}`,
          });

          marker.addListener("click", () => infoWindow.open({ anchor: marker, map }));
          businessMarkers.push(marker);
        });
      });
    });
  }

  function queueBusinessRefresh() {
    if (navigationMode) {
      return;
    }

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

    const mapOptions = {
      center: { lat: 32.4207, lng: -104.2288 },
      zoom: 12,
      tilt: 45,
      heading: 0,
    };

    if (configuredMapId && useVectorMapId) {
      mapOptions.mapId = configuredMapId;
      mapOptions.styles = undefined;
    }

    map = window.createOpenWorldGameMap(document.querySelector("#map"), mapOptions);
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

    startDriveButton.disabled = true;
    demoDriveButton.disabled = true;
    refreshBusinesses();
    setStatus("Enter a destination. Start is your current location by default.", "idle");
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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(trimmedKey)}&loading=async&libraries=places,geometry&callback=initOpenWorldMap`;
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

  function estimateDistanceAlongRoute(position) {
    if (!routePath.length) {
      return 0;
    }

    let nearestDistance = 0;
    let nearestScore = Number.POSITIVE_INFINITY;
    let travelled = 0;

    routePath.forEach((point, index) => {
      if (index > 0) {
        travelled += getSegmentLength(routePath[index - 1], point);
      }

      const score = getSegmentLength(position, point);

      if (score < nearestScore) {
        nearestScore = score;
        nearestDistance = travelled;
      }
    });

    return nearestDistance;
  }

  function updateLivePosition(coords) {
    const position = new google.maps.LatLng(coords.latitude, coords.longitude);
    let heading = Number.isFinite(coords.heading) ? coords.heading : null;

    if (heading === null && lastVehiclePosition) {
      heading = getHeading(lastVehiclePosition, position);
    }

    if (heading === null) {
      const estimatedDistance = estimateDistanceAlongRoute(position);
      heading = getPathPointAtDistance(estimatedDistance)?.heading || 0;
    }

    const distanceAlongRoute = estimateDistanceAlongRoute(position);
    lastVehiclePosition = position;
    setVehiclePosition(position, heading);
    moveCamera(position, heading);
    updateNavigationHud(distanceAlongRoute, "Live GPS");
  }

  function startLiveDrive() {
    stopNavigation();

    if (!enterNavigation("Live GPS")) {
      return;
    }

    navigationMode = "live";

    if (!navigator.geolocation) {
      setStatus("GPS is not available here. Running preview drive.", "error");
      startDemoDrive();
      return;
    }

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        updateLivePosition(position.coords);
        setStatus("Live drive mode active.", "success");
      },
      () => {
        setStatus("Location permission was blocked. Running preview drive.", "error");
        startDemoDrive();
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      },
    );
  }

  function tickDemoDrive(timestamp) {
    if (navigationMode !== "demo" || !routeLengthMeters) {
      return;
    }

    if (!demoStartedAt) {
      demoStartedAt = timestamp;
    }

    const elapsedSeconds = (timestamp - demoStartedAt) / 1000;
    const metersPerSecond = 12.5;
    const distance = Math.min(elapsedSeconds * metersPerSecond, routeLengthMeters);
    const routePoint = getPathPointAtDistance(distance);

    if (!routePoint) {
      return;
    }

    setVehiclePosition(routePoint.position, routePoint.heading);
    moveCamera(routePoint.position, routePoint.heading);
    updateNavigationHud(distance, "Preview Drive");

    if (distance >= routeLengthMeters) {
      setStatus("Arrived.", "success");
      return;
    }

    animationFrame = window.requestAnimationFrame(tickDemoDrive);
  }

  function startDemoDrive() {
    stopNavigation();

    if (!enterNavigation("Preview Drive")) {
      return;
    }

    navigationMode = "demo";
    demoStartedAt = 0;
    setStatus("Preview drive mode active.", "success");
    animationFrame = window.requestAnimationFrame(tickDemoDrive);
  }

  async function route() {
    const origin = originInput.value.trim();
    const destination = destinationInput.value.trim();

    if (!map || !directionsService || !directionsRenderer) {
      showManualKeyEntry();
      return;
    }

    if (!destination) {
      setStatus("Enter a destination. Leave Start blank to use current location.", "error");
      return;
    }

    hasSubmittedRoute = true;
    let resolvedOrigin;

    try {
      resolvedOrigin = await resolveOrigin(origin);
    } catch (error) {
      setStatus(`${error.message} Type a start address instead.`, "error");
      return;
    }

    stopNavigation();
    startDriveButton.disabled = true;
    demoDriveButton.disabled = true;
    setStatus("Finding route...", "working");
    directionsService.route(
      {
        origin: resolvedOrigin,
        destination: parsePlace(destination, destinationPlace),
        travelMode: google.maps.TravelMode[travelModeSelect.value] || google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status !== "OK" || !result) {
          directionsPanel.hidden = true;
          currentRoute = null;
          routePath = [];
          routeSteps = [];
          routeLengthMeters = 0;
          setStatus(`Route failed: ${status.replaceAll("_", " ").toLowerCase()}.`, "error");
          return;
        }

        directionsRenderer.setDirections(result);
        prepareRoute(result);
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

    if (destinationInput.value.trim()) {
      route();
    }
  });

  startDriveButton.addEventListener("click", startLiveDrive);
  demoDriveButton.addEventListener("click", startDemoDrive);
  stopNavigationButton.addEventListener("click", stopNavigation);

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
