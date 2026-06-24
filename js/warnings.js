// warnings.js - heuristic "upcoming weather" warnings engine.
// Open-Meteo has no official government-alert endpoint, so we derive
// sensible hazard warnings client-side from the forecast data we already
// fetch (hourly + daily arrays) plus the live AQI reading.

const WARNING_DEFS = {
  thunderstorm: { icon: "⛈️", title: "Thunderstorm risk" },
  severeThunderstorm: { icon: "⛈️", title: "Severe thunderstorm risk" },
  heavyRain: { icon: "🌧️", title: "Heavy rain expected" },
  rainLikely: { icon: "🌦️", title: "Rain likely" },
  heavySnow: { icon: "❄️", title: "Heavy snow expected" },
  snowLikely: { icon: "🌨️", title: "Snow likely" },
  fog: { icon: "🌫️", title: "Dense fog expected" },
  highWind: { icon: "💨", title: "High wind warning" },
  strongWind: { icon: "🌬️", title: "Strong wind advisory" },
  extremeHeat: { icon: "🥵", title: "Extreme heat warning" },
  heatAdvisory: { icon: "☀️", title: "Heat advisory" },
  extremeCold: { icon: "🥶", title: "Extreme cold warning" },
  coldAdvisory: { icon: "🧊", title: "Cold advisory" },
  extremeUV: { icon: "🕶️", title: "Extreme UV warning" },
  highUV: { icon: "🔆", title: "High UV advisory" },
  poorAQI: { icon: "😶‍🌫️", title: "Unhealthy air quality" },
  hazardousAQI: { icon: "☣️", title: "Hazardous air quality" },
  snowAccumulation: { icon: "🌨️", title: "Snow accumulation" }
};

function severityRank(sev){ return { severe: 3, moderate: 2, minor: 1 }[sev] || 0; }

function fmtHourLabel(iso, utcOffsetSeconds){
  const d = new Date(iso);
  const local = new Date(d.getTime() + (utcOffsetSeconds || 0) * 1000);
  let h = local.getUTCHours();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12; if (h === 0) h = 12;
  return `${h} ${ap}`;
}

function fmtDayLabel(iso, idx){
  if (idx === 0) return "Today";
  if (idx === 1) return "Tomorrow";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "long" });
}

function pushWarning(list, key, severity, detail, when){
  const def = WARNING_DEFS[key];
  if (!def) return;
  list.push({
    key, severity, icon: def.icon, title: def.title, detail, when
  });
}

