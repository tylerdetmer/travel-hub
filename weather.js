(function () {
  const style = document.createElement("style");
  style.textContent =
    ".wx-card{background:var(--bg);border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin-top:12px}" +
    ".wx-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}" +
    ".wx-place{font-size:13px;color:var(--mute)}" +
    '.wx-now{font-family:"Bricolage Grotesque","DM Sans",sans-serif;font-size:32px;font-weight:800;line-height:1.2}' +
    ".wx-sub{font-size:14px;color:var(--mute)}" +
    ".wx-unit{margin:0;padding:5px 10px;font-size:12px;font-weight:400;background:var(--surface);color:var(--ink);border:1px solid var(--line)}" +
    ".wx-strip{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;margin-top:8px}" +
    ".wx-day{flex:none;width:74px;text-align:center;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:8px 4px;font-size:13px}" +
    ".wx-day .i{display:block;font-size:24px;line-height:1.3}" +
    ".wx-day b{display:block}" +
    ".wx-day small{display:block;color:var(--mute);font-size:12px}" +
    ".wx-note{font-size:14px;color:var(--mute);margin:8px 0 0}" +
    ".wx-credit{font-size:12px;color:var(--mute);margin:10px 0 0}";
  document.head.appendChild(style);

  function wmo(c) {
    if (c === 0) return ["☀️", "Clear"];
    if (c === 1) return ["🌤️", "Mostly clear"];
    if (c === 2) return ["⛅", "Partly cloudy"];
    if (c === 3) return ["☁️", "Overcast"];
    if (c === 45 || c === 48) return ["🌫️", "Fog"];
    if (c >= 51 && c <= 55) return ["🌦️", "Drizzle"];
    if (c === 56 || c === 57) return ["🌧️", "Freezing drizzle"];
    if (c >= 61 && c <= 65) return ["🌧️", "Rain"];
    if (c === 66 || c === 67) return ["🌧️", "Freezing rain"];
    if ((c >= 71 && c <= 75) || c === 77) return ["🌨️", "Snow"];
    if (c >= 80 && c <= 82) return ["🌦️", "Showers"];
    if (c === 85 || c === 86) return ["🌨️", "Snow showers"];
    if (c >= 95) return ["⛈️", "Thunderstorms"];
    return ["🌡️", "Weather"];
  }

  const UNIT_KEY = "travelhub-units";

  function getUnit() {
    try {
      const saved = localStorage.getItem(UNIT_KEY);
      if (saved === "F" || saved === "C") return saved;
    } catch (e) {}
    return (navigator.language || "").toLowerCase() === "en-us" ? "F" : "C";
  }

  function setUnit(u) {
    try {
      localStorage.setItem(UNIT_KEY, u);
    } catch (e) {}
  }

  function temp(c, unit) {
    if (c === null || c === undefined) return "–";
    return Math.round(unit === "F" ? (c * 9) / 5 + 32 : c) + "°";
  }

  function addDays(text, n) {
    const [y, m, d] = text.split("-").map(Number);
    return new Date(y, m - 1, d + n);
  }

  async function geocode(destination) {
    const cacheKey = "travelhub-geo:" + destination.toLowerCase();
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey));
      if (cached) return cached;
    } catch (e) {}

    const parts = destination.split(",").map((s) => s.trim()).filter(Boolean);

    for (let i = 0; i < parts.length; i++) {
      const res = await fetch(
        "https://geocoding-api.open-meteo.com/v1/search?count=10&language=en&format=json&name=" +
          encodeURIComponent(parts[i])
      );
      if (!res.ok) throw new Error("Geocoding failed");

      const results = (await res.json()).results || [];
      if (!results.length) continue;

      const rest = parts.filter((_, j) => j !== i).join(" ").toLowerCase();
      let pick = results[0];
      if (rest) {
        const match = results.find((r) =>
          [r.admin1, r.admin2, r.country, r.country_code]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(rest)
        );
        if (match) pick = match;
      }

      const place = {
        lat: pick.latitude,
        lon: pick.longitude,
        label: [...new Set([pick.name, pick.admin1, pick.country].filter(Boolean))].join(", ")
      };

      try {
        localStorage.setItem(cacheKey, JSON.stringify(place));
      } catch (e) {}
      return place;
    }

    return null;
  }

  async function getForecast(place) {
    const res = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=" + place.lat +
        "&longitude=" + place.lon +
        "&current=temperature_2m,weather_code" +
        "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
        "&timezone=auto&forecast_days=16"
    );
    if (!res.ok) throw new Error("Forecast failed");
    return res.json();
  }

  function note(text) {
    return makeElement("p", text, "wx-note");
  }

  function draw(card, trip, place, data, unit) {
    card.replaceChildren();

    const [icon, label] = wmo(data.current.weather_code);

    const top = document.createElement("div");
    top.className = "wx-top";

    const left = document.createElement("div");
    left.append(
      makeElement("div", "Weather in " + place.label, "wx-place"),
      makeElement("div", icon + " " + temp(data.current.temperature_2m, unit), "wx-now"),
      makeElement("div", "Right now · " + label, "wx-sub")
    );

    const toggle = makeElement("button", "Switch to °" + (unit === "F" ? "C" : "F"), "wx-unit");
    toggle.type = "button";
    toggle.addEventListener("click", () => {
      const next = unit === "F" ? "C" : "F";
      setUnit(next);
      draw(card, trip, place, data, next);
    });

    top.append(left, toggle);
    card.appendChild(top);

    const d = data.daily;
    const today = d.time[0];
    const last = d.time[d.time.length - 1];
    const start = trip.start_date;
    const end = trip.end_date;

    let indexes = [];
    let message = "";
    let heading = "Next 7 days";

    if (start) {
      heading = "Forecast for your trip";
      if (end && end < today) {
        message = "This trip has ended.";
      } else if (start > last) {
        message =
          "Daily forecasts for your dates start showing around " +
          addDays(start, -15).toLocaleDateString([], { month: "long", day: "numeric" }) +
          ".";
      } else {
        indexes = d.time
          .map((t, i) => i)
          .filter((i) => d.time[i] >= start && (!end || d.time[i] <= end));
        if (!end) indexes = indexes.slice(0, 7);
        if (end && end > last) {
          message = "Forecasts cover the next 16 days. Later days appear as your trip gets closer.";
        }
      }
    } else {
      indexes = d.time.map((t, i) => i).slice(0, 7);
    }

    if (indexes.length) {
      card.appendChild(makeElement("h3", heading));

      const strip = document.createElement("div");
      strip.className = "wx-strip";

      indexes.forEach((i) => {
        const [dayIcon, dayLabel] = wmo(d.weather_code[i]);
        const date = new Date(d.time[i] + "T00:00:00");

        const day = document.createElement("div");
        day.className = "wx-day";
        day.title = dayLabel;

        day.append(
          makeElement("b", date.toLocaleDateString([], { weekday: "short" })),
          makeElement("small", date.toLocaleDateString([], { month: "short", day: "numeric" })),
          makeElement("span", dayIcon, "i"),
          makeElement("b", temp(d.temperature_2m_max[i], unit)),
          makeElement("small", temp(d.temperature_2m_min[i], unit))
        );

        const rain = d.precipitation_probability_max[i];
        if (rain !== null && rain !== undefined) {
          day.appendChild(makeElement("small", "💧 " + rain + "%"));
        }

        strip.appendChild(day);
      });

      card.appendChild(strip);
    }

    if (message) card.appendChild(note(message));

    const credit = makeElement("p", "Weather data by ", "wx-credit");
    const link = makeElement("a", "Open-Meteo.com");
    link.href = "https://open-meteo.com/";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    credit.appendChild(link);
    card.appendChild(credit);
  }

  async function addWeather(content, trip) {
    const card = document.createElement("div");
    card.className = "wx-card";
    card.appendChild(note("Loading weather..."));

    const anchor = [...content.querySelectorAll("h3")].find((h) => h.textContent === "Next up");
    if (anchor) content.insertBefore(card, anchor);
    else content.appendChild(card);

    const destination = (trip.destination || "").trim();
    if (!destination) {
      card.replaceChildren(note("This trip has no destination, so there’s no forecast."));
      return;
    }

    try {
      const place = await geocode(destination);
      if (!place) {
        card.replaceChildren(
          note("Couldn’t find “" + destination + "”. A format like “City, Country” works best.")
        );
        return;
      }
      const data = await getForecast(place);
      draw(card, trip, place, data, getUnit());
    } catch (e) {
      card.replaceChildren(note("Weather is unavailable right now. Try again later."));
    }
  }

  // Add the weather card to the Overview without touching app.js
  const original = window.showOverview;
  if (typeof original === "function") {
    window.showOverview = async function (content, trip) {
      await original(content, trip);
      addWeather(content, trip);
    };
  }
})();
