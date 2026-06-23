(function () {
  const routePanel = document.querySelector(".route-panel");
  const routeForm = document.querySelector("#route-form");
  const routeStatus = document.querySelector("#route-status");
  const originInput = document.querySelector("#origin");
  const destinationInput = document.querySelector("#destination");
  const travelModeSelect = document.querySelector("#travel-mode");
  const swapRouteButton = document.querySelector("#swap-route");
  const startDriveButton = document.querySelector("#start-drive");
  const demoDriveButton = document.querySelector("#demo-drive");
  const directionsPanel = document.querySelector("#directions-panel");
  const sideMissionsPanel = document.querySelector("#side-missions");
  const sideMissionsList = document.querySelector("#side-missions-list");
  const sideMissionsCount = document.querySelector("#side-missions-count");
  const navigationHud = document.querySelector("#navigation-hud");
  const navMode = document.querySelector("#nav-mode");
  const navInstruction = document.querySelector("#nav-instruction");
  const navDetail = document.querySelector("#nav-detail");
  const stopNavigationButton = document.querySelector("#stop-navigation");
  const toggleRoutePanelButton = document.querySelector("#toggle-route-panel");
  const keyForm = document.querySelector("#key-form");
  const keyInput = document.querySelector("#api-key");
  const mapElement = document.querySelector("#map");
  const fireworksElement = document.querySelector("#fireworks");
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
  const routeLineStyle = {
    normal: {
      strokeColor: "#f5d77d",
      strokeOpacity: 0.95,
      strokeWeight: 6,
    },
    navigation: {
      strokeColor: "#00b7ff",
      strokeOpacity: 1,
      strokeWeight: 12,
    },
  };
  const businessTypes = [
    "restaurant",
    "gas_station",
    "cafe",
    "store",
    "lodging",
    "atm",
  ];
  const sideMissionTypes = [
    { type: "tourist_attraction", label: "Landmark" },
    { type: "museum", label: "Museum" },
    { type: "park", label: "Outdoor" },
    { type: "art_gallery", label: "Art" },
    { type: "bowling_alley", label: "Arcade" },
    { type: "movie_theater", label: "Cinema" },
    { type: "amusement_park", label: "Thrill" },
    { type: "zoo", label: "Wildlife" },
    { type: "aquarium", label: "Aquarium" },
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
  const sideMissionStyles = {
    tourist_attraction: { label: "Landmark", color: "#ff63d8" },
    museum: { label: "Museum", color: "#8e7bff" },
    park: { label: "Outdoor", color: "#5eff7d" },
    art_gallery: { label: "Art", color: "#ffb800" },
    bowling_alley: { label: "Arcade", color: "#54f2f2" },
    movie_theater: { label: "Cinema", color: "#ff375f" },
    amusement_park: { label: "Thrill", color: "#f5d77d" },
    zoo: { label: "Wildlife", color: "#c8db9b" },
    aquarium: { label: "Aquarium", color: "#00b7ff" },
    default: { label: "Side Mission", color: "#f5d77d" },
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
  let sideMissionMarkers = [];
  let sideMissionPlaces = [];
  const routeTargets = new Map();
  let hasSubmittedRoute = false;
  let routeTimer = 0;
  let businessTimer = 0;
  let lastBusinessSearch = null;
  let placeSearchToken = 0;
  let currentRoute = null;
  let currentDestination = null;
  let routePath = [];
  let routeSteps = [];
  let routeLengthMeters = 0;
  let navigationRouteLine = null;
  let completedDestination = null;
  let completedDestinationMarker = null;
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

  function setRoutePanelMinimized(isMinimized) {
    routePanel?.classList.toggle("is-minimized", isMinimized);

    if (!toggleRoutePanelButton) {
      return;
    }

    toggleRoutePanelButton.textContent = isMinimized ? "+" : "-";
    toggleRoutePanelButton.setAttribute("aria-expanded", String(!isMinimized));
    toggleRoutePanelButton.setAttribute(
      "aria-label",
      isMinimized ? "Restore route panel" : "Minimize route panel",
    );
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

  function getLocationText(location) {
    if (!location) {
      return "";
    }

    return `${location.lat().toFixed(6)}, ${location.lng().toFixed(6)}`;
  }

  function getRouteTargetId(prefix, name, location, placeId = "") {
    if (placeId) {
      return `${prefix}:${placeId}`;
    }

    return `${prefix}:${name || "location"}:${getLocationText(location)}`;
  }

  function registerRouteTarget(target) {
    routeTargets.set(target.id, target);
    return target.id;
  }

  function registerPlaceRouteTarget(prefix, place, label = "Destination") {
    const location = place.geometry?.location;
    const name = place.name || label;
    const id = getRouteTargetId(prefix, name, location, place.place_id || "");

    return registerRouteTarget({
      id,
      name,
      formattedAddress: place.formatted_address || place.vicinity || name,
      placeId: place.place_id || "",
      location,
    });
  }

  function makeRouteInfoContent(title, detail, targetId) {
    return `
      <div class="map-info-window">
        <strong>${escapeHtml(title)}</strong>
        ${detail ? `<span>${escapeHtml(detail)}</span>` : ""}
        <button class="map-route-button" type="button" data-route-target="${escapeHtml(targetId)}">Route</button>
      </div>
    `;
  }

  function routeToTarget(targetId) {
    const target = routeTargets.get(targetId);

    if (!target) {
      return;
    }

    if (target.placeId) {
      destinationPlace = {
        place_id: target.placeId,
        name: target.name,
        formatted_address: target.formattedAddress || target.name,
      };
      destinationInput.value = target.name;
    } else {
      destinationPlace = null;
      destinationInput.value = getLocationText(target.location) || target.name;
    }

    if (target.location && map) {
      map.panTo(target.location);
    }

    setRoutePanelMinimized(false);
    route();
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

  function setRouteLineStyle(mode = "normal") {
    const directions = directionsRenderer?.getDirections();

    directionsRenderer?.setOptions({
      polylineOptions: routeLineStyle[mode] || routeLineStyle.normal,
    });

    if (directions) {
      directionsRenderer.setDirections(directions);
    }
  }

  function clearNavigationRouteLine() {
    if (!navigationRouteLine) {
      return;
    }

    navigationRouteLine.setMap(null);
    navigationRouteLine = null;
  }

  function showNavigationRouteLine() {
    clearNavigationRouteLine();

    if (!map || !routePath.length || !google.maps.Polyline) {
      return;
    }

    navigationRouteLine = new google.maps.Polyline({
      map,
      path: routePath,
      clickable: false,
      geodesic: true,
      zIndex: 2000,
      ...routeLineStyle.navigation,
    });
  }

  function makeCompletedDestinationIcon() {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 58">
        <defs>
          <radialGradient id="targetGlow" cx="50%" cy="38%" r="62%">
            <stop offset="0" stop-color="#fff7d8"/>
            <stop offset="0.42" stop-color="#00b7ff"/>
            <stop offset="1" stop-color="#101828"/>
          </radialGradient>
          <filter id="shadow" x="-35%" y="-25%" width="170%" height="170%">
            <feDropShadow dx="0" dy="5" stdDeviation="3.5" flood-color="#050605" flood-opacity="0.78"/>
          </filter>
        </defs>
        <g filter="url(#shadow)">
          <path d="M24 3 C12.7 3 5 10.8 5 22 C5 38 24 55 24 55 C24 55 43 38 43 22 C43 10.8 35.3 3 24 3 Z" fill="#050605"/>
          <path d="M24 7 C15.2 7 9 13.3 9 22 C9 34.2 20.2 46.3 24 50 C27.8 46.3 39 34.2 39 22 C39 13.3 32.8 7 24 7 Z" fill="url(#targetGlow)"/>
          <circle cx="24" cy="22" r="13" fill="#14170f" opacity="0.92"/>
          <path d="M17 16 H30 L28 21 H17 Z M17 16 V32" fill="none" stroke="#fff7d8" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M20 18 H25 M20 21 H28" stroke="#00b7ff" stroke-width="1.8" stroke-linecap="round"/>
          <circle cx="24" cy="22" r="4" fill="#f5d77d"/>
        </g>
      </svg>
    `.trim();

    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new google.maps.Size(42, 51),
      anchor: new google.maps.Point(21, 51),
    };
  }

  function clearCompletedDestinationMarker() {
    if (completedDestinationMarker) {
      completedDestinationMarker.setMap(null);
      completedDestinationMarker = null;
    }

    completedDestination = null;
  }

  function showCompletedDestinationMarker(destination) {
    if (!destination?.location || !map) {
      return;
    }

    clearCompletedDestinationMarker();
    completedDestination = destination;
    completedDestinationMarker = new google.maps.Marker({
      map,
      position: destination.location,
      title: destination.title || "Destination reached",
      icon: makeCompletedDestinationIcon(),
      zIndex: 2200,
    });
    const targetId = registerRouteTarget({
      id: getRouteTargetId("completed", destination.title || "Destination", destination.location),
      name: destination.title || "Destination",
      formattedAddress: destination.title || "Destination",
      placeId: "",
      location: destination.location,
    });

    const infoWindow = new google.maps.InfoWindow({
      content: makeRouteInfoContent("Destination complete", destination.title || "Arrived", targetId),
    });

    completedDestinationMarker.addListener("click", () => infoWindow.open({
      anchor: completedDestinationMarker,
      map,
    }));
  }

  function createDirectionsRenderer() {
    const renderer = new google.maps.DirectionsRenderer({
      map,
      panel: directionsPanel,
      preserveViewport: false,
      suppressMarkers: false,
      polylineOptions: routeLineStyle.normal,
    });

    renderer.addListener("directions_changed", updateRouteSummary);
    return renderer;
  }

  function clearRenderedRoute() {
    clearNavigationRouteLine();

    if (directionsRenderer) {
      google.maps.event?.clearListeners?.(directionsRenderer, "directions_changed");
      directionsRenderer.setMap(null);
    }

    directionsPanel.innerHTML = "";
    directionsPanel.hidden = true;
    currentRoute = null;
    currentDestination = null;
    routePath = [];
    routeSteps = [];
    routeLengthMeters = 0;
    startDriveButton.disabled = true;
    demoDriveButton.disabled = true;

    if (map && google.maps.DirectionsRenderer) {
      directionsRenderer = createDirectionsRenderer();
    }
  }

  function launchFireworks() {
    if (!fireworksElement) {
      return;
    }

    const colors = ["#00b7ff", "#54f2f2", "#f5d77d", "#ff63d8", "#5eff7d", "#ff375f"];
    const burstCount = 6;
    const sparksPerBurst = 24;

    fireworksElement.innerHTML = "";
    fireworksElement.hidden = false;

    for (let burstIndex = 0; burstIndex < burstCount; burstIndex += 1) {
      const burst = document.createElement("div");
      burst.className = "firework-burst";
      burst.style.left = `${18 + Math.random() * 64}%`;
      burst.style.top = `${12 + Math.random() * 52}%`;

      for (let sparkIndex = 0; sparkIndex < sparksPerBurst; sparkIndex += 1) {
        const spark = document.createElement("span");
        const color = colors[(sparkIndex + burstIndex) % colors.length];
        spark.className = "firework-spark";
        spark.style.setProperty("--spark-color", color);
        spark.style.setProperty("--spark-angle", `${(360 / sparksPerBurst) * sparkIndex}deg`);
        spark.style.setProperty("--spark-distance", `${54 + Math.random() * 62}px`);
        spark.style.animationDelay = `${burstIndex * 110 + Math.random() * 80}ms`;
        burst.appendChild(spark);
      }

      fireworksElement.appendChild(burst);
    }

    window.setTimeout(() => {
      fireworksElement.innerHTML = "";
      fireworksElement.hidden = true;
    }, 2100);
  }

  function prepareRoute(result) {
    currentRoute = result;
    const route = result.routes[0];
    const legs = route?.legs || [];
    const lastLeg = legs[legs.length - 1];
    const detailedPath = legs.flatMap((leg) => (
      leg.steps || []
    ).flatMap((step) => step.path || []));
    routePath = detailedPath.length ? detailedPath : route?.overview_path || [];
    currentDestination = {
      location: lastLeg?.end_location || routePath[routePath.length - 1] || null,
      title: lastLeg?.end_address || destinationInput.value.trim() || "Destination",
    };
    routeLengthMeters = getPathLength(routePath);
    let cursor = 0;

    routeSteps = legs.flatMap((leg) => (
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
    placeSearchToken += 1;
    switchRouteMapMode(true, {
      zoom: 18,
      tilt: 67.5,
      heading: map?.getHeading?.() || 0,
    });
    setRouteLineStyle("navigation");
    showNavigationRouteLine();
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

  function stopNavigation(options = {}) {
    const { revealDirections = true } = options;
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
    clearNavigationRouteLine();

    if (vehicleMarker) {
      vehicleMarker.setMap(null);
      vehicleMarker = null;
    }

    if (revealDirections && currentRoute) {
      directionsPanel.hidden = false;
    }

    if (wasNavigating) {
      setRouteLineStyle("normal");
      switchRouteMapMode(useVectorMapId, {
        tilt: useVectorMapId ? 67.5 : 45,
        zoom: useVectorMapId ? Math.max(map?.getZoom?.() || 18, 18) : map?.getZoom?.() || 12,
        heading: useVectorMapId ? map?.getHeading?.() || 0 : 0,
      });
    }
  }

  function hasReachedDestination(position, distanceAlongRoute) {
    if (!routeLengthMeters) {
      return false;
    }

    const remainingRouteMeters = Math.max(routeLengthMeters - distanceAlongRoute, 0);
    const destinationDistanceMeters = currentDestination?.location
      ? getSegmentLength(position, currentDestination.location)
      : remainingRouteMeters;

    return remainingRouteMeters <= 35 || destinationDistanceMeters <= 55;
  }

  function completeArrival() {
    const fallbackDestination = routePath.length
      ? { location: routePath[routePath.length - 1], title: destinationInput.value.trim() || "Destination" }
      : null;
    const destination = currentDestination || fallbackDestination;

    launchFireworks();
    stopNavigation({ revealDirections: false });
    clearRenderedRoute();

    if (destination) {
      showCompletedDestinationMarker(destination);
    }

    setStatus("Arrived. Route cleared.", "success");
    return true;
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

  function getPrimarySideMissionType(place) {
    return sideMissionTypes.find((missionType) => place.types?.includes(missionType.type))?.type || "default";
  }

  function makeSideMissionIcon(type) {
    const style = sideMissionStyles[type] || sideMissionStyles.default;
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 56">
        <defs>
          <radialGradient id="missionGlow" cx="50%" cy="35%" r="62%">
            <stop offset="0" stop-color="#fff7d8"/>
            <stop offset="0.38" stop-color="${style.color}"/>
            <stop offset="1" stop-color="#221033"/>
          </radialGradient>
          <filter id="shadow" x="-30%" y="-20%" width="160%" height="160%">
            <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#050605" flood-opacity="0.75"/>
          </filter>
        </defs>
        <g filter="url(#shadow)">
          <path d="M24 3 C12.7 3 5 10.8 5 22 C5 37.5 24 53 24 53 C24 53 43 37.5 43 22 C43 10.8 35.3 3 24 3 Z" fill="#050605"/>
          <path d="M24 7 C15.4 7 9 13.2 9 22 C9 33.3 20.1 44.7 24 48.4 C27.9 44.7 39 33.3 39 22 C39 13.2 32.6 7 24 7 Z" fill="url(#missionGlow)"/>
          <circle cx="24" cy="22" r="13" fill="#14170f" opacity="0.92"/>
          <path d="M24 10 L27.6 18.2 L36 19 L29.6 24.4 L31.5 33 L24 28.5 L16.5 33 L18.4 24.4 L12 19 L20.4 18.2 Z" fill="${style.color}" stroke="#fff7d8" stroke-width="1.6" stroke-linejoin="round"/>
          <circle cx="24" cy="22" r="4" fill="#fff7d8"/>
        </g>
      </svg>
    `.trim();

    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new google.maps.Size(38, 44),
      anchor: new google.maps.Point(19, 44),
    };
  }

  function getSideMissionId(place) {
    if (place.place_id) {
      return place.place_id;
    }

    const location = place.geometry?.location;
    return `${place.name || "mission"}:${location?.lat?.() || 0}:${location?.lng?.() || 0}`;
  }

  function getSideMissionDistance(place, origin) {
    if (!origin || !place.geometry?.location) {
      return 0;
    }

    return getSegmentLength(origin, place.geometry.location);
  }

  function formatMissionDistance(distanceMeters) {
    if (!distanceMeters) {
      return "nearby";
    }

    const miles = metersToMiles(distanceMeters);
    return miles < 0.1 ? "nearby" : `${miles.toFixed(1)} mi`;
  }

  function normalizeSideMission(place, origin) {
    const type = getPrimarySideMissionType(place);
    const style = sideMissionStyles[type] || sideMissionStyles.default;

    return {
      id: getSideMissionId(place),
      place,
      type,
      label: style.label,
      distanceMeters: getSideMissionDistance(place, origin),
      rating: place.rating || 0,
      ratingsTotal: place.user_ratings_total || 0,
    };
  }

  function sortSideMissions() {
    sideMissionPlaces.sort((first, second) => (
      second.rating - first.rating
      || second.ratingsTotal - first.ratingsTotal
      || first.distanceMeters - second.distanceMeters
    ));
  }

  function renderSideMissions() {
    if (!sideMissionsPanel || !sideMissionsList || !sideMissionsCount) {
      return;
    }

    if (!sideMissionPlaces.length) {
      sideMissionsPanel.hidden = true;
      sideMissionsList.innerHTML = "";
      sideMissionsCount.textContent = "0 nearby";
      return;
    }

    sideMissionsPanel.hidden = false;
    sideMissionsCount.textContent = `${sideMissionPlaces.length} nearby`;
    sideMissionsList.innerHTML = sideMissionPlaces.map((mission, index) => {
      const name = escapeHtml(mission.place.name || mission.label);
      const vicinity = mission.place.vicinity ? escapeHtml(mission.place.vicinity) : "";
      const rating = mission.rating ? ` / ${mission.rating.toFixed(1)} stars` : "";
      const meta = `${mission.label} / ${formatMissionDistance(mission.distanceMeters)}${rating}`;

      return `
        <article class="side-mission-card">
          <button class="side-mission-main" type="button" data-side-mission-focus="${escapeHtml(mission.id)}">
            <span class="side-mission-rank">SM-${String(index + 1).padStart(2, "0")}</span>
            <strong>${name}</strong>
            <span>${escapeHtml(meta)}</span>
            ${vicinity ? `<small>${vicinity}</small>` : ""}
          </button>
          <button class="side-mission-route" type="button" data-side-mission-route="${escapeHtml(mission.id)}">Route</button>
        </article>
      `;
    }).join("");
  }

  function clearSideMissionMarkers() {
    sideMissionMarkers.forEach((marker) => marker.setMap(null));
    sideMissionMarkers = [];
    sideMissionPlaces = [];
    renderSideMissions();
  }

  function clearBusinessMarkers() {
    businessMarkers.forEach((marker) => marker.setMap(null));
    businessMarkers = [];
  }

  function addSideMission(place, origin) {
    const mission = normalizeSideMission(place, origin);
    mission.routeTargetId = registerPlaceRouteTarget("side", place, mission.label);
    const marker = new google.maps.Marker({
      map,
      position: place.geometry.location,
      title: `Side Mission: ${place.name}`,
      icon: makeSideMissionIcon(mission.type),
      zIndex: 700,
    });
    const distance = formatMissionDistance(mission.distanceMeters);
    const rating = mission.rating ? ` / ${mission.rating.toFixed(1)} stars` : "";
    const infoWindow = new google.maps.InfoWindow({
      content: makeRouteInfoContent(
        "Side Mission",
        `${place.name || mission.label} / ${mission.label} / ${distance}${rating}`,
        mission.routeTargetId,
      ),
    });

    marker.sideMissionId = mission.id;
    marker.addListener("click", () => infoWindow.open({ anchor: marker, map }));
    sideMissionMarkers.push(marker);
    sideMissionPlaces.push(mission);
    sortSideMissions();
    renderSideMissions();
  }

  function findSideMission(id) {
    return sideMissionPlaces.find((mission) => mission.id === id);
  }

  function focusSideMission(id) {
    const mission = findSideMission(id);

    if (!mission?.place.geometry?.location || !map) {
      return;
    }

    map.panTo(mission.place.geometry.location);
    map.setZoom(Math.max(map.getZoom?.() || 15, 16));
    const marker = sideMissionMarkers.find((candidate) => candidate.sideMissionId === id);

    if (marker && google.maps.Animation?.BOUNCE) {
      marker.setAnimation(google.maps.Animation.BOUNCE);
      window.setTimeout(() => marker.setAnimation(null), 900);
    }
  }

  function routeToSideMission(id) {
    const mission = findSideMission(id);

    if (!mission) {
      return;
    }

    focusSideMission(id);
    routeToTarget(mission.routeTargetId);
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
    const destinationToRestore = completedDestination;
    const mapOptions = {
      ...getCurrentMapCamera(shouldUseVectorMap),
      ...overrides,
    };

    if (shouldUseVectorMap) {
      mapOptions.mapId = configuredMapId;
      mapOptions.styles = undefined;
    }

    clearBusinessMarkers();
    clearSideMissionMarkers();
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

    if (destinationToRestore) {
      showCompletedDestinationMarker(destinationToRestore);
    }

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

  function getNearbySearchOrigin(fallbackCenter) {
    if (currentLocationCache && Date.now() - currentLocationCache.timestamp < 600000) {
      return new google.maps.LatLng(
        currentLocationCache.location.lat,
        currentLocationCache.location.lng,
      );
    }

    return fallbackCenter;
  }

  function refreshBusinesses() {
    if (!placesService || !map) {
      return;
    }

    const center = map.getCenter();

    if (!center) {
      return;
    }

    const searchOrigin = getNearbySearchOrigin(center);
    const searchCenter = { lat: searchOrigin.lat(), lng: searchOrigin.lng() };
    const movedFarEnough = !lastBusinessSearch
      || Math.abs(lastBusinessSearch.lat - searchCenter.lat) > 0.01
      || Math.abs(lastBusinessSearch.lng - searchCenter.lng) > 0.01;

    if (!movedFarEnough) {
      return;
    }

    lastBusinessSearch = searchCenter;
    const searchToken = ++placeSearchToken;
    clearBusinessMarkers();
    clearSideMissionMarkers();
    const seenPlaceIds = new Set();
    const seenSideMissionIds = new Set();

    businessTypes.forEach((type) => {
      placesService.nearbySearch({
        location: searchOrigin,
        radius: 2200,
        type,
      }, (results, status) => {
        if (searchToken !== placeSearchToken || navigationMode) {
          return;
        }

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
          const targetId = registerPlaceRouteTarget("business", place, markerStyles[type]?.label || "Location");
          const marker = new google.maps.Marker({
            map,
            position: place.geometry.location,
            title: place.name,
            icon: makeBusinessIcon(type),
          });
          const label = markerStyles[type]?.label || markerStyles.default.label;
          const infoWindow = new google.maps.InfoWindow({
            content: makeRouteInfoContent(place.name || label, label, targetId),
          });

          marker.addListener("click", () => infoWindow.open({ anchor: marker, map }));
          businessMarkers.push(marker);
        });
      });
    });

    sideMissionTypes.forEach((missionType) => {
      placesService.nearbySearch({
        location: searchOrigin,
        radius: 4200,
        type: missionType.type,
      }, (results, status) => {
        if (searchToken !== placeSearchToken || navigationMode) {
          return;
        }

        if (status !== google.maps.places.PlacesServiceStatus.OK || !results?.length) {
          return;
        }

        const places = results.filter((place) => {
          const id = getSideMissionId(place);

          if (!place.geometry?.location || seenSideMissionIds.has(id)) {
            return false;
          }

          seenSideMissionIds.add(id);
          return true;
        }).slice(0, 3);

        places.forEach((place) => {
          if (sideMissionPlaces.length >= 8) {
            return;
          }

          addSideMission(place, searchOrigin);
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
    directionsRenderer = createDirectionsRenderer();
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
      clearCompletedDestinationMarker();
      queueRoute();
    });
    travelModeSelect.addEventListener("change", queueRoute);

    startDriveButton.disabled = true;
    demoDriveButton.disabled = true;
    refreshBusinesses();
    setStatus("Enter a destination. Start is your current location by default.", "idle");
  }

  function showManualKeyEntry(message = "Map key missing. Paste the key once, or deploy with the GitHub Actions variable.") {
    setRoutePanelMinimized(false);
    keyForm.hidden = false;
    routeForm.hidden = true;
    directionsPanel.hidden = true;
    sideMissionsPanel.hidden = true;
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
    return hasReachedDestination(position, distanceAlongRoute) ? completeArrival() : false;
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
        const arrived = updateLivePosition(position.coords);

        if (!arrived) {
          setStatus("Live drive mode active.", "success");
        }
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
      completeArrival();
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
    clearCompletedDestinationMarker();
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
          currentDestination = null;
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
  toggleRoutePanelButton?.addEventListener("click", () => {
    setRoutePanelMinimized(!routePanel?.classList.contains("is-minimized"));
  });

  document.addEventListener("click", (event) => {
    const routeButton = event.target.closest("[data-route-target]");

    if (!routeButton) {
      return;
    }

    event.preventDefault();
    routeToTarget(routeButton.dataset.routeTarget);
  });

  sideMissionsList?.addEventListener("click", (event) => {
    const routeButton = event.target.closest("[data-side-mission-route]");
    const focusButton = event.target.closest("[data-side-mission-focus]");

    if (routeButton) {
      routeToSideMission(routeButton.dataset.sideMissionRoute);
      return;
    }

    if (focusButton) {
      focusSideMission(focusButton.dataset.sideMissionFocus);
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
