// astronomy.js - Moon, Sun, and "what's visible in the sky right now" calculations
// Uses SunCalc for sun/moon timing + Astronomy Engine for precise alt/az of
// constellations (by centroid) and planets.

const DIRS = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
function azToCompass(az){
  const idx = Math.round(az / 22.5) % 16;
  return DIRS[idx];
}

function moonPhaseName(phase){
  // phase: 0-1 from SunCalc (0/1 = new, 0.5 = full)
  if (phase < 0.02 || phase > 0.98) return "New Moon";
  if (phase < 0.23) return "Waxing Crescent";
  if (phase < 0.27) return "First Quarter";
  if (phase < 0.48) return "Waxing Gibbous";
  if (phase < 0.52) return "Full Moon";
  if (phase < 0.73) return "Waning Gibbous";
  if (phase < 0.77) return "Last Quarter";
  return "Waning Crescent";
}

function getSunData(lat, lon, date){
  const times = SunCalc.getTimes(date, lat, lon);
  const pos = SunCalc.getPosition(date, lat, lon);
  const fmt = (d) => (d && !isNaN(d.getTime())) ? d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : "—";
  let dayLengthStr = "—";
  if (times.sunrise && times.sunset && !isNaN(times.sunrise) && !isNaN(times.sunset)){
    const ms = times.sunset - times.sunrise;
    const h = Math.floor(ms/3600000), m = Math.round((ms%3600000)/60000);
    dayLengthStr = `${h}h ${m}m`;
  }
  return {
    sunrise: fmt(times.sunrise),
    sunset: fmt(times.sunset),
    solarNoon: fmt(times.solarNoon),
    dayLength: dayLengthStr,
    altitudeDeg: pos.altitude * 180/Math.PI,
    azimuthDeg: ((pos.azimuth * 180/Math.PI) + 180) % 360, // SunCalc az is from south; normalize to from-north
    raw: times
  };
}

// Live sunrise/sunset/day-length status for a "ticking" countdown - figures
// out whether it's currently day or night and how long until the next
// sunrise or sunset, handling the case where today's sunset has already
// passed (next event becomes tomorrow's sunrise).
function getSunLiveStatus(lat, lon, now){
  const today = SunCalc.getTimes(now, lat, lon);
  let isDay, nextEvent, nextTime;

  if (today.sunrise && today.sunset && !isNaN(today.sunrise) && !isNaN(today.sunset) && today.sunrise < today.sunset){
    if (now < today.sunrise){
      isDay = false; nextEvent = 'sunrise'; nextTime = today.sunrise;
    } else if (now < today.sunset){
      isDay = true; nextEvent = 'sunset'; nextTime = today.sunset;
    } else {
      const tomorrow = new Date(now.getTime() + 24*3600000);
      const t2 = SunCalc.getTimes(tomorrow, lat, lon);
      isDay = false; nextEvent = 'sunrise'; nextTime = t2.sunrise;
    }
  } else {
    // polar day/night or invalid times near the poles - fall back to sun altitude
    const pos = SunCalc.getPosition(now, lat, lon);
    isDay = pos.altitude > 0;
    nextEvent = null; nextTime = null;
  }

  const msToNext = nextTime && !isNaN(nextTime) ? Math.max(0, nextTime.getTime() - now.getTime()) : null;
  return { isDay, nextEvent, nextTime, msToNext };
}

function getMoonData(lat, lon, date){
  const illum = SunCalc.getMoonIllumination(date);
  const times = SunCalc.getMoonTimes(date, lat, lon, true);
  const pos = SunCalc.getMoonPosition(date, lat, lon);
  const fmt = (d) => (d && !isNaN(d.getTime())) ? d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : "—";
  const ageDays = illum.phase * 29.53;
  return {
    illuminationPct: Math.round(illum.fraction * 100),
    phaseName: moonPhaseName(illum.phase),
    phaseFraction: illum.phase,
    moonrise: fmt(times.rise),
    moonset: fmt(times.set),
    distanceKm: Math.round(pos.distance),
    ageDays: ageDays.toFixed(1),
    altitudeDeg: pos.altitude * 180/Math.PI,
    azimuthDeg: ((pos.azimuth * 180/Math.PI) + 180) % 360 // normalize from-south -> from-north, like getSunData
  };
}

// --- Milky Way band visibility ---
// Standard IAU 1958 galactic coordinate system pole/node, used to convert
// galactic longitude/latitude (l,b) into equatorial RA/Dec so we can ask
// Astronomy Engine where the galactic plane actually sits in the sky for
// a given place + time.
const GAL_POLE_RA_DEG = 192.85948;   // RA of north galactic pole (J2000)
const GAL_POLE_DEC_DEG = 27.12825;   // Dec of north galactic pole (J2000)
const GAL_NCP_L = 122.93192;         // galactic longitude of the celestial pole

function deg2rad(d){ return d * Math.PI / 180; }
function rad2deg(r){ return r * 180 / Math.PI; }

