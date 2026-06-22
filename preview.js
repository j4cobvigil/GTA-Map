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
  const mapElement = document.querySelector("#map");
  const fallback = document.querySelector("#fallback");
  const params = new URLSearchParams(window.location.search);
  const urlKey = params.get("key");
  const configuredKey = typeof window.GOOGLE_MAPS_API_KEY === "string"
    ? window.GOOGLE_MAPS_API_KEY.trim()
    : "";
  const configuredMapId = typeof window.GOOGLE_MAPS_MAP_ID === "string"
    ? window.GOOGLE_MAPS_MAP_ID.trim()
    : "";
  const vectorPreference = window.GOOGLE_MAPS_USE_VECTOR_MAP_ID;
  const forceVectorMap = params.get("vector") === "1";
  const forceFlatMap = params.get("flat") === "1";
  const useVectorMapId = Boolean(configuredMapId)
    && !forceFlatMap
    && (forceVectorMap || vectorPreference !== false);
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
  let mapUsesVectorId = false;
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
  let lastVehicleHeading = 0;
  let vehicleLightFrame = 0;
  let vehicleLightTimer = 0;
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

  function getVehicleIconHeading(heading) {
    // The vector drive camera already rotates with the road, so keep the UFO upright on screen.
    return navigationMode && mapUsesVectorId ? 0 : heading;
  }

  function makeVehicleIcon(heading, lightFrame = vehicleLightFrame) {
    const displayHeading = getVehicleIconHeading(heading);
    const normalizedHeading = Math.round((((displayHeading % 360) + 360) % 360) / 5) * 5;
    const normalizedFrame = ((lightFrame % 12) + 12) % 12;
    const cacheKey = `${normalizedHeading}:${normalizedFrame}`;
    const cachedIcon = vehicleIconCache.get(cacheKey);

    if (cachedIcon) {
      return cachedIcon;
    }

    const lightPalette = ["#ff375f", "#ffb800", "#54f2f2", "#5eff7d", "#8e7bff", "#ff63d8"];
    const lightPositions = [
      { x: 18, y: 62 },
      { x: 28, y: 73 },
      { x: 42, y: 78 },
      { x: 56, y: 78 },
      { x: 70, y: 73 },
      { x: 80, y: 62 },
      { x: 66, y: 54 },
      { x: 30, y: 54 },
    ];
    const lights = lightPositions.map((point, index) => {
      const color = lightPalette[(index + normalizedFrame) % lightPalette.length];
      const active = index === normalizedFrame % lightPositions.length;
      const radius = active ? 5.2 : 3.7;
      const opacity = active ? 1 : 0.78;

      return `
        <circle cx="${point.x}" cy="${point.y}" r="${radius + 4}" fill="${color}" opacity="${active ? 0.28 : 0.12}"/>
        <circle cx="${point.x}" cy="${point.y}" r="${radius}" fill="${color}" stroke="#050605" stroke-width="1.5" opacity="${opacity}"/>
        <circle cx="${point.x - 1.2}" cy="${point.y - 1.4}" r="1.2" fill="#ffffff" opacity="0.9"/>
      `;
    }).join("");
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 112">
        <defs>
          <radialGradient id="dome" cx="46%" cy="28%" r="62%">
            <stop offset="0" stop-color="#f7ffff"/>
            <stop offset="0.28" stop-color="#9ee7f1"/>
            <stop offset="0.68" stop-color="#26616e"/>
            <stop offset="1" stop-color="#071519"/>
          </radialGradient>
          <linearGradient id="domeGlass" x1="38" x2="60" y1="22" y2="51" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#ffffff" stop-opacity="0.86"/>
            <stop offset="0.42" stop-color="#b9fbff" stop-opacity="0.28"/>
            <stop offset="1" stop-color="#0b1d22" stop-opacity="0.1"/>
          </linearGradient>
          <linearGradient id="saucer" x1="8" x2="88" y1="43" y2="75" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#ffffff"/>
            <stop offset="0.18" stop-color="#98a8ab"/>
            <stop offset="0.34" stop-color="#f8ffff"/>
            <stop offset="0.5" stop-color="#6a777a"/>
            <stop offset="0.68" stop-color="#eef8f9"/>
            <stop offset="0.86" stop-color="#525d60"/>
            <stop offset="1" stop-color="#151a1d"/>
          </linearGradient>
          <linearGradient id="rimEdge" x1="12" x2="84" y1="60" y2="85" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#151a1d"/>
            <stop offset="0.22" stop-color="#79878a"/>
            <stop offset="0.46" stop-color="#ecf7f8"/>
            <stop offset="0.68" stop-color="#596568"/>
            <stop offset="1" stop-color="#0a0d0f"/>
          </linearGradient>
          <radialGradient id="belly" cx="50%" cy="35%" r="68%">
            <stop offset="0" stop-color="#e7ffff"/>
            <stop offset="0.32" stop-color="#5b7478"/>
            <stop offset="0.7" stop-color="#182124"/>
            <stop offset="1" stop-color="#050707"/>
          </radialGradient>
          <radialGradient id="beam" cx="50%" cy="10%" r="70%">
            <stop offset="0" stop-color="#95fff2" stop-opacity="0.5"/>
            <stop offset="0.58" stop-color="#55ffd8" stop-opacity="0.15"/>
            <stop offset="1" stop-color="#55ffd8" stop-opacity="0"/>
          </radialGradient>
          <filter id="shadow" x="-25%" y="-20%" width="150%" height="150%">
            <feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#050605" flood-opacity="0.75"/>
          </filter>
          <filter id="glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="3.2" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <g transform="rotate(${normalizedHeading} 48 56)" filter="url(#shadow)">
          <path d="M27 72 L41 108 H55 L69 72 Z" fill="url(#beam)"/>
          <ellipse cx="48" cy="77" rx="30" ry="10" fill="#050707" opacity="0.54"/>
          <path d="M10 59 C18 45 78 45 86 59 C80 75 65 84 48 84 C31 84 16 75 10 59 Z" fill="url(#rimEdge)"/>
          <ellipse cx="48" cy="57" rx="43" ry="18" fill="#050707"/>
          <ellipse cx="48" cy="54" rx="39" ry="16" fill="url(#saucer)"/>
          <path d="M12 61 C21 72 35 78 48 78 C61 78 75 72 84 61 C76 76 62 86 48 86 C34 86 20 76 12 61 Z" fill="url(#rimEdge)"/>
          <ellipse cx="48" cy="67" rx="29" ry="9" fill="url(#belly)" opacity="0.94"/>
          <ellipse cx="48" cy="64" rx="19" ry="5.5" fill="#030606" opacity="0.52"/>
          <path d="M18 55 C29 48 66 48 78 55" fill="none" stroke="#ffffff" stroke-width="2.5" opacity="0.56" stroke-linecap="round"/>
          <path d="M21 63 C32 69 64 69 75 63" fill="none" stroke="#ffffff" stroke-width="1.6" opacity="0.22" stroke-linecap="round"/>
          <path d="M34 50 C35 31 42 20 48 17 C54 20 61 31 62 50 Z" fill="#050707"/>
          <path d="M37 50 C38 33 43 24 48 21 C53 24 58 33 59 50 Z" fill="url(#dome)"/>
          <path d="M39 30 C43 24 50 22 56 28" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.72" stroke-linecap="round"/>
          <path d="M40 39 C43 35 52 33 57 39" fill="none" stroke="url(#domeGlass)" stroke-width="5" opacity="0.55" stroke-linecap="round"/>
          <path d="M48 42 L57 60 H39 Z" fill="#f5d77d" opacity="0.72"/>
          <g filter="url(#glow)">
            ${lights}
          </g>
          <path d="M48 21 L48 11 M42 15 L54 15" stroke="#f5d77d" stroke-width="2.4" stroke-linecap="round"/>
          <circle cx="48" cy="10" r="3.5" fill="${lightPalette[normalizedFrame % lightPalette.length]}" stroke="#050605" stroke-width="1.4"/>
        </g>
      </svg>
    `.trim();
    const icon = {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new google.maps.Size(70, 82),
      anchor: new google.maps.Point(35, 41),
    };

    vehicleIconCache.set(cacheKey, icon);
    return {
      ...icon,
    };
  }

  function setVehiclePosition(position, heading) {
    lastVehicleHeading = heading;

    if (!vehicleMarker) {
      vehicleMarker = new google.maps.Marker({
        map,
        position,
        clickable: false,
        optimized: false,
        zIndex: 1000,
        icon: makeVehicleIcon(heading),
      });
      return;
    }

    vehicleMarker.setPosition(position);
    vehicleMarker.setIcon(makeVehicleIcon(heading));
  }

  function showVehicleAtRouteStart() {
    const routePoint = getPathPointAtDistance(0);

    if (!routePoint) {
      return;
    }

    setVehiclePosition(routePoint.position, routePoint.heading);
    moveCamera(routePoint.position, routePoint.heading);
  }

  function startVehicleLights() {
    if (vehicleLightTimer) {
      return;
    }

    vehicleLightTimer = window.setInterval(() => {
      vehicleLightFrame = (vehicleLightFrame + 1) % 12;

      if (vehicleMarker) {
        vehicleMarker.setIcon(makeVehicleIcon(lastVehicleHeading));
      }
    }, 140);
  }

  function stopVehicleLights() {
    if (!vehicleLightTimer) {
      return;
    }

    window.clearInterval(vehicleLightTimer);
    vehicleLightTimer = 0;
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

  function enterNavigation(modeKey, modeLabel) {
    if (!currentRoute || !routePath.length) {
      setStatus("Route first, then start drive mode.", "error");
      return false;
    }

    navigationMode = modeKey;
    switchRouteMapMode(true, {
      zoom: 18,
      tilt: 67.5,
      heading: map?.getHeading?.() || 0,
    });
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
    showVehicleAtRouteStart();
    startVehicleLights();
    return true;
  }

  function stopNavigation() {
    const wasNavigating = Boolean(navigationMode);

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

    stopVehicleLights();

    if (vehicleMarker) {
      vehicleMarker.setMap(null);
      vehicleMarker = null;
    }

    if (currentRoute) {
      directionsPanel.hidden = false;
    }

    if (wasNavigating) {
      switchRouteMapMode(useVectorMapId, {
        tilt: useVectorMapId ? 67.5 : 45,
        zoom: useVectorMapId ? Math.max(map?.getZoom?.() || 18, 18) : map?.getZoom?.() || 12,
        heading: useVectorMapId ? map?.getHeading?.() || 0 : 0,
      });
    }
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

  function getCurrentMapCamera(useVectorMap) {
    const center = map?.getCenter()?.toJSON() || { lat: 32.4207, lng: -104.2288 };
    const zoom = map?.getZoom?.() || 12;
    const heading = map?.getHeading?.() || 0;

    return {
      center,
      zoom: useVectorMap ? Math.max(zoom, 18) : zoom,
      tilt: useVectorMap ? 67.5 : 45,
      heading,
    };
  }

  function rebindAutocompleteBounds() {
    originAutocomplete?.bindTo("bounds", map);
    destinationAutocomplete?.bindTo("bounds", map);
  }

  function createRouteMap(useVectorMap = false, overrides = {}) {
    const shouldUseVectorMap = Boolean(configuredMapId && useVectorMap);
    const mapOptions = {
      ...getCurrentMapCamera(shouldUseVectorMap),
      ...overrides,
    };

    if (shouldUseVectorMap) {
      mapOptions.mapId = configuredMapId;
      mapOptions.styles = undefined;
    }

    clearBusinessMarkers();
    map = window.createOpenWorldGameMap(mapElement, mapOptions);
    mapUsesVectorId = shouldUseVectorMap;
    placesService = google.maps.places ? new google.maps.places.PlacesService(map) : null;
    map.addListener("idle", queueBusinessRefresh);

    if (directionsRenderer) {
      directionsRenderer.setMap(map);

      if (currentRoute) {
        directionsRenderer.setDirections(currentRoute);
      }
    }

    rebindAutocompleteBounds();

    if (!navigationMode) {
      lastBusinessSearch = null;
      refreshBusinesses();
    }
  }

  function switchRouteMapMode(useVectorMap, overrides = {}) {
    const shouldUseVectorMap = Boolean(configuredMapId && useVectorMap);

    if (map && mapUsesVectorId === shouldUseVectorMap) {
      if (typeof map.moveCamera === "function" && Object.keys(overrides).length) {
        map.moveCamera({
          center: overrides.center || map.getCenter(),
          zoom: overrides.zoom || map.getZoom(),
          tilt: overrides.tilt ?? map.getTilt?.() ?? 0,
          heading: overrides.heading ?? map.getHeading?.() ?? 0,
        });
      }

      return;
    }

    createRouteMap(shouldUseVectorMap, overrides);
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

    createRouteMap(useVectorMapId, {
      center: { lat: 32.4207, lng: -104.2288 },
      zoom: useVectorMapId ? 18 : 12,
      tilt: useVectorMapId ? 67.5 : 45,
      heading: 0,
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

    if (!enterNavigation("live", "Live GPS")) {
      return;
    }

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

    if (!enterNavigation("demo", "Preview Drive")) {
      return;
    }

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
