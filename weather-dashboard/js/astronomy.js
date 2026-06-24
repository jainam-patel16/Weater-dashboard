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
    altitudeDeg: pos.altitude * 180/Math.PI
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
      ["Mercury","Mercury"], ["Venus","Venus"], ["Mars","Mars"],
      ["Jupiter","Jupiter"], ["Saturn","Saturn"], ["Uranus","Uranus"], ["Neptune","Neptune"]
    ];
    bodies.forEach(([key, label]) => {
      try{
        const eq = Astronomy.Equator(key, time, observer, true, true);
        const hor = Astronomy.Horizon(time, observer, eq.ra, eq.dec, 'normal');
        if (hor.altitude > 0){
          results.push({
            name: label,
            type: "planet",
            altitude: hor.altitude,
            azimuth: hor.azimuth,
            wiki: label
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

// Wikipedia REST summary -> thumbnail image, cached in-memory.
const _wikiImgCache = {};
async function fetchWikiImage(title){
  if (_wikiImgCache[title]) return _wikiImgCache[title];
  try{
    const resp = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
    if (!resp.ok) throw new Error("not found");
    const data = await resp.json();
    const url = (data.thumbnail && data.thumbnail.source) || (data.originalimage && data.originalimage.source) || null;
    _wikiImgCache[title] = url;
    return url;
  }catch(e){
    _wikiImgCache[title] = null;
    return null;
  }
}
