// aurora.js - Live aurora (northern/southern lights) visibility forecast.
// Data source: NOAA SWPC planetary K-index (1-minute estimated), which is
// free, keyless, and CORS-enabled. We turn the live Kp index into a rough
// "how far from the poles is the aurora visible right now" estimate using
// the geomagnetic latitude of the chosen location, and combine that with
// local darkness to give a live, place-aware verdict.

const KP_INDEX_URL = "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json";

// Approximate geomagnetic pole positions (dipole model, slowly drifts year to
// year - close enough for a "how likely is the aurora visible from here"
// estimate, not for scientific navigation).
const GEOMAG_NORTH_POLE = { lat: 80.7, lon: -72.7 };
const GEOMAG_SOUTH_POLE = { lat: -80.7, lon: 107.3 };

function geomagneticLatitude(lat, lon, pole){
  const toRad = d => d * Math.PI / 180;
  const phi1 = toRad(lat), phi2 = toRad(pole.lat);
  const dLon = toRad(lon - pole.lon);
  const sinGm = Math.sin(phi1)*Math.sin(phi2) + Math.cos(phi1)*Math.cos(phi2)*Math.cos(dLon);
  return Math.asin(Math.max(-1, Math.min(1, sinGm))) * 180 / Math.PI;
}

// Geomagnetic longitude offset (degrees) relative to the pole's own meridian -
// gives us an angle we can plot a location at around the polar oval map, via
// the standard spherical-rotation pair to geomagneticLatitude() above.
function geomagneticLongitudeOffset(lat, lon, pole, geomagLatDeg){
  const toRad = d => d * Math.PI / 180;
  const phi = toRad(lat), phip = toRad(pole.lat), dLon = toRad(lon - pole.lon);
  const gmLat = toRad(geomagLatDeg);
  const cosGm = Math.cos(gmLat);
  if (Math.abs(cosGm) < 1e-6) return 0; // essentially at the pole - angle is undefined
  const sinL = -Math.sin(dLon) * Math.cos(phi) / cosGm;
  const cosL = (Math.sin(phi) - Math.sin(phip) * Math.sin(gmLat)) / (Math.cos(phip) * cosGm);
  return Math.atan2(sinL, cosL) * 180 / Math.PI;
}

// Rough, commonly-cited guide to which regions sit within the auroral oval at
// increasing Kp levels. Each tier's places stay in range at every higher Kp
// too (the oval only grows equatorward as activity rises), so the "currently
// in range" list for a given Kp is every tier at or below it.
const NORTH_REGION_TIERS = [
  { minKp: 0, places: ["Northern Alaska", "Northern Canada (Nunavut, NWT)", "Svalbard", "Far northern Scandinavia (Tromsø, Kiruna)"] },
  { minKp: 2, places: ["Fairbanks & central Alaska", "Yukon, Northwest Territories", "Iceland", "Northern Scandinavian Lapland"] },
  { minKp: 3, places: ["Anchorage, Alaska", "Northern British Columbia", "Faroe Islands", "Southern Iceland, Southern Scandinavia"] },
  { minKp: 4, places: ["Scotland, Northern Ireland", "Denmark, Northern Germany", "Southern Canadian provinces", "Northern US (Montana, North Dakota)"] },
  { minKp: 5, places: ["England, Wales", "Poland, the Netherlands", "Northern US (Michigan, Wisconsin, Minnesota, Washington)"] },
  { minKp: 6, places: ["Northern France, Belgium", "Czech Republic", "Northern US (Pennsylvania, Iowa, Oregon)"] },
  { minKp: 7, places: ["Southern UK, Northern Spain", "Northern US (Illinois, Kansas, Northern California)"] },
  { minKp: 8, places: ["Southern France", "Southern US (Texas, Alabama)"] },
  { minKp: 9, places: ["Extreme events only — historically as far as Florida or the Mediterranean coast"] }
];
const SOUTH_REGION_TIERS = [
  { minKp: 0, places: ["Antarctic research stations", "South Georgia Island"] },
  { minKp: 2, places: ["Southern Tasmania", "Stewart Island, NZ"] },
  { minKp: 3, places: ["Southern New Zealand (Dunedin, Invercargill)", "Ushuaia, Argentina"] },
  { minKp: 4, places: ["Central New Zealand (Christchurch)", "Hobart, Tasmania"] },
  { minKp: 5, places: ["Northern Tasmania", "Melbourne area (rare)"] },
  { minKp: 6, places: ["Southern mainland Australia (Adelaide, rare)"] },
  { minKp: 7, places: ["Sydney area (very rare, extreme events)"] },
  { minKp: 8, places: ["Subtropical extremes only"] },
  { minKp: 9, places: ["Extreme events only"] }
];

