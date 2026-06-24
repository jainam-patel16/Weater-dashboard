// map.js - Leaflet map picker + geocoding search + reverse geocoding

let map, marker;

function initMap(lat, lon, onPick){
  map = L.map('map', { zoomControl: true, attributionControl: true }).setView([lat, lon], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

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
