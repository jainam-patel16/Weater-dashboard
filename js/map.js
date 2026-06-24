// map.js - Leaflet map picker + geocoding search + reverse geocoding

let map, marker;

function initMap(lat, lon, onPick){
  map = L.map('map', { zoomControl: true, attributionControl: true, fadeAnimation: true, zoomAnimation: true }).setView([lat, lon], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  // drop the "Leaflet" link/watermark from the attribution corner, keep only the
  // legally-required OSM credit (shown small + unobtrusive via CSS)
  if (map.attributionControl) map.attributionControl.setPrefix(false);

  marker = L.marker([lat, lon], {draggable:true}).addTo(map);

  map.on('click', (e) => {
    marker.setLatLng(e.latlng);
    onPick(e.latlng.lat, e.latlng.lng);
  });
  marker.on('dragend', () => {
    const p = marker.getLatLng();
    onPick(p.lat, p.lng);
  });
}

function setMapView(lat, lon){
  if (!map) return;
  map.setView([lat, lon], map.getZoom() < 4 ? 6 : map.getZoom());
  marker.setLatLng([lat, lon]);
}

// Quick-pick suggestions shown when the search box is focused but empty.
const POPULAR_PLACES = [
  { name: "New York", country: "United States", admin1: "New York", latitude: 40.7128, longitude: -74.0060 },
  { name: "London", country: "United Kingdom", admin1: "England", latitude: 51.5074, longitude: -0.1278 },
  { name: "Tokyo", country: "Japan", admin1: "Tokyo", latitude: 35.6762, longitude: 139.6503 },
  { name: "Paris", country: "France", admin1: "Île-de-France", latitude: 48.8566, longitude: 2.3522 },
  { name: "Mumbai", country: "India", admin1: "Maharashtra", latitude: 19.0760, longitude: 72.8777 },
  { name: "New Delhi", country: "India", admin1: "Delhi", latitude: 28.6139, longitude: 77.2090 },
  { name: "Dubai", country: "United Arab Emirates", admin1: "Dubai", latitude: 25.2048, longitude: 55.2708 },
  { name: "Sydney", country: "Australia", admin1: "New South Wales", latitude: -33.8688, longitude: 151.2093 },
  { name: "Singapore", country: "Singapore", admin1: "", latitude: 1.3521, longitude: 103.8198 },
  { name: "São Paulo", country: "Brazil", admin1: "São Paulo", latitude: -23.5505, longitude: -46.6333 },
];

// --- Geocoding search (Open-Meteo geocoding, free no key) ---
let _searchDebounce = null;
async function geocodeSearch(query){
  if (!query || query.trim().length < 2) return [];
  const params = new URLSearchParams({ name: query, count: 8, language: "en", format: "json" });
  const resp = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`);
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.results || [];
}

// --- Reverse geocoding (BigDataCloud free client endpoint, no key) ---
async function reverseGeocode(lat, lon){
  try{
    const params = new URLSearchParams({ latitude: lat, longitude: lon, localityLanguage: "en" });
    const resp = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params.toString()}`);
    if (!resp.ok) throw new Error("reverse geocode failed");
    const data = await resp.json();
    const name = data.city || data.locality || data.principalSubdivision || "Unknown place";
    const country = data.countryName || "";
    return { name, country };
  }catch(e){
    return { name: `${lat.toFixed(3)}, ${lon.toFixed(3)}`, country: "" };
  }
}
