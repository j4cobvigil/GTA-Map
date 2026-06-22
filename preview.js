(function () {
  const keyForm = document.querySelector("#key-form");
  const keyInput = document.querySelector("#api-key");
  const fallback = document.querySelector("#fallback");
  const params = new URLSearchParams(window.location.search);
  const urlKey = params.get("key");
  const configuredKey = typeof window.GOOGLE_MAPS_API_KEY === "string"
    ? window.GOOGLE_MAPS_API_KEY.trim()
    : "";

  function initMap() {
    fallback?.remove();
    keyForm.hidden = true;

    window.createOpenWorldGameMap(document.querySelector("#map"));
  }

  function showManualKeyEntry() {
    keyForm.hidden = false;
    keyInput.placeholder = "AIza...";
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
    script.onerror = showManualKeyEntry;
    document.head.appendChild(script);
  }

  window.initOpenWorldMap = initMap;

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
  }
})();
