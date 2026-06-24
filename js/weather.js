// weather.js - Open-Meteo weather fetching + WMO weather code mapping

const WMO_CODES = {
  0:  ["☀️", "Clear sky"],
  1:  ["🌤️", "Mainly clear"],
  2:  ["⛅", "Partly cloudy"],
  3:  ["☁️", "Overcast"],
  45: ["🌫️", "Fog"],
  48: ["🌫️", "Rime fog"],
  51: ["🌦️", "Light drizzle"],
  53: ["🌦️", "Drizzle"],
  55: ["🌧️", "Dense drizzle"],
  56: ["🌧️", "Freezing drizzle"],
  57: ["🌧️", "Dense freezing drizzle"],
  61: ["🌧️", "Slight rain"],
  63: ["🌧️", "Rain"],
  65: ["🌧️", "Heavy rain"],
  66: ["🌧️", "Freezing rain"],
  67: ["🌧️", "Heavy freezing rain"],
  71: ["🌨️", "Slight snow"],
  73: ["🌨️", "Snow"],
  75: ["❄️", "Heavy snow"],
  77: ["❄️", "Snow grains"],
  80: ["🌦️", "Slight showers"],
  81: ["🌧️", "Showers"],
  82: ["⛈️", "Violent showers"],
  85: ["🌨️", "Snow showers"],
  86: ["❄️", "Heavy snow showers"],
  95: ["⛈️", "Thunderstorm"],
  96: ["⛈️", "Thunderstorm + hail"],
  99: ["⛈️", "Severe thunderstorm + hail"]
};
function wmoIcon(code){ return (WMO_CODES[code] || ["❓","Unknown"])[0]; }
function wmoDesc(code){ return (WMO_CODES[code] || ["❓","Unknown"])[1]; }

const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";

async function fetchWeather(lat, lon){
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: [
      "temperature_2m","relative_humidity_2m","apparent_temperature","is_day",
      "precipitation","weather_code","cloud_cover","pressure_msl","surface_pressure",
      "wind_speed_10m","wind_direction_10m","wind_gusts_10m","dew_point_2m"
    ].join(","),
    hourly: [
      "temperature_2m","precipitation_probability","weather_code","visibility","uv_index",
      "cape","freezing_level_height","soil_temperature_0cm","snowfall",
      "wind_speed_10m","wind_gusts_10m","precipitation"
    ].join(","),
    daily: [
      "weather_code","temperature_2m_max","temperature_2m_min","sunrise","sunset",
      "precipitation_sum","uv_index_max","wind_gusts_10m_max","precipitation_probability_max"
    ].join(","),
    timezone: "auto",
    forecast_days: 7
  });

  const resp = await fetch(`${WEATHER_URL}?${params.toString()}`);
  if (!resp.ok) throw new Error("Weather fetch failed");
  const data = await resp.json();

  // find current hour index in hourly arrays to pull visibility/uv/cape/etc "now"
  const nowISO = data.current.time;
  let idx = data.hourly.time.indexOf(nowISO);
  if (idx === -1) idx = 0;

  return {
    elevation: data.elevation,
    timezone: data.timezone,
    timezoneAbbr: data.timezone_abbreviation,
    utcOffsetSeconds: data.utc_offset_seconds,
    current: {
      temp: data.current.temperature_2m,
      feelsLike: data.current.apparent_temperature,
      humidity: data.current.relative_humidity_2m,
      isDay: data.current.is_day,
      precipitation: data.current.precipitation,
      weatherCode: data.current.weather_code,
      cloudCover: data.current.cloud_cover,
      pressure: data.current.pressure_msl,
      windSpeed: data.current.wind_speed_10m,
      windDir: data.current.wind_direction_10m,
      windGust: data.current.wind_gusts_10m,
      dewPoint: data.current.dew_point_2m,
      visibility: data.hourly.visibility ? data.hourly.visibility[idx] : null,
      uvIndex: data.hourly.uv_index ? data.hourly.uv_index[idx] : null,
      cape: data.hourly.cape ? data.hourly.cape[idx] : null,
      freezingLevel: data.hourly.freezing_level_height ? data.hourly.freezing_level_height[idx] : null,
      soilTemp: data.hourly.soil_temperature_0cm ? data.hourly.soil_temperature_0cm[idx] : null,
      snowfall: data.hourly.snowfall ? data.hourly.snowfall[idx] : null,
    },
    hourly: data.hourly,
    hourlyNowIndex: idx,
    daily: data.daily
  };
}
