// ui.js - DOM rendering helpers

function $(id){ return document.getElementById(id); }

function renderLocation(loc){
  $('placeName').textContent = loc.country ? `${loc.name}, ${loc.country}` : loc.name;
  $('placeCoords').textContent = `${loc.lat.toFixed(3)}°, ${loc.lon.toFixed(3)}°`;
  $('placeTZ').textContent = loc.timezone ? `· ${loc.timezone}` : '';
}

function renderCurrentWeather(w){
  const c = w.current;
  $('weatherIcon').textContent = wmoIcon(c.weatherCode);
  $('weatherDesc').textContent = wmoDesc(c.weatherCode) + (c.isDay ? ' · Day' : ' · Night');
  $('currentTemp').textContent = `${Math.round(c.temp)}°C`;
  $('feelsLike').textContent = `${Math.round(c.feelsLike)}°C`;
  $('humidity').textContent = `${c.humidity}%`;
  $('wind').textContent = `${Math.round(c.windSpeed)} km/h ${azToCompass(c.windDir)}`;
  $('pressure').textContent = `${Math.round(c.pressure)} hPa`;
  $('visibility').textContent = c.visibility != null ? `${(c.visibility/1000).toFixed(1)} km` : '--';
  $('cloudCover').textContent = `${c.cloudCover}%`;
  $('dewPoint').textContent = `${Math.round(c.dewPoint)}°C`;
  $('precip').textContent = `${c.precipitation} mm`;
  $('windGust').textContent = `${Math.round(c.windGust)} km/h`;

  $('elevation').textContent = `${Math.round(w.elevation)} m`;
  $('snowfall').textContent = c.snowfall != null ? `${c.snowfall} cm` : '--';
  $('soilTemp').textContent = c.soilTemp != null ? `${Math.round(c.soilTemp)}°C` : '--';
  $('cape').textContent = c.cape != null ? `${Math.round(c.cape)} J/kg` : '--';
  $('freezeLvl').textContent = c.freezingLevel != null ? `${Math.round(c.freezingLevel)} m` : '--';
}

function renderUV(uv){
  $('uvValue').textContent = uv != null ? Math.round(uv) : '--';
  let label, color;
  if (uv == null){ label = '--'; color = '#4ade80'; }
  else if (uv < 3){ label = 'Low'; color = '#4ade80'; }
  else if (uv < 6){ label = 'Moderate'; color = '#fbbf24'; }
  else if (uv < 8){ label = 'High'; color = '#fb923c'; }
  else if (uv < 11){ label = 'Very High'; color = '#f87171'; }
  else { label = 'Extreme'; color = '#c084fc'; }
  $('uvLabel').textContent = label;
  $('uvGauge').style.borderColor = color;
  const advice = {
    'Low': 'Minimal protection needed for most people.',
    'Moderate': 'Wear sunglasses on bright days; seek shade near midday.',
    'High': 'Use SPF 30+, hat, and sunglasses. Reduce time in sun 10am-4pm.',
    'Very High': 'Extra precaution needed. Minimize sun exposure midday.',
    'Extreme': 'Avoid sun exposure. Stay in shade; full protective gear if outside.',
    '--': ''
  };
  $('uvAdvice').textContent = advice[label] || '';
}

function renderAQI(a){
  $('aqiUS').textContent = a.usAqi ?? '--';
  $('aqiEU').textContent = a.euAqi ?? '--';
  const [label, color] = aqiCategory(a.usAqi);
  $('aqiValue').textContent = a.usAqi ?? '--';
  $('aqiLabel').textContent = label;
  $('aqiGauge').style.background = `conic-gradient(${color} 0deg, ${color} 360deg)`;
  $('pm25').textContent = a.pm25 != null ? `${a.pm25} µg/m³` : '--';
  $('pm10').textContent = a.pm10 != null ? `${a.pm10} µg/m³` : '--';
  $('o3').textContent = a.o3 != null ? `${a.o3} µg/m³` : '--';
  $('no2').textContent = a.no2 != null ? `${a.no2} µg/m³` : '--';
  $('so2').textContent = a.so2 != null ? `${a.so2} µg/m³` : '--';
  $('co').textContent = a.co != null ? `${a.co} µg/m³` : '--';
  $('pollen').textContent = a.grassPollen != null ? `${a.grassPollen} gr/m³` : 'N/A';
}

function renderSun(sun){
  $('sunrise').textContent = sun.sunrise;
  $('sunset').textContent = sun.sunset;
  $('dayLength').textContent = sun.dayLength;
  $('solarNoon').textContent = sun.solarNoon;

  // position the sun dot along the arc based on altitude (-90..90 mapped, only show if above horizon)
  const svg = $('sunArc');
  const dot = $('sunDot');
  const alt = sun.altitudeDeg;
  if (alt > -5){
    const t = Math.max(0, Math.min(1, (alt + 5) / 95)); // rough mapping
    const angle = Math.PI * (1 - t);
    const cx = 100 - 90*Math.cos(angle);
    const cy = 100 - 90*Math.sin(angle);
    dot.setAttribute('cx', cx);
    dot.setAttribute('cy', cy);
    dot.setAttribute('opacity', '1');
  } else {
    dot.setAttribute('opacity', '0.2');
  }
}

