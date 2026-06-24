// app.js - orchestration: state, event wiring, refresh loop

const state = {
  lat: 28.6139, lon: 77.2090, // default: New Delhi
  name: "New Delhi", country: "India",
  utcOffsetSeconds: 19800,
  timezone: "Asia/Kolkata",
  clockTimer: null,
  refreshTimer: null
};

async function loadAll(){
  setLastUpdated();
  try{
    const [weather, aqi] = await Promise.all([
      fetchWeather(state.lat, state.lon),
      fetchAQI(state.lat, state.lon).catch(() => ({}))
    ]);

    state.utcOffsetSeconds = weather.utcOffsetSeconds;
    state.timezone = weather.timezone;

    renderLocation({ name: state.name, country: state.country, lat: state.lat, lon: state.lon, timezone: state.timezone });
    renderCurrentWeather(weather);
    renderUV(weather.current.uvIndex);
    renderHourly(weather);
    renderDaily(weather);
    renderAQI(aqi);

    const now = new Date();
    const sun = getSunData(state.lat, state.lon, now);
    const moon = getMoonData(state.lat, state.lon, now);
    renderSun(sun);
    renderMoon(moon);

    const skyObjects = getSkyObjects(state.lat, state.lon, now);
    renderSky(skyObjects, weather.current.isDay === 1);

    restartClock();
  }catch(err){
    console.error(err);
    $('lastUpdated').textContent = "Failed to load data — check connection and retry.";
  }
}

function restartClock(){
  if (state.clockTimer) clearInterval(state.clockTimer);
  updateClock(state.utcOffsetSeconds);
  state.clockTimer = setInterval(() => updateClock(state.utcOffsetSeconds), 1000);
}

function restartAutoRefresh(){
  if (state.refreshTimer) clearInterval(state.refreshTimer);
  if ($('autoRefresh').checked){
    state.refreshTimer = setInterval(loadAll, 2 * 60 * 1000);
  }
}

async function setLocation(lat, lon, name, country){
  state.lat = lat; state.lon = lon;
  state.name = name || `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
  state.country = country || "";
  setMapView(lat, lon);
  await loadAll();
}

function wireSearch(){
  const input = $('searchInput');
  const resultsBox = $('searchResults');

  input.addEventListener('input', () => {
    clearTimeout(window._searchTimer);
    const q = input.value;
    window._searchTimer = setTimeout(async () => {
      const results = await geocodeSearch(q);
      resultsBox.innerHTML = '';
      if (!results.length){ resultsBox.classList.remove('show'); return; }
      results.forEach(r => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        const region = [r.admin1, r.country].filter(Boolean).join(', ');
        div.innerHTML = `${r.name}<small>${region}</small>`;
        div.addEventListener('click', () => {
          setLocation(r.latitude, r.longitude, r.name, r.country);
          resultsBox.classList.remove('show');
          input.value = `${r.name}, ${r.country || ''}`;
        });
        resultsBox.appendChild(div);
      });
      resultsBox.classList.add('show');
    }, 350);
  });

  document.addEventListener('click', (e) => {
    if (!resultsBox.contains(e.target) && e.target !== input){
      resultsBox.classList.remove('show');
    }
  });
}

function wireControls(){
  $('geoBtn').addEventListener('click', () => {
    if (!navigator.geolocation){
      alert('Geolocation not supported by this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const place = await reverseGeocode(latitude, longitude);
      setLocation(latitude, longitude, place.name, place.country);
    }, (err) => {
      alert('Could not get your location: ' + err.message);
    });
  });

  $('refreshBtn').addEventListener('click', loadAll);
  $('autoRefresh').addEventListener('change', restartAutoRefresh);
}

async function init(){
  initMap(state.lat, state.lon, async (lat, lon) => {
    const place = await reverseGeocode(lat, lon);
    setLocation(lat, lon, place.name, place.country);
  });

  wireSearch();
  wireControls();
  await loadAll();
  restartAutoRefresh();

  // try to auto-detect user's location on first load (non-blocking, falls back silently)
  if (navigator.geolocation){
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const place = await reverseGeocode(latitude, longitude);
      setLocation(latitude, longitude, place.name, place.country);
    }, () => { /* ignore, keep default */ }, { timeout: 4000 });
  }
}

document.addEventListener('DOMContentLoaded', init);