function regionsForKp(kp, hemisphere){
  const tiers = hemisphere === "Northern" ? NORTH_REGION_TIERS : SOUTH_REGION_TIERS;
  const inRange = tiers.filter(t => t.minKp <= kp);
  const current = inRange[inRange.length - 1] || tiers[0];
  const allPlaces = inRange.flatMap(t => t.places);
  return { current: current.places, all: allPlaces };
}

// Rough equatorward boundary (in geomagnetic latitude, degrees) of the
// visible aurora oval for a given planetary Kp index - a commonly used
// approximation in amateur aurora-chasing tools.
const KP_VISIBILITY_LAT = [66.5, 64.5, 62.4, 60.4, 58.3, 56.3, 54.2, 52.2, 50.1, 48.1];
function kpToBoundaryLat(kp){
  const k = Math.max(0, Math.min(9, kp));
  const lo = Math.floor(k), hi = Math.ceil(k);
  if (lo === hi) return KP_VISIBILITY_LAT[lo];
  const frac = k - lo;
  return KP_VISIBILITY_LAT[lo] + (KP_VISIBILITY_LAT[hi] - KP_VISIBILITY_LAT[lo]) * frac;
}

function kpActivityLabel(kp){
  if (kp < 2) return { label: "Quiet", color: "#4ade80" };
  if (kp < 4) return { label: "Unsettled", color: "#a3e635" };
  if (kp < 5) return { label: "Active", color: "#fbbf24" };
  if (kp < 6) return { label: "Minor Storm (G1)", color: "#fb923c" };
  if (kp < 7) return { label: "Moderate Storm (G2)", color: "#f87171" };
  if (kp < 8) return { label: "Strong Storm (G3)", color: "#e879f9" };
  if (kp < 9) return { label: "Severe Storm (G4)", color: "#c084fc" };
  return { label: "Extreme Storm (G5)", color: "#a855f7" };
}

async function fetchLiveKp(){
  const resp = await fetch(KP_INDEX_URL);
  if (!resp.ok) throw new Error("Kp fetch failed");
  const data = await resp.json();
  // First row is a header in some SWPC endpoints; filter to numeric rows.
  const rows = data.filter(r => Array.isArray(r) ? !isNaN(parseFloat(r[1])) : (r && r.kp_index != null));
  const last = rows[rows.length - 1];
  if (!last) throw new Error("No Kp data");
  if (Array.isArray(last)){
    return { kp: parseFloat(last[1]), time: last[0] };
  }
  return { kp: parseFloat(last.kp_index), time: last.time_tag };
}

async function fetchAuroraData(lat, lon, sunAltDeg){
  const fallback = {
    available: false,
    kp: null, label: "--", color: "#93a0c2",
    geomagLat: null, geomagLon: null, boundaryLat: null, hemisphere: null,
    visible: false, marginDeg: null, isDark: sunAltDeg < -6,
    updated: null, regions: null,
    advice: "Live aurora data is unavailable right now — check your connection and try refreshing."
  };
  try{
    const { kp, time } = await fetchLiveKp();
    const activity = kpActivityLabel(kp);
    const pole = lat >= 0 ? GEOMAG_NORTH_POLE : GEOMAG_SOUTH_POLE;
    const hemisphere = lat >= 0 ? "Northern" : "Southern";
    const geomagLat = Math.abs(geomagneticLatitude(lat, lon, pole));
    const geomagLon = geomagneticLongitudeOffset(lat, lon, pole, lat >= 0 ? geomagLat : -geomagLat);
    const boundaryLat = kpToBoundaryLat(kp);
    const marginDeg = geomagLat - boundaryLat;
    const isDark = sunAltDeg < -6;
    const visible = isDark && marginDeg > -2; // small grace margin - oval edges are fuzzy, not a hard line
    const regions = regionsForKp(kp, hemisphere);

    let advice;
    if (!isDark){
      advice = `It's too bright to see it right now. Once the sky is dark, ${hemisphere.toLowerCase()} lights would ${marginDeg > -2 ? "likely be visible low on the horizon" : "still need much stronger activity to be seen"} from here.`;
    } else if (marginDeg > 6){
      advice = `Skies are dark and activity is well within range — look toward the ${hemisphere === "Northern" ? "north" : "south"} horizon and overhead.`;
    } else if (marginDeg > -2){
      advice = `Borderline! Worth a look low on the ${hemisphere === "Northern" ? "northern" : "southern"} horizon away from city lights.`;
    } else {
      advice = `Current activity (Kp ${kp.toFixed(1)}) isn't strong enough to reach this latitude — the aurora oval is about ${Math.abs(marginDeg).toFixed(0)}° of geomagnetic latitude further poleward right now.`;
    }

    return {
      available: true,
      kp, label: activity.label, color: activity.color,
      geomagLat, geomagLon, boundaryLat, hemisphere,
      visible, marginDeg, isDark,
      updated: time, regions,
      advice
    };
  }catch(e){
    console.error("Aurora fetch error", e);
    return fallback;
  }
}