function galacticToEquatorial(lDeg, bDeg){
  const l = deg2rad(lDeg), b = deg2rad(bDeg);
  const decP = deg2rad(GAL_POLE_DEC_DEG), raP = deg2rad(GAL_POLE_RA_DEG);
  const lncp = deg2rad(GAL_NCP_L);

  const sinDec = Math.sin(decP)*Math.sin(b) + Math.cos(decP)*Math.cos(b)*Math.cos(lncp - l);
  const dec = Math.asin(Math.max(-1, Math.min(1, sinDec)));

  const y = Math.cos(b)*Math.sin(lncp - l);
  const x = Math.cos(decP)*Math.sin(b) - Math.sin(decP)*Math.cos(b)*Math.cos(lncp - l);
  let ra = raP + Math.atan2(y, x);
  let raDeg = rad2deg(ra);
  raDeg = ((raDeg % 360) + 360) % 360;

  return { ra: raDeg / 15, dec: rad2deg(dec) }; // ra in hours, dec in degrees
}

// Sample the galactic equator (b=0) every 12° (30 points) plus the galactic
// center itself (l=0), project each to local alt/az "right now", and use
// that to decide whether the band is realistically visible from here:
// it needs to be above the horizon, and the sky needs to be dark enough
// (sun well below horizon, moon not flooding the sky with light).
function getMilkyWayData(lat, lon, date, sunAltDeg, moonAltDeg, moonIllumPct){
  const points = [];
  let core = null;
  try{
    const observer = new Astronomy.Observer(lat, lon, 0);
    const time = Astronomy.MakeTime(date);
    for (let l = 0; l < 360; l += 12){
      const eq = galacticToEquatorial(l, 0);
      const hor = Astronomy.Horizon(time, observer, eq.ra, eq.dec, 'normal');
      const pt = { l, altitude: hor.altitude, azimuth: hor.azimuth };
      points.push(pt);
      if (l === 0) core = pt; // l=0 ~ direction of the galactic center (Sagittarius)
    }
  }catch(e){
    console.error("Milky Way calc error", e);
  }

  const visiblePoints = points.filter(p => p.altitude > 0);
  const maxAlt = visiblePoints.reduce((m,p) => Math.max(m, p.altitude), -90);

  // Darkness gate: need astronomical-twilight-or-darker skies, and the moon
  // either below the horizon or faint/new enough not to wash out the band.
  const skyDark = sunAltDeg < -12 && (moonAltDeg < 0 || moonIllumPct < 35);

  return {
    points,
    visiblePoints,
    core,
    maxAltitude: maxAlt,
    skyDark,
    visible: skyDark && visiblePoints.length > 0 && maxAlt > 5
  };
}

// Compute alt/az for a constellation centroid + a fixed set of planets using Astronomy Engine.
function getSkyObjects(lat, lon, date){
  const results = [];
  try{
    const observer = new Astronomy.Observer(lat, lon, 0);
    const time = Astronomy.MakeTime(date);

    // Constellations (using static centroid RA/Dec, precessed roughly to J2000 - fine for amateur display)
    CONSTELLATIONS.forEach(c => {
      const hor = Astronomy.Horizon(time, observer, c.ra, c.dec, 'normal');
      if (hor.altitude > 5){ // visible above horizon with margin
        results.push({
          name: c.name,
          type: "constellation",
          altitude: hor.altitude,
          azimuth: hor.azimuth,
          wiki: c.wiki
        });
      }
    });

    // Planets + Sun + Moon
    const bodies = [
      ["Mercury","Mercury", "Mercury (planet)"], ["Venus","Venus", "Venus"], ["Mars","Mars", "Mars"],
      ["Jupiter","Jupiter", "Jupiter"], ["Saturn","Saturn", "Saturn"],
      ["Uranus","Uranus", "Uranus"], ["Neptune","Neptune", "Neptune"]
    ];
    bodies.forEach(([key, label, wiki]) => {
      try{
        const eq = Astronomy.Equator(key, time, observer, true, true);
        const hor = Astronomy.Horizon(time, observer, eq.ra, eq.dec, 'normal');
        if (hor.altitude > 0){
          results.push({
            name: label,
            type: "planet",
            altitude: hor.altitude,
            azimuth: hor.azimuth,
            wiki: wiki
          });
        }
      }catch(e){ /* skip body if it errors */ }
    });

  }catch(e){
    console.error("Astronomy calc error", e);
  }

  results.sort((a,b) => b.altitude - a.altitude);
  return results.slice(0, 12);
}

// Wikipedia REST summary -> thumbnail image + short description + page link, cached in-memory.
const _wikiSummaryCache = {};
async function fetchWikiSummary(title){
  if (_wikiSummaryCache[title]) return _wikiSummaryCache[title];
  const fallback = {
    image: null,
    extract: "No summary available right now.",
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
  };
  try{
    const resp = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
    if (!resp.ok) throw new Error("not found");
    const data = await resp.json();
    const result = {
      image: (data.thumbnail && data.thumbnail.source) || (data.originalimage && data.originalimage.source) || null,
      extract: data.extract || fallback.extract,
      url: (data.content_urls && data.content_urls.desktop && data.content_urls.desktop.page) || fallback.url
    };
    _wikiSummaryCache[title] = result;
    return result;
  }catch(e){
    _wikiSummaryCache[title] = fallback;
    return fallback;
  }
}

// Backwards-compatible helper (image only)
async function fetchWikiImage(title){
  const s = await fetchWikiSummary(title);
  return s.image;
}
