
const $ = (id) => document.getElementById(id);

const weatherCodes = {
  0: ["Clear sky", "☀️"],
  1: ["Mainly clear", "🌤️"],
  2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁️"],
  45: ["Foggy", "🌫️"],
  48: ["Rime fog", "🌫️"],
  51: ["Light drizzle", "🌦️"],
  53: ["Drizzle", "🌦️"],
  55: ["Heavy drizzle", "🌧️"],
  56: ["Freezing drizzle", "🌧️"],
  57: ["Freezing drizzle", "🌧️"],
  61: ["Light rain", "🌦️"],
  63: ["Rain", "🌧️"],
  65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"],
  67: ["Freezing rain", "🌧️"],
  71: ["Light snow", "🌨️"],
  73: ["Snow", "❄️"],
  75: ["Heavy snow", "❄️"],
  77: ["Snow grains", "❄️"],
  80: ["Rain showers", "🌦️"],
  81: ["Rain showers", "🌧️"],
  82: ["Heavy showers", "⛈️"],
  85: ["Snow showers", "🌨️"],
  86: ["Heavy snow showers", "🌨️"],
  95: ["Thunderstorm", "⛈️"],
  96: ["Thunderstorm with hail", "⛈️"],
  99: ["Heavy thunderstorm", "⛈️"]
};

const describe = (code) =>
  weatherCodes[code] || ["Variable conditions", "🌥️"];

const round = (n) => Math.round(n);

const dayName = (date, timezone, options) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    ...options
  }).format(date);

const dateFromLocal = (value) =>
  new Date(`${value.slice(0, 10)}T12:00:00Z`);

const formatClock = (iso) =>
  iso ? iso.slice(11, 16) : "--:--";

const setStatus = (message) => {
  $("status").textContent = message;
};

let requestController;

async function loadCity(city) {
  if (requestController) requestController.abort();

  requestController = new AbortController();
  const signal = requestController.signal;

  setStatus(`Loading weather for ${city}…`);

  try {
    const geocodeUrl = new URL(
      "https://geocoding-api.open-meteo.com/v1/search"
    );

    geocodeUrl.search = new URLSearchParams({
      name: city,
      count: "1",
      language: "en",
      format: "json"
    });

    const geoResponse = await fetch(geocodeUrl, { signal });

    if (!geoResponse.ok) {
      throw new Error("Could not search for that city.");
    }

    const geo = await geoResponse.json();

    if (!geo.results?.length) {
      throw new Error("City not found. Try another city name.");
    }

    const place = geo.results[0];

    const forecastUrl = new URL(
      "https://api.open-meteo.com/v1/forecast"
    );

    forecastUrl.search = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      timezone: place.timezone || "auto",
      current:
        "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
      hourly: "temperature_2m,weather_code",
      daily:
        "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max",
      forecast_days: "8",
      temperature_unit: "celsius",
      wind_speed_unit: "kmh"
    });

    const response = await fetch(forecastUrl, { signal });

    if (!response.ok) {
      throw new Error(
        "Weather service is temporarily unavailable."
      );
    }

    const data = await response.json();

    if (!data.current || !data.daily || !data.hourly) {
      throw new Error("Incomplete weather data received.");
    }

    renderWeather(data, place);
    setStatus("");

  } catch (error) {
    if (error.name === "AbortError") return;

    setStatus(
      error.message ||
      "Unable to load weather. Check your internet connection."
    );
  }
}

function renderWeather(data, place) {
  const current = data.current;
  const daily = data.daily;
  const hourly = data.hourly;
  const zone = data.timezone || place.timezone || "UTC";

  $("cityName").textContent = place.name;

  $("countryName").textContent = [
    place.admin1,
    place.country
  ].filter(Boolean).join(", ");

  $("temperature").textContent =
    round(current.temperature_2m);

  $("condition").textContent =
    describe(current.weather_code)[0];

  $("weatherIcon").textContent =
    describe(current.weather_code)[1];

  $("feelsLike").textContent =
    `${round(current.apparent_temperature)}°C`;

  $("highTemp").textContent =
    `${round(daily.temperature_2m_max[0])}°`;

  $("lowTemp").textContent =
    `${round(daily.temperature_2m_min[0])}°`;

  $("humidity").textContent =
    `${round(current.relative_humidity_2m)}%`;

  $("wind").textContent =
    `${round(current.wind_speed_10m)} km/h`;

  $("precip").textContent =
    `${Number(current.precipitation).toFixed(1)} mm`;

  $("uv").textContent =
    daily.uv_index_max[0] == null
      ? "N/A"
      : Number(daily.uv_index_max[0]).toFixed(1);

  $("sunrise").textContent =
    formatClock(daily.sunrise[0]);

  $("sunset").textContent =
    formatClock(daily.sunset[0]);

  $("todayDate").textContent = dayName(
    new Date(),
    zone,
    {
      weekday: "short",
      month: "short",
      day: "numeric"
    }
  );

  // Hourly forecast
  const index = hourly.time.findIndex(
    t => t >= current.time.slice(0, 13) + ":00"
  );

  const start = index >= 0 ? index : 0;

  const hourlyCards = hourly.time
    .slice(start, start + 8)
    .map((time, i) => {
      const idx = start + i;
      const card = document.createElement("div");

      card.className = "hour-item";

      const hour = Number(time.slice(11, 13));

      const label = i === 0
        ? "Now"
        : `${String(hour % 12 || 12)} ${hour >= 12 ? "PM" : "AM"}`;

      card.innerHTML = `
        <div class="time"></div>
        <div class="symbol" aria-hidden="true"></div>
        <strong></strong>
      `;

      card.querySelector(".time").textContent = label;

      card.querySelector(".symbol").textContent =
        describe(hourly.weather_code[idx])[1];

      card.querySelector("strong").textContent =
        `${round(hourly.temperature_2m[idx])}°`;

      return card;
    });

  $("hourlyForecast").replaceChildren(...hourlyCards);

  // Seven-day forecast
  const weeklyCards = daily.time
    .slice(0, 7)
    .map((date, i) => {
      const row = document.createElement("div");
      row.className = "day-item";

      const [description, emoji] =
        describe(daily.weather_code[i]);

      row.innerHTML = `
        <span class="day"></span>
        <span class="symbol" aria-hidden="true"></span>
        <span class="description"></span>
        <span class="range">
          <strong></strong>
          <span></span>
        </span>
      `;

      row.querySelector(".day").textContent =
        i === 0
          ? "Today"
          : dayName(
              dateFromLocal(date),
              "UTC",
              { weekday: "short" }
            );

      row.querySelector(".symbol").textContent = emoji;

      row.querySelector(".description").textContent =
        description;

      row.querySelector(".range strong").textContent =
        `${round(daily.temperature_2m_max[i])}°`;

      row.querySelector(".range span").textContent =
        `${round(daily.temperature_2m_min[i])}°`;

      return row;
    });

  $("weeklyForecast").replaceChildren(...weeklyCards);
}

// Search city
$("searchForm").addEventListener("submit", event => {
  event.preventDefault();

  const city = $("cityInput").value.trim();

  if (city) {
    loadCity(city);
  }
});

// Default city
loadCity("Kuala Lumpur");
