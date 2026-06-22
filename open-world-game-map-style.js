const openWorldGameMapStyle = [
  {
    elementType: "geometry",
    stylers: [{ color: "#3c4035" }],
  },
  {
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#f3ecd4" }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#10130f" }, { weight: 3 }],
  },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1a1d18" }, { weight: 1.4 }],
  },
  {
    featureType: "administrative.land_parcel",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#fff7d8" }],
  },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#474b3a" }],
  },
  {
    featureType: "landscape.man_made",
    elementType: "geometry",
    stylers: [{ color: "#34382f" }],
  },
  {
    featureType: "landscape.natural",
    elementType: "geometry",
    stylers: [{ color: "#596044" }],
  },
  {
    featureType: "landscape.natural.terrain",
    elementType: "geometry",
    stylers: [{ color: "#6b684a" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#30342c" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d9cfaa" }],
  },
  {
    featureType: "poi.business",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#48673d" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#c8db9b" }],
  },
  {
    featureType: "road",
    elementType: "geometry.fill",
    stylers: [{ color: "#f1ead2" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#0a0c09" }, { weight: 1.8 }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#fff6d2" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#050605" }, { weight: 3.4 }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry.fill",
    stylers: [{ color: "#fff4cc" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry.stroke",
    stylers: [{ color: "#050605" }, { weight: 2 }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.fill",
    stylers: [{ color: "#faf1c8" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#050605" }, { weight: 2.8 }],
  },
  {
    featureType: "road.highway.controlled_access",
    elementType: "geometry.fill",
    stylers: [{ color: "#f5d77d" }],
  },
  {
    featureType: "road.highway.controlled_access",
    elementType: "geometry.stroke",
    stylers: [{ color: "#050605" }, { weight: 3 }],
  },
  {
    featureType: "road.local",
    elementType: "geometry.fill",
    stylers: [{ color: "#e7dfc1" }],
  },
  {
    featureType: "road.local",
    elementType: "labels.text.fill",
    stylers: [{ color: "#e9ddb5" }],
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#1f6272" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#b7ecf2" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#07242b" }, { weight: 2.6 }],
  },
];

const openWorldGameMapOptions = {
  center: { lat: 34.0522, lng: -118.2437 },
  zoom: 12,
  styles: openWorldGameMapStyle,
  backgroundColor: "#1f6272",
  disableDefaultUI: true,
  zoomControl: true,
  fullscreenControl: true,
  gestureHandling: "greedy",
};

function createOpenWorldGameMap(element, options = {}) {
  return new google.maps.Map(element, {
    ...openWorldGameMapOptions,
    ...options,
    styles: options.styles || openWorldGameMapStyle,
  });
}

window.openWorldGameMapStyle = openWorldGameMapStyle;
window.openWorldGameMapOptions = openWorldGameMapOptions;
window.createOpenWorldGameMap = createOpenWorldGameMap;

if (typeof document !== "undefined" && document.documentElement) {
  document.documentElement.dataset.openWorldMapRules = String(openWorldGameMapStyle.length);
}
