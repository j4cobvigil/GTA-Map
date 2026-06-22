(function () {
  const keyForm = document.querySelector("#key-form");
  const keyInput = document.querySelector("#api-key");
  const fallback = document.querySelector("#fallback");
  const params = new URLSearchParams(window.location.search);
  const urlKey = params.get("key");

  function initMap() {
    fallback.remove();

    const map = window.createOpenWorldGameMap(document.querySelector("#map"));

    new google.maps.Marker({
      position: { lat: 34.0522, lng: -118.2437 },
      map,
      title: "Los Angeles",
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: "#f5d77d",
        fillOpacity: 1,
        strokeColor: "#050605",
        strokeWeight: 3,
      },
    });
  }

  function loadGoogleMaps(apiKey) {
    if (!apiKey || window.google?.maps) {
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=initOpenWorldMap`;
    script.async = true;
    script.defer = true;
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
  }
})();