function renderMoon(moon){
  $('moonPhaseName').textContent = moon.phaseName;
  $('moonIllum').textContent = `${moon.illuminationPct}%`;
  $('moonrise').textContent = moon.moonrise;
  $('moonset').textContent = moon.moonset;
  $('moonDistance').textContent = `${moon.distanceKm.toLocaleString()} km`;
  $('moonAge').textContent = `${moon.ageDays} days`;

  // draw simple terminator shading based on phase fraction
  const visual = $('moonVisual');
  const illum = moon.illuminationPct / 100;
  const waxing = moon.phaseFraction < 0.5;
  // shadow covers (1-illum) of the disc, sliding from one side based on waxing/waning
  const shadowPct = Math.round((1 - illum) * 100);
  const dir = waxing ? 'right' : 'left';
  visual.style.background = `linear-gradient(to ${dir === 'right' ? 'left' : 'right'}, #1a1f33 ${shadowPct}%, #f3f0e6 ${shadowPct}%)`;
}

function renderHourly(w){
  const container = $('hourlyChart');
  container.innerHTML = '';
  const startIdx = w.hourlyNowIndex;
  for (let i = startIdx; i < Math.min(startIdx + 24, w.hourly.time.length); i++){
    const t = new Date(w.hourly.time[i]);
    const div = document.createElement('div');
    div.className = 'hour-item';
    div.innerHTML = `
      <span class="h-time">${t.toLocaleTimeString([], {hour:'2-digit'})}</span>
      <span class="h-icon">${wmoIcon(w.hourly.weather_code[i])}</span>
      <span class="h-temp">${Math.round(w.hourly.temperature_2m[i])}°</span>
      <span class="h-precip">💧${w.hourly.precipitation_probability ? w.hourly.precipitation_probability[i] : 0}%</span>
    `;
    container.appendChild(div);
  }
}

function renderDaily(w){
  const container = $('dailyForecast');
  container.innerHTML = '';
  for (let i = 0; i < w.daily.time.length; i++){
    const d = new Date(w.daily.time[i] + 'T00:00:00');
    const div = document.createElement('div');
    div.className = 'day-item';
    div.innerHTML = `
      <span class="d-name">${d.toLocaleDateString([], {weekday:'short'})}</span>
      <span class="d-icon">${wmoIcon(w.daily.weather_code[i])}</span>
      <span class="d-temps"><span class="d-max">${Math.round(w.daily.temperature_2m_max[i])}°</span><span class="d-min">${Math.round(w.daily.temperature_2m_min[i])}°</span></span>
    `;
    container.appendChild(div);
  }
}

async function renderSky(objects, isDayNow){
  $('skyStatus').textContent = isDayNow
    ? `It's daytime here, so stars are washed out — but here's what's astronomically above the horizon right now:`
    : `Objects currently above the horizon, sorted by how high they are in the sky:`;
  const container = $('skyObjects');
  container.innerHTML = '';
  if (!objects.length){
    container.innerHTML = `<div class="sky-obj"><span class="so-name">Nothing notable above the horizon right now.</span></div>`;
    return;
  }
  for (const obj of objects){
    const div = document.createElement('div');
    div.className = 'sky-obj';
    const typeTag = obj.type === 'planet' ? '🪐 Planet' : '✨ Constellation';
    div.innerHTML = `
      <img data-wiki="${obj.wiki}" alt="${obj.name}" src="">
      <span class="so-dir">${azToCompass(obj.azimuth)} · ${Math.round(obj.altitude)}° up</span>
      <span class="so-name">${obj.name}</span>
      <span class="so-meta"><span>${typeTag}</span><span>Az ${Math.round(obj.azimuth)}°</span></span>
    `;
    container.appendChild(div);
  }
  // lazy-load images
  container.querySelectorAll('img[data-wiki]').forEach(async (img) => {
    const url = await fetchWikiImage(img.dataset.wiki);
    if (url) img.src = url;
    else img.style.display = 'none';
  });
}

function updateClock(utcOffsetSeconds){
  const now = new Date(Date.now() + utcOffsetSeconds*1000);
  const hh = String(now.getUTCHours()).padStart(2,'0');
  const mm = String(now.getUTCMinutes()).padStart(2,'0');
  const ss = String(now.getUTCSeconds()).padStart(2,'0');
  $('localClock').textContent = `${hh}:${mm}:${ss}`;
  $('localDate').textContent = now.toLocaleDateString(undefined, {weekday:'short', day:'numeric', month:'short', year:'numeric', timeZone:'UTC'});
}

function setLastUpdated(){
  $('lastUpdated').textContent = `Last updated ${new Date().toLocaleTimeString()}`;
}
