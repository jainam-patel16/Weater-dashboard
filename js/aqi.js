// aqi.js - Open-Meteo Air Quality API (free, no key)

const AQI_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

function aqiCategory(usAqi){
  if (usAqi == null) return ["--", "#4ade80"];
  if (usAqi <= 50)  return ["Good", "#4ade80"];
  if (usAqi <= 100) return ["Moderate", "#fbbf24"];
  if (usAqi <= 150) return ["Unhealthy (SG)", "#fb923c"];
  if (usAqi <= 200) return ["Unhealthy", "#f87171"];
  if (usAqi <= 300) return ["Very Unhealthy", "#c084fc"];
  return ["Hazardous", "#7f1d1d"];
}

async function fetchAQI(lat, lon){
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: [
      "us_aqi","european_aqi","pm10","pm2_5","carbon_monoxide",
      "nitrogen_dioxide","sulphur_dioxide","ozone"
    ].join(","),
    hourly: ["grass_pollen"].join(","),
    timezone: "auto"
  });

  const resp = await fetch(`${AQI_URL}?${params.toString()}`);
  if (!resp.ok) throw new Error("AQI fetch failed");
  const data = await resp.json();

  let pollen = null;
  if (data.hourly && data.hourly.grass_pollen){
    const nowISO = data.current.time;
    let idx = data.hourly.time.indexOf(nowISO);
    if (idx === -1) idx = 0;
    pollen = data.hourly.grass_pollen[idx];
  }

  return {
    usAqi: data.current.us_aqi,
    euAqi: data.current.european_aqi,
    pm10: data.current.pm10,
    pm25: data.current.pm2_5,
    co: data.current.carbon_monoxide,
    no2: data.current.nitrogen_dioxide,
    so2: data.current.sulphur_dioxide,
    o3: data.current.ozone,
    grassPollen: pollen
  };
}
