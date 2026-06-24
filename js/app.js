// app.js - orchestration: state, event wiring, refresh loop

const state = {
  lat: 28.6139, lon: 77.2090, // default: New Delhi
  name: "New Delhi", country: "India",
  utcOffsetSeconds: 19800,
  timezone: "Asia/Kolkata",
  clockTimer: null,
  refreshTimer: null
};

// briefly flash a highlight on an element so the user notices it just refreshed
function pulseEl(id){
  const el = typeof id === 'string' ? $(id) : id;
  if (!el) return;
  el.classList.remove('val-updated');
  // restart the animation even if it's already mid-flight
  void el.offsetWidth;
  el.classList.add('val-updated');
}

function pulseUpdatedValues(){
  ['currentTemp','feelsLike','humidity','wind','pressure','visibility','cloudCover',
   'dewPoint','precip','windGust','aqiValue','uvValue','windSpeedBig'].forEach(pulseEl);
}

async function loadAll(){
  setLastUpdated();
  const refreshBtn = $('refreshBtn');
  if (refreshBtn) refreshBtn.classList.add('is-loading');
  try{
    const sunNow = getSunData(state.lat, state.lon, new Date());
    const [weather, aqi, aurora] = await Promise.all([
      fetchWeather(state.lat, state.lon),
      fetchAQI(state.lat, state.lon).catch(() => ({})),
      fetchAuroraData(state.lat, state.lon, sunNow.altitudeDeg).catch(() => ({ available:false, advice:"Live aurora data is unavailable right now." }))
    ]);

    state.utcOffsetSeconds = weather.utcOffsetSeconds;
    state.timezone = weather.timezone;

    state.lastWeather = weather;

    renderLocation({ name: state.name, country: state.country, lat: state.lat, lon: state.lon, timezone: state.timezone });
    renderCurrentWeather(weather);
    WeatherFX.setWeather(weather.current.weatherCode, weather.current.isDay === 1);
    renderUV(weather.current.uvIndex);
    renderHourly(weather);
    renderDaily(weather);
    renderAQI(aqi);

    const warnings = generateWarnings(weather, aqi, new Date());
    renderWarnings(warnings);

    WindWidget.update({
      speed: weather.current.windSpeed,
      direction: weather.current.windDir,
      gust: weather.current.windGust,
      icon: wmoIcon(weather.current.weatherCode),
      desc: wmoDesc(weather.current.weatherCode),
      place: state.country ? `${state.name}, ${state.country}` : state.name
    });

    const now = new Date();
    const sun = getSunData(state.lat, state.lon, now);
    const moon = getMoonData(state.lat, state.lon, now);
    renderSun(sun);
    renderMoon(moon);

    const skyObjects = getSkyObjects(state.lat, state.lon, now);
    renderSky(skyObjects, weather.current.isDay === 1);

    const milkyWay = getMilkyWayData(state.lat, state.lon, now, sun.altitudeDeg, moon.altitudeDeg, moon.illuminationPct);
    renderMilkyWay(milkyWay);
    WeatherFX.setMilkyWay(milkyWay);

    renderAurora(aurora);

    restartClock();
    pulseUpdatedValues();
  }catch(err){
    console.error(err);
    $('lastUpdated').textContent = "Failed to load data — check connection and retry.";
  }finally{
    if (refreshBtn) refreshBtn.classList.remove('is-loading');
  }
}

function restartClock(){
  if (state.clockTimer) clearInterval(state.clockTimer);
  const tick = () => {
    updateClock(state.utcOffsetSeconds);
    updateSunLive(state.lat, state.lon);
  };
  tick();
  state.clockTimer = setInterval(tick, 1000);
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

function addRecent(place){
  let recents = state.recents || [];
  recents = recents.filter(p => p.name !== place.name || p.country !== place.country);
  recents.unshift(place);
  state.recents = recents.slice(0, 5);
}

function renderSuggestionList(items, resultsBox, input, sectionLabel){
  resultsBox.innerHTML = '';
  if (sectionLabel){
    const header = document.createElement('div');
    header.className = 'search-section-label';
    header.textContent = sectionLabel;
    resultsBox.appendChild(header);
  }
  items.forEach(r => {
    const div = document.createElement('div');
    div.className = 'search-result-item';
    const region = [r.admin1, r.country].filter(Boolean).join(', ');
    div.innerHTML = `${r.name}<small>${region}</small>`;
    div.addEventListener('click', () => {
      setLocation(r.latitude, r.longitude, r.name, r.country);
      addRecent(r);
      resultsBox.classList.remove('show');
      input.value = `${r.name}, ${r.country || ''}`;
    });
    resultsBox.appendChild(div);
  });
  resultsBox.classList.add('show');
}

function wireSearch(){
  const input = $('searchInput');
  const resultsBox = $('searchResults');

  function showDefaultSuggestions(){
    const recents = state.recents || [];
    resultsBox.innerHTML = '';
    if (recents.length){
      const recHeader = document.createElement('div');
      recHeader.className = 'search-section-label';
      recHeader.textContent = 'Recent';
      resultsBox.appendChild(recHeader);
      recents.forEach(r => {
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
    }
    const popHeader = document.createElement('div');
    popHeader.className = 'search-section-label';
    popHeader.textContent = 'Popular places';
    resultsBox.appendChild(popHeader);
    POPULAR_PLACES.forEach(r => {
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
  }

  input.addEventListener('focus', () => {
    if (!input.value.trim()) showDefaultSuggestions();
  });

  input.addEventListener('input', () => {
    clearTimeout(window._searchTimer);
    const q = input.value;
    if (!q.trim()){ showDefaultSuggestions(); return; }
    window._searchTimer = setTimeout(async () => {
      const results = await geocodeSearch(q);
      if (!results.length){ resultsBox.classList.remove('show'); return; }
      renderSuggestionList(results, resultsBox, input, null);
    }, 300);
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

  document.querySelectorAll('.unit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('active')) return;
      document.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      TEMP_UNIT = btn.dataset.unit;
      if (state.lastWeather){
        renderCurrentWeather(state.lastWeather);
        renderHourly(state.lastWeather);
        renderDaily(state.lastWeather);
      }
    });
  });
}

async function init(){
  initMap(state.lat, state.lon, async (lat, lon) => {
    const place = await reverseGeocode(lat, lon);
    setLocation(lat, lon, place.name, place.country);
  });

  wireSearch();
  wireControls();
  wireSkyTabs();
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
