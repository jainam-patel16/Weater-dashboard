# Global Sky & Weather Dashboard

A fully dynamic, location-aware weather + astronomy dashboard. No backend, no API keys, no build step — just static HTML/CSS/JS.

## What it shows

- **Current conditions**: temperature, feels-like, humidity, wind + gusts, pressure, visibility, cloud cover, dew point, precipitation
- **Live Air Quality**: US & EU AQI, PM2.5, PM10, O3, NO2, SO2, CO, grass pollen (where available)
- **UV Index** with a safety gauge and advice
- **Sun**: sunrise, sunset, solar noon, day length, a live sun-position arc
- **Moon**: phase name, illumination %, moonrise/moonset, distance, age, a visual phase disc
- **24-hour hourly forecast** and **7-day forecast**
- **Tonight's Sky**: constellations and planets currently above the horizon for the selected location, each tagged with compass direction + altitude, with a reference photo pulled from Wikipedia
- **Extra metrics**: elevation, snowfall, soil temperature, CAPE, freezing level, pollen
- A live local clock, a Leaflet map you can click/drag to pick any location, a city search box, and a "use my location" button
- Auto-refreshes every 2 minutes (toggleable)

## Data sources (all free, no API key required)

- [Open-Meteo Forecast API](https://open-meteo.com/) — weather, UV, visibility, soil/CAPE data
- [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) — AQI & pollutants
- [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api) — city search
- [BigDataCloud reverse geocoding](https://www.bigdatacloud.com/) — turns map clicks / GPS coords into place names
- [SunCalc](https://github.com/mourner/suncalc) — sun & moon timing/position
- [Astronomy Engine](https://github.com/cosinekitty/astronomy) — precise alt/az for constellations & planets
- [Wikipedia REST API](https://www.mediawiki.org/wiki/REST_API) — reference images for sky objects

## Running it

This is a static site, but browsers block `fetch()` calls from `file://` pages in some configurations, so the safest way to run it is via any simple local web server:

```bash
cd weather-dashboard
python3 -m http.server 8080
# then open http://localhost:8080 in your browser
```

Or with Node:

```bash
npx serve .
```

## Deploying

Because there's no build step, you can drag-and-drop this folder onto:
- **Netlify** (drag the folder onto the Netlify dashboard)
- **Vercel** (`vercel deploy`)
- **GitHub Pages** (push to a repo, enable Pages on the branch)
- Any static host / S3 bucket / nginx server

## Notes & limitations

- The "Tonight's Sky" feature uses approximate constellation centroid coordinates (good for "is this roughly overhead" purposes) rather than full star-boundary maps — it will correctly tell you which constellations and visible planets are above the horizon, in which direction, and how high up, but it does not render a pixel-accurate star chart.
- Grass pollen data is mainly available for Europe; other regions will show "N/A".
- All APIs used are free tiers with reasonable rate limits — for very heavy personal use you generally won't hit limits, but if you deploy this publicly at scale, consider getting your own Open-Meteo API key (still free) for higher limits.
- This was built and syntax-checked in a sandboxed environment without outbound internet access, so live API responses were not exercised end-to-end before delivery — test it once on first run, and let me know if anything needs adjusting.
