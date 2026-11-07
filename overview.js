(function () {
  const style = document.createElement("style");
  style.textContent =
    ".ov-count{display:flex;flex-direction:column;gap:2px;width:100%;margin:12px 0 0;text-align:left;" +
    "background:var(--accent);color:var(--on);border-radius:16px;padding:14px 16px;font-weight:400}" +
    '.ov-count .n{font-family:"Bricolage Grotesque","DM Sans",sans-serif;font-size:34px;font-weight:800;line-height:1}' +
    ".ov-count small{font-size:13px;opacity:.8}" +
    ".ov-count b{font-size:15px}" +
    ".ov-tiles{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0 12px}" +
    ".ov-tile{margin:0;text-align:left;background:var(--bg);color:var(--ink);border:1px solid var(--line);" +
    "border-radius:14px;padding:12px;font-weight:400}" +
    '.ov-tile b{display:block;font-family:"Bricolage Grotesque","DM Sans",sans-serif;font-size:26px;font-weight:800;line-height:1.1}' +
    ".ov-tile small{color:var(--mute);font-size:13px}" +
    ".ov-row{display:flex;align-items:center;gap:8px;width:100%;margin:0 0 8px;text-align:left;" +
    "background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:14px;padding:12px 14px;font-weight:400}" +
    ".ov-body{flex:1;min-width:0}" +
    ".ov-row strong{display:block;font-weight:700}" +
    ".ov-row small{display:block;color:var(--mute);font-size:13px}" +
    ".ov-go{color:var(--mute);font-size:22px;line-height:1}" +
    ".ov-bar{height:10px;border-radius:99px;background:var(--line);overflow:hidden;margin-top:8px}" +
    ".ov-bar i{display:block;height:100%;background:var(--fun)}" +
    ".ov-bar.over i{background:var(--social)}" +
    "@keyframes ovflash{0%,60%{box-shadow:0 0 0 3px var(--accent)}100%{box-shadow:0 0 0 0 transparent}}" +
    ".ov-flash{animation:ovflash 1.8s ease}";
  document.head.appendChild(style);

  // Switch to another trip tab, then scroll to and highlight an item by its title
  function goTo(tab, targetText) {
    const button = [...document.querySelectorAll(".workspace-navigation button")].find(
      (b) => b.textContent === tab
    );
    if (!button) return;
    button.click();

    if (!targetText) return;

    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      const heading = [
        ...document.querySelectorAll(".workspace-content .trip-card h3, .workspace-content .map-place-card h3")
      ].find((h) => h.textContent === targetText);

      if (heading) {
        clearInterval(timer);
        const card = heading.closest(".trip-card, .map-place-card");
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.classList.add("ov-flash");
        setTimeout(() => card.classList.remove("ov-flash"), 1900);
      } else if (tries > 25) {
        clearInterval(timer);
      }
    }, 150);
  }

  function parseDay(text) {
    if (!text) return null;
    const [y, m, d] = text.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function countdownInfo(trip) {
    const DAY = 86400000;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = parseDay(trip.start_date);
    const end = parseDay(trip.end_date);

    if (!start) {
      return { num: "—", label: "Add trip dates to see a countdown" };
    }
    if (today < start) {
      const n = Math.round((start - today) / DAY);
      return { num: String(n), label: (n === 1 ? "day until" : "days until") + " " + trip.name };
    }
    if (!end || today <= end) {
      const day = Math.round((today - start) / DAY) + 1;
      const total = end ? Math.round((end - start) / DAY) + 1 : null;
      return {
        num: "Day " + day,
        label: (total ? "of " + total + " · " : "") + trip.name
      };
    }
    return { num: "✓", label: "Trip completed · " + trip.name };
  }

  function makeRow(titleText, subText, onTap) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ov-row";

    const body = document.createElement("span");
    body.className = "ov-body";
    body.appendChild(makeElement("strong", titleText));
    if (subText) body.appendChild(makeElement("small", subText));

    button.append(body, makeElement("span", "›", "ov-go"));
    button.addEventListener("click", onTap);
    return button;
  }

  window.showOverview = async function (content, trip) {
    const [plansRes, placesRes, docsRes, peopleRes, budgetRes, expensesRes] = await Promise.all([
      db
        .from("itinerary_items")
        .select("id,title,starts_at,location")
        .eq("trip_id", trip.id)
        .order("starts_at", { ascending: true }),
      db.from("trip_places").select("id", { count: "exact", head: true }).eq("trip_id", trip.id),
      db.from("trip_documents").select("id", { count: "exact", head: true }).eq("trip_id", trip.id),
      db
        .from("trip_members")
        .select("id", { count: "exact", head: true })
        .eq("trip_id", trip.id)
        .eq("status", "accepted"),
      db.from("trip_budgets").select("total_budget,currency").eq("trip_id", trip.id).maybeSingle(),
      db.from("trip_expenses").select("actual_amount").eq("trip_id", trip.id)
    ]);

    const plans = plansRes.data || [];

    // Countdown
    const info = countdownInfo(trip);
    const count = document.createElement("button");
    count.type = "button";
    count.className = "ov-count";
    count.append(makeElement("span", info.num, "n"), makeElement("small", info.label));
    count.addEventListener("click", () => goTo("Itinerary"));
    content.appendChild(count);

    // Next up
    content.appendChild(makeElement("h3", "Next up"));
    const now = new Date();
    const upcoming = plans
      .filter((p) => p.starts_at && new Date(p.starts_at) >= now)
      .slice(0, 3);

    if (upcoming.length === 0) {
      content.appendChild(
        makeRow("No upcoming plans", "Tap to add one in Itinerary", () => goTo("Itinerary"))
      );
    } else {
      upcoming.forEach((p) => {
        const when = new Date(p.starts_at).toLocaleString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit"
        });
        content.appendChild(
          makeRow(p.title, when + (p.location ? " · " + p.location : ""), () =>
            goTo("Itinerary", p.title)
          )
        );
      });
    }

    // At a glance
    content.appendChild(makeElement("h3", "At a glance"));
    const tiles = document.createElement("div");
    tiles.className = "ov-tiles";

    [
      ["Plans", plans.length, "Itinerary"],
      ["Saved places", placesRes.count || 0, "Map"],
      ["Documents", docsRes.count || 0, "Documents"],
      ["People", peopleRes.count || 0, "Members"]
    ].forEach(([label, value, tab]) => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "ov-tile";
      tile.append(makeElement("b", String(value)), makeElement("small", label));
      tile.addEventListener("click", () => goTo(tab));
      tiles.appendChild(tile);
    });
    content.appendChild(tiles);

    // Budget snapshot
    const total =
      budgetRes.data && budgetRes.data.total_budget !== null
        ? Number(budgetRes.data.total_budget)
        : null;
    const currency = (budgetRes.data && budgetRes.data.currency) || "USD";
    const spent = (expensesRes.data || []).reduce((t, e) => t + (Number(e.actual_amount) || 0), 0);

    function money(n) {
      try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency: currency }).format(n);
      } catch (e) {
        return currency + " " + n.toFixed(2);
      }
    }

    const budgetRow = makeRow(
      "Budget",
      total !== null
        ? money(spent) + " spent of " + money(total)
        : spent > 0
        ? money(spent) + " spent · no budget set"
        : "No budget set yet. Tap to add one.",
      () => goTo("Budget")
    );

    if (total !== null && total > 0) {
      const bar = document.createElement("div");
      bar.className = "ov-bar" + (spent > total ? " over" : "");
      const fill = document.createElement("i");
      fill.style.width = Math.min(100, (spent / total) * 100) + "%";
      bar.appendChild(fill);
      budgetRow.querySelector(".ov-body").appendChild(bar);
    }
    content.appendChild(budgetRow);
  };
})();
