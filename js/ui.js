// ui.js - DOM rendering helpers

function $(id){ return document.getElementById(id); }

// --- Temperature unit handling (data is always fetched/stored in Celsius; we convert at display time) ---
let TEMP_UNIT = 'C';
function cToF(c){ return c * 9/5 + 32; }
function fmtTemp(celsius, decimals){
  if (celsius == null || isNaN(celsius)) return '--°' + TEMP_UNIT;
  const v = TEMP_UNIT === 'F' ? cToF(celsius) : celsius;
  return `${decimals ? v.toFixed(decimals) : Math.round(v)}°${TEMP_UNIT}`;
}
function fmtTempBare(celsius){
  if (celsius == null || isNaN(celsius)) return '--°';
  const v = TEMP_UNIT === 'F' ? cToF(celsius) : celsius;
  return `${Math.round(v)}°`;
}

function renderLocation(loc){
  $('placeName').textContent = loc.country ? `${loc.name}, ${loc.country}` : loc.name;
  $('placeCoords').textContent = `${loc.lat.toFixed(3)}°, ${loc.lon.toFixed(3)}°`;
  $('placeTZ').textContent = loc.timezone ? `· ${loc.timezone}` : '';
}

function renderCurrentWeather(w){
  const c = w.current;
  $('weatherIcon').textContent = wmoIcon(c.weatherCode);
  $('weatherDesc').textContent = wmoDesc(c.weatherCode) + (c.isDay ? ' · Day' : ' · Night');
  $('currentTemp').textContent = fmtTemp(c.temp);
  $('feelsLike').textContent = fmtTemp(c.feelsLike);
  $('humidity').textContent = `${c.humidity}%`;
  $('wind').textContent = `${Math.round(c.windSpeed)} km/h ${azToCompass(c.windDir)}`;
  $('pressure').textContent = `${Math.round(c.pressure)} hPa`;
  $('visibility').textContent = c.visibility != null ? `${(c.visibility/1000).toFixed(1)} km` : '--';
  $('cloudCover').textContent = `${c.cloudCover}%`;
  $('dewPoint').textContent = fmtTemp(c.dewPoint);
  $('precip').textContent = `${c.precipitation} mm`;
  $('windGust').textContent = `${Math.round(c.windGust)} km/h`;

  $('elevation').textContent = `${Math.round(w.elevation)} m`;
  $('snowfall').textContent = c.snowfall != null ? `${c.snowfall} cm` : '--';
  $('soilTemp').textContent = c.soilTemp != null ? fmtTemp(c.soilTemp) : '--';
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

function fmtCountdown(ms){
  if (ms == null) return '--:--:--';
  const totalSec = Math.floor(ms/1000);
  const h = Math.floor(totalSec/3600);
  const m = Math.floor((totalSec%3600)/60);
  const s = totalSec%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// Called once per second from the same clock tick that runs the local time,
// so the sun card always reflects live time-until-sunrise/sunset without
// needing a network refresh.
function updateSunLive(lat, lon){
  const status = getSunLiveStatus(lat, lon, new Date());
  const icon = $('sunLiveIcon');
  const statusEl = $('sunLiveStatus');
  const countdownEl = $('sunLiveCountdown');
  if (!icon || !statusEl || !countdownEl) return;

  if (status.nextEvent === null){
    icon.textContent = status.isDay ? '☀️' : '🌙';
    statusEl.textContent = status.isDay ? 'Continuous daylight here right now' : 'Continuous night here right now';
    countdownEl.textContent = '--:--:--';
    return;
  }

  icon.textContent = status.isDay ? '☀️' : '🌙';
  statusEl.textContent = status.isDay ? 'Daytime · Sunset in' : 'Nighttime · Sunrise in';
  countdownEl.textContent = fmtCountdown(status.msToNext);
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

  // --- live moon tracking shown on hover (altitude/azimuth/compass + rise-set status) ---
  const alt = moon.altitudeDeg;
  const az = moon.azimuthDeg;
  const aboveHorizon = alt > 0;
  $('moonAlt').textContent = `${alt.toFixed(1)}°`;
  $('moonAz').textContent = az != null ? `${Math.round(az)}°` : '--';
  $('moonDir').textContent = az != null ? azToCompass(az) : '--';
  $('moonStatus').textContent = aboveHorizon ? 'Above horizon, visible' : 'Below horizon';

  // position the small arc dot the same way the sun arc works, so you can watch
  // the moon's path across the sky as it's tracked over refreshes
  const arcDot = $('moonArcDot');
  if (arcDot){
    if (alt > -5){
      const t = Math.max(0, Math.min(1, (alt + 5) / 95));
      const angle = Math.PI * (1 - t);
      const cx = 100 - 90*Math.cos(angle);
      const cy = 100 - 90*Math.sin(angle);
      arcDot.setAttribute('cx', cx);
      arcDot.setAttribute('cy', cy);
      arcDot.setAttribute('opacity', '1');
    } else {
      arcDot.setAttribute('opacity', '0.2');
    }
  }
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
      <span class="h-temp">${fmtTempBare(w.hourly.temperature_2m[i])}</span>
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
      <span class="d-temps"><span class="d-max">${fmtTempBare(w.daily.temperature_2m_max[i])}</span><span class="d-min">${fmtTempBare(w.daily.temperature_2m_min[i])}</span></span>
    `;
    container.appendChild(div);
  }
}

let _lastSkyObjects = [];
let _skyFilter = 'all';

function wireSkyTabs(){
  document.querySelectorAll('.sky-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sky-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _skyFilter = btn.dataset.filter;
      renderSkyFiltered();
    });
  });
}

function renderSkyFiltered(){
  const filtered = _skyFilter === 'all'
    ? _lastSkyObjects
    : _lastSkyObjects.objects.filter(o => o.type === _skyFilter);
  renderSkyCards(_skyFilter === 'all' ? _lastSkyObjects.objects : filtered, _lastSkyObjects.isDay);
}

async function renderSky(objects, isDayNow){
  _lastSkyObjects = { objects, isDay: isDayNow };
  const filtered = _skyFilter === 'all' ? objects : objects.filter(o => o.type === _skyFilter);
  renderSkyCards(filtered, isDayNow);
}

function renderMilkyWay(mw){
  const el = $('milkyWayText');
  if (!el) return;
  if (!mw.skyDark){
    el.textContent = "Sky's too bright for the Milky Way right now — check back after dark.";
  } else if (mw.visible){
    const dir = azToCompass(mw.core ? mw.core.azimuth : 0);
    el.textContent = `Visible now, arching up to ${Math.round(mw.maxAltitude)}° high — galactic core toward the ${dir}.`;
  } else {
    el.textContent = "Sky is dark, but the galactic plane is below the horizon from here right now.";
  }
}

function kpGaugeGlow(color){
  return `0 0 22px -2px ${color}, 0 0 0 1px rgba(255,255,255,0.08) inset`;
}

// Draws a top-down polar view centered on the geomagnetic pole: concentric
// rings mark geomagnetic latitude, a glowing band marks the live auroral
// oval boundary for the current Kp, and a dot marks where the chosen
// location sits relative to that oval right now.
function renderAuroraOval(a){
  const canvas = $('auroraOvalCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W/2, cy = H/2;
  const maxR = Math.min(W,H)/2 - 14;
  // map geomagnetic latitude 90..40 to radius 0..maxR (pole at center)
  const latToR = lat => maxR * (90 - Math.max(40, Math.min(90, lat))) / 50;

  ctx.clearRect(0,0,W,H);

  // background
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  ctx.beginPath(); ctx.arc(cx, cy, maxR, 0, Math.PI*2); ctx.fill();

  // latitude grid rings (80,70,60,50)
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  ctx.font = '9px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  [80,70,60,50].forEach(lat => {
    const r = latToR(lat);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
    ctx.fillText(`${lat}°`, cx + 3, cy - r + 10);
  });

  const legendDot = document.querySelector('.dot-oval');

  if (!a.available){
    if (legendDot){ legendDot.style.background = '#93a0c2'; legendDot.style.boxShadow = '0 0 6px #93a0c2'; }
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Live oval unavailable', cx, cy);
    ctx.textAlign = 'left';
    return;
  }

  // keep the legend swatch in sync with the ring color actually drawn below
  if (legendDot){ legendDot.style.background = a.color; legendDot.style.boxShadow = `0 0 6px ${a.color}`; }

  // auroral oval ring at the live boundary latitude, glowing
  const ovalR = latToR(a.boundaryLat);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  [ [16, 0.10], [7, 0.22], [2.5, 0.55] ].forEach(([lw, alpha]) => {
    ctx.strokeStyle = hexToRgba(a.color, alpha);
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(cx, cy, ovalR, 0, Math.PI*2); ctx.stroke();
  });
  ctx.restore();

  // pole marker
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI*2); ctx.fill();

  // your location dot, placed by geomagnetic latitude (radius) + longitude offset (angle)
  const userR = latToR(a.geomagLat);
  const angle = (a.geomagLon || 0) * Math.PI / 180;
  const ux = cx + userR * Math.sin(angle);
  const uy = cy - userR * Math.cos(angle);
  ctx.fillStyle = '#ffd166';
  ctx.shadowColor = '#ffd166';
  ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.arc(ux, uy, 4.5, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
}

function hexToRgba(hex, alpha){
  const h = hex.replace('#','');
  const r = parseInt(h.length === 3 ? h[0]+h[0] : h.substring(0,2), 16);
  const g = parseInt(h.length === 3 ? h[1]+h[1] : h.substring(2,4), 16);
  const b = parseInt(h.length === 3 ? h[2]+h[2] : h.substring(4,6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function renderAuroraRegions(a){
  const list = $('auroraRegionList');
  if (!list) return;
  list.innerHTML = '';
  if (!a.available || !a.regions){
    list.innerHTML = `<span class="aurora-region-chip">No live region data right now</span>`;
    return;
  }
  a.regions.current.forEach(place => {
    const chip = document.createElement('span');
    chip.className = 'aurora-region-chip';
    chip.textContent = place;
    list.appendChild(chip);
  });
  const hereChip = document.createElement('span');
  hereChip.className = 'aurora-region-chip is-here';
  hereChip.textContent = a.visible ? '📍 Your location — in range now' : '📍 Your location — not in range yet';
  list.appendChild(hereChip);
}

function renderAurora(a){
  const gauge = $('auroraGauge');
  const kpEl = $('auroraKp');
  const activityEl = $('auroraActivity');
  const verdictEl = $('auroraVerdict');
  const adviceEl = $('auroraAdvice');
  const updatedEl = $('auroraUpdated');

  if (!a.available){
    kpEl.textContent = '--';
    activityEl.textContent = 'Unavailable';
    verdictEl.textContent = '';
    adviceEl.textContent = a.advice;
    updatedEl.textContent = 'No live connection';
    gauge.style.borderColor = '#93a0c2';
    gauge.style.boxShadow = '';
    renderAuroraOval(a);
    renderAuroraRegions(a);
    return;
  }

  kpEl.textContent = a.kp.toFixed(1);
  activityEl.textContent = a.label;
  activityEl.style.color = a.color;
  verdictEl.textContent = a.visible
    ? `Likely visible tonight from your location (${a.hemisphere} Lights)`
    : `Not expected to be visible from your location right now`;
  verdictEl.style.color = a.visible ? 'var(--good)' : 'var(--text-dim)';
  adviceEl.textContent = a.advice;
  updatedEl.textContent = a.updated ? `Updated ${new Date(a.updated.replace(' ', 'T') + 'Z').toLocaleTimeString()} · NOAA SWPC (live)` : 'NOAA SWPC (live)';
  gauge.style.borderColor = a.color;
  gauge.style.boxShadow = kpGaugeGlow(a.color);
  renderAuroraOval(a);
  renderAuroraRegions(a);
}

const WARNING_SEVERITY_LABEL = { severe: 'Severe', moderate: 'Moderate', minor: 'Minor' };

function renderWarnings(warnings){
  const wrap = $('warningsBanner');
  const list = $('warningsList');
  const countEl = $('warningsCount');
  if (!wrap || !list) return;

  list.innerHTML = '';

  if (!warnings || warnings.length === 0){
    wrap.classList.add('is-clear');
    if (countEl) countEl.textContent = 'No active warnings';
    const clearCard = document.createElement('div');
    clearCard.className = 'warning-card warning-clear';
    clearCard.innerHTML = `<span class="warning-icon">✅</span><div class="warning-text"><div class="warning-title">No weather warnings</div><div class="warning-detail">Conditions look normal for the next 24 hours.</div></div>`;
    list.appendChild(clearCard);
    return;
  }

  wrap.classList.remove('is-clear');
  if (countEl) countEl.textContent = `${warnings.length} active warning${warnings.length > 1 ? 's' : ''}`;

  warnings.forEach(w => {
    const card = document.createElement('div');
    card.className = `warning-card sev-${w.severity}`;
    card.innerHTML = `
      <span class="warning-icon">${w.icon}</span>
      <div class="warning-text">
        <div class="warning-title">${w.title} <span class="warning-sev">${WARNING_SEVERITY_LABEL[w.severity] || ''}</span></div>
        <div class="warning-detail">${w.detail}</div>
      </div>`;
    list.appendChild(card);
  });
}

async function renderSkyCards(objects, isDayNow){
  $('skyStatus').textContent = isDayNow
    ? `It's daytime here, so stars are washed out — but here's what's astronomically above the horizon right now:`
    : `Objects currently above the horizon, sorted by how high they are in the sky:`;
  const container = $('skyObjects');
  container.innerHTML = '';
  if (!objects.length){
    container.innerHTML = `<div class="sky-obj"><span class="so-name">Nothing in this category is above the horizon right now.</span></div>`;
    return;
  }
  for (const obj of objects){
    const div = document.createElement('div');
    div.className = 'sky-obj';
    div.title = 'Loading info…';
    const typeTag = obj.type === 'planet' ? '🪐 Planet' : '✨ Constellation';
    div.innerHTML = `
      <img data-wiki="${obj.wiki}" alt="${obj.name}" src="">
      <span class="so-dir">${azToCompass(obj.azimuth)} · ${Math.round(obj.altitude)}° up</span>
      <span class="so-name">${obj.name}</span>
      <span class="so-meta"><span>${typeTag}</span><span>Az ${Math.round(obj.azimuth)}°</span></span>
      <div class="so-tooltip"><span class="so-tooltip-text">Loading info…</span><span class="so-tooltip-cta">Click to read more on Wikipedia ↗</span></div>
    `;
    container.appendChild(div);
  }

  // lazy-load images + descriptions + click-through links
  container.querySelectorAll('.sky-obj').forEach(async (card) => {
    const img = card.querySelector('img[data-wiki]');
    const tooltipText = card.querySelector('.so-tooltip-text');
    const summary = await fetchWikiSummary(img.dataset.wiki);

    if (summary.image) img.src = summary.image;
    else img.style.display = 'none';

    tooltipText.textContent = summary.extract;
    card.title = summary.extract; // native tooltip fallback
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      window.open(summary.url, '_blank', 'noopener,noreferrer');
    });
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