// Scan the next `hoursAhead` hourly entries (starting at hourlyNowIndex) for
// hazard codes/thresholds, returning the soonest occurrence of each.
function generateWarnings(weather, aqi, now){
  const warnings = [];
  if (!weather || !weather.hourly) return warnings;

  const hourly = weather.hourly;
  const daily = weather.daily;
  const utcOffsetSeconds = weather.utcOffsetSeconds || 0;
  const startIdx = weather.hourlyNowIndex || 0;
  const hoursAhead = 24;
  const endIdx = Math.min(hourly.time.length, startIdx + hoursAhead);

  const seen = {}; // key -> true, only report the first/soonest occurrence

  for (let i = startIdx; i < endIdx; i++){
    const code = hourly.weather_code ? hourly.weather_code[i] : null;
    const time = hourly.time[i];
    const label = fmtHourLabel(time, utcOffsetSeconds);
    const precipProb = hourly.precipitation_probability ? hourly.precipitation_probability[i] : null;
    const precipAmt = hourly.precipitation ? hourly.precipitation[i] : null;
    const gust = hourly.wind_gusts_10m ? hourly.wind_gusts_10m[i] : null;
    const wind = hourly.wind_speed_10m ? hourly.wind_speed_10m[i] : null;
    const uv = hourly.uv_index ? hourly.uv_index[i] : null;
    const snow = hourly.snowfall ? hourly.snowfall[i] : null;

    // Thunderstorms
    if (!seen.severeThunderstorm && (code === 96 || code === 99)){
      pushWarning(warnings, "severeThunderstorm", "severe", `Thunderstorm with hail possible around ${label}.`, time);
      seen.severeThunderstorm = true;
    } else if (!seen.thunderstorm && code === 95){
      pushWarning(warnings, "thunderstorm", "moderate", `Thunderstorms possible around ${label}.`, time);
      seen.thunderstorm = true;
    }

    // Rain
    if (!seen.heavyRain && (code === 65 || code === 67 || code === 82 || (precipAmt != null && precipAmt >= 7.5))){
      pushWarning(warnings, "heavyRain", "severe", `Heavy rain expected around ${label}.`, time);
      seen.heavyRain = true;
    } else if (!seen.rainLikely && !seen.heavyRain && (
      [51,53,55,56,57,61,63,66,80,81].includes(code) || (precipProb != null && precipProb >= 60)
    )){
      pushWarning(warnings, "rainLikely", "minor", `Rain likely around ${label}${precipProb != null ? ` (${precipProb}% chance)` : ""}.`, time);
      seen.rainLikely = true;
    }

    // Snow
    if (!seen.heavySnow && (code === 75 || code === 86 || (snow != null && snow >= 1))){
      pushWarning(warnings, "heavySnow", "severe", `Heavy snow expected around ${label}.`, time);
      seen.heavySnow = true;
    } else if (!seen.snowLikely && !seen.heavySnow && (code === 71 || code === 73 || code === 77 || code === 85)){
      pushWarning(warnings, "snowLikely", "moderate", `Snow likely around ${label}.`, time);
      seen.snowLikely = true;
    }

    // Fog
    if (!seen.fog && (code === 45 || code === 48)){
      pushWarning(warnings, "fog", "minor", `Dense fog expected around ${label}, reducing visibility.`, time);
      seen.fog = true;
    }

    // Wind
    const maxWindish = Math.max(gust || 0, wind || 0);
    if (!seen.highWind && (gust != null && gust >= 70)){
      pushWarning(warnings, "highWind", "severe", `Wind gusts up to ${Math.round(gust)} km/h expected around ${label}.`, time);
      seen.highWind = true;
    } else if (!seen.strongWind && !seen.highWind && maxWindish >= 45){
      pushWarning(warnings, "strongWind", "moderate", `Strong winds up to ${Math.round(maxWindish)} km/h expected around ${label}.`, time);
      seen.strongWind = true;
    }

    // UV
    if (!seen.extremeUV && uv != null && uv >= 11){
      pushWarning(warnings, "extremeUV", "severe", `Extreme UV index (${uv.toFixed(1)}) around ${label}. Avoid sun exposure.`, time);
      seen.extremeUV = true;
    } else if (!seen.highUV && !seen.extremeUV && uv != null && uv >= 8){
      pushWarning(warnings, "highUV", "moderate", `High UV index (${uv.toFixed(1)}) around ${label}. Use sun protection.`, time);
      seen.highUV = true;
    }
  }

  // Daily extremes (temperature, snow accumulation) - look at today + next 2 days
  if (daily && daily.time){
    const dayLookahead = Math.min(daily.time.length, 3);
    for (let d = 0; d < dayLookahead; d++){
      const tMax = daily.temperature_2m_max ? daily.temperature_2m_max[d] : null;
      const tMin = daily.temperature_2m_min ? daily.temperature_2m_min[d] : null;
      const precipSum = daily.precipitation_sum ? daily.precipitation_sum[d] : null;
      const dayLabel = fmtDayLabel(daily.time[d], d);

      if (!seen.extremeHeat && tMax != null && tMax >= 40){
        pushWarning(warnings, "extremeHeat", "severe", `${dayLabel}'s high of ${Math.round(tMax)}° is dangerously hot.`, daily.time[d]);
        seen.extremeHeat = true;
      } else if (!seen.heatAdvisory && !seen.extremeHeat && tMax != null && tMax >= 35){
        pushWarning(warnings, "heatAdvisory", "moderate", `${dayLabel}'s high of ${Math.round(tMax)}° is very hot.`, daily.time[d]);
        seen.heatAdvisory = true;
      }

      if (!seen.extremeCold && tMin != null && tMin <= -25){
        pushWarning(warnings, "extremeCold", "severe", `${dayLabel}'s low of ${Math.round(tMin)}° is dangerously cold.`, daily.time[d]);
        seen.extremeCold = true;
      } else if (!seen.coldAdvisory && !seen.extremeCold && tMin != null && tMin <= -10){
        pushWarning(warnings, "coldAdvisory", "minor", `${dayLabel}'s low of ${Math.round(tMin)}° is very cold.`, daily.time[d]);
        seen.coldAdvisory = true;
      }

      if (!seen.snowAccumulation && !seen.heavySnow && precipSum != null && daily.weather_code &&
          [71,73,75,77,85,86].includes(daily.weather_code[d]) && precipSum >= 10){
        pushWarning(warnings, "snowAccumulation", "moderate", `Significant snow accumulation possible ${dayLabel.toLowerCase()}.`, daily.time[d]);
        seen.snowAccumulation = true;
      }
    }
  }

  // Air quality (current reading)
  if (aqi && aqi.usAqi != null){
    if (aqi.usAqi >= 300){
      pushWarning(warnings, "hazardousAQI", "severe", `Current US AQI is ${aqi.usAqi} (Hazardous). Avoid outdoor activity.`, now ? now.toISOString() : null);
    } else if (aqi.usAqi >= 151){
      pushWarning(warnings, "poorAQI", "moderate", `Current US AQI is ${aqi.usAqi} (Unhealthy). Limit prolonged outdoor exertion.`, now ? now.toISOString() : null);
    }
  }

  warnings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  return warnings;
}
