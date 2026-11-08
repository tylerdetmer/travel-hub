(function () {
  const KEY = "travelhub-resume";
  let lastUser = null;
  let restored = false;
  let inflight = null;

  function readSaved() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || null;
    } catch (e) {
      return null;
    }
  }

  function writeSaved(value) {
    try {
      if (value) localStorage.setItem(KEY, JSON.stringify(value));
      else localStorage.removeItem(KEY);
    } catch (e) {}
  }

  // A trip is open when the "Your trips" heading is hidden
  function tripOpen() {
    return Boolean(document.querySelector("#app > h1.hidden"));
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function restore() {
    const saved = readSaved();
    if (!saved || !saved.tripId || typeof db === "undefined" || !db) return;

    // Wait for the trips list to finish loading first
    for (let n = 0; n < 50; n++) {
      const box = document.getElementById("trips");
      if (box && (box.children.length || box.textContent.trim())) break;
      await sleep(100);
    }
    await sleep(400);

    if (tripOpen()) return;

    const { data, error } = await db
      .from("trips")
      .select("*")
      .eq("id", saved.tripId)
      .maybeSingle();

    if (error) return;
    if (!data) {
      writeSaved(null);
      return;
    }
    if (tripOpen()) return;

    await openTrip(data);

    if (saved.section && saved.section !== "Overview") {
      const button = [...document.querySelectorAll(".workspace-navigation button")].find(
        (b) => b.textContent === saved.section
      );
      if (button) button.click();
    }
  }

  // Remember which trip is open
  const originalOpenTrip = window.openTrip;
  if (typeof originalOpenTrip === "function") {
    window.openTrip = async function (trip) {
      writeSaved({ tripId: trip.id, section: "Overview" });
      return originalOpenTrip.apply(this, arguments);
    };
  }

  // Remember which tab is open, and forget everything on "Back to trips"
  document.addEventListener("click", (e) => {
    const tab = e.target.closest(".workspace-navigation button");
    if (tab) {
      const saved = readSaved();
      if (saved) {
        saved.section = tab.textContent;
        writeSaved(saved);
      }
      return;
    }
    const back = e.target.closest("#trips > .panel > button:first-child");
    if (back && back.textContent.indexOf("←") === 0) writeSaved(null);
  });

  // Ignore background sign-in events while a trip is open
  const originalLoadTrips = window.loadTrips;
  if (typeof originalLoadTrips === "function") {
    window.loadTrips = function () {
      const args = arguments;
      const sameUser = Boolean(currentUser) && currentUser.id === lastUser;

      if (tripOpen() && sameUser) return Promise.resolve();
      if (inflight) return inflight;

      inflight = (async () => {
        try {
          await originalLoadTrips.apply(window, args);
          lastUser = currentUser ? currentUser.id : null;
        } finally {
          inflight = null;
        }
        if (!restored) {
          restored = true;
          restore();
        }
      })();

      return inflight;
    };
  }

  // If the app finished loading before this file did, restore now
  const appEl = document.getElementById("app");
  if (
    !restored &&
    typeof currentUser !== "undefined" &&
    currentUser &&
    appEl &&
    !appEl.classList.contains("hidden") &&
    !tripOpen()
  ) {
    restored = true;
    lastUser = currentUser.id;
    restore();
  }
})();
