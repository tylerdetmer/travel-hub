(function () {
  const DOCS = "th-docs-v1";
  const PRIVATE_CACHES = ["th-data-v1", DOCS];
  const USER_KEY = "travelhub-cacheuser";

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  function clearPrivateCaches() {
    if (!("caches" in window)) return;
    PRIVATE_CACHES.forEach((name) => caches.delete(name));
  }

  // Offline banner
  const banner = document.createElement("div");
  banner.textContent = "You’re offline. Saved trips can be read; changes need a connection.";
  banner.style.cssText =
    "display:none;position:fixed;top:0;left:0;right:0;z-index:80;text-align:center;font-size:13px;" +
    "padding:calc(8px + env(safe-area-inset-top,0px)) 12px 8px;background:var(--accent);color:var(--on)";
  document.body.appendChild(banner);

  function updateBanner() {
    banner.style.display = navigator.onLine === false ? "block" : "none";
  }
  window.addEventListener("online", updateBanner);
  window.addEventListener("offline", updateBanner);
  updateBanner();

  // Remove saved private data when signing out or switching accounts
  document.addEventListener(
    "click",
    (e) => {
      if (e.target.closest("#signout")) {
        clearPrivateCaches();
        try {
          localStorage.removeItem(USER_KEY);
        } catch (err) {}
      }
    },
    true
  );

  setInterval(() => {
    try {
      const id = typeof currentUser !== "undefined" && currentUser ? currentUser.id : null;
      if (!id) return;
      const previous = localStorage.getItem(USER_KEY);
      if (previous !== id) {
        if (previous) clearPrivateCaches();
        localStorage.setItem(USER_KEY, id);
      }
    } catch (err) {}
  }, 3000);

  // Save a trip's information whenever you open it online
  function prefetch(trip) {
    const id = trip.id;
    const jobs = [
      db.from("itinerary_items").select("*").eq("trip_id", id).order("starts_at", { ascending: true }),
      db.from("trip_places").select("*").eq("trip_id", id).order("created_at", { ascending: false }),
      db.from("trip_documents").select("*").eq("trip_id", id).order("created_at", { ascending: false }),
      db.from("trip_members").select("*").eq("trip_id", id).order("created_at", { ascending: true }),
      db.from("packing_items").select("*").eq("trip_id", id).order("created_at", { ascending: true }),
      db.from("packing_templates").select("*").order("name", { ascending: true }),
      db.from("trip_budgets").select("*").eq("trip_id", id).maybeSingle(),
      db.from("trip_expenses").select("*").eq("trip_id", id).order("created_at", { ascending: false })
    ];
    Promise.allSettled(jobs.map((j) => Promise.resolve(j)));
  }

  const originalOpenTrip = window.openTrip;
  if (typeof originalOpenTrip === "function") {
    window.openTrip = async function (trip) {
      const result = await originalOpenTrip.apply(this, arguments);
      if (navigator.onLine !== false) {
        try {
          prefetch(trip);
        } catch (e) {}
      }
      return result;
    };
  }

  // ----- Documents offline -----
  if (!("caches" in window)) return;

  function docKey(doc) {
    return new Request(location.origin + "/offline-doc/" + doc.id);
  }

  async function getCachedDoc(doc) {
    try {
      const cache = await caches.open(DOCS);
      const hit = await cache.match(docKey(doc));
      return hit ? await hit.blob() : null;
    } catch (e) {
      return null;
    }
  }

  async function saveDoc(doc) {
    const { data, error } = await db.storage.from("trip-documents").download(doc.storage_path);
    if (error || !data) throw error || new Error("Download failed");
    const blob = new Blob([data], { type: doc.mime_type || data.type || "application/octet-stream" });
    const cache = await caches.open(DOCS);
    await cache.put(docKey(doc), new Response(blob, { headers: { "Content-Type": blob.type } }));
    return blob;
  }

  function openOffline(doc, asDownload) {
    const tab = asDownload ? null : window.open("", "_blank");
    return getCachedDoc(doc).then((blob) => {
      if (!blob) {
        if (tab) tab.close();
        alert(
          "This document isn’t saved for offline use. Open it once while online, or tap “Save all documents for offline” in Documents."
        );
        return;
      }
      const url = URL.createObjectURL(blob);
      if (asDownload) {
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.file_name || "document";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else if (tab) {
        tab.location.href = url;
      } else {
        window.location.href = url;
      }
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    });
  }

  const originalOpenDoc = window.openTripDocument;
  window.openTripDocument = function (doc, asDownload) {
    if (navigator.onLine !== false) {
      const result = typeof originalOpenDoc === "function" ? originalOpenDoc.apply(this, arguments) : undefined;
      getCachedDoc(doc).then((hit) => {
        if (!hit) saveDoc(doc).catch(() => {});
      });
      return result;
    }
    return openOffline(doc, asDownload);
  };

  function addDocPanel(content, trip) {
    const panel = document.createElement("div");
    panel.className = "panel";
    panel.appendChild(makeElement("h3", "Offline copies"));
    panel.appendChild(
      makeElement(
        "p",
        "Save this trip’s documents on this device so you can open them without signal. Any document you view is also saved automatically."
      )
    );

    const saveAll = makeElement("button", "Save all documents for offline");
    saveAll.type = "button";
    const clearAll = makeElement("button", "Remove offline copies", "secondary-button");
    clearAll.type = "button";
    const status = document.createElement("p");
    panel.append(saveAll, clearAll, status);

    const anchor = [...content.querySelectorAll("h3")].find((h) => h.textContent === "Saved documents");
    if (anchor) content.insertBefore(panel, anchor);
    else content.appendChild(panel);

    saveAll.addEventListener("click", async () => {
      if (navigator.onLine === false) {
        status.textContent = "Connect to the internet to save documents.";
        return;
      }
      saveAll.disabled = true;
      status.textContent = "Checking documents...";

      const { data, error } = await db.from("trip_documents").select("*").eq("trip_id", trip.id);
      if (error) {
        saveAll.disabled = false;
        status.textContent = "Could not check documents: " + error.message;
        return;
      }

      const docs = data || [];
      if (!docs.length) {
        saveAll.disabled = false;
        status.textContent = "No documents to save yet.";
        return;
      }

      let done = 0;
      let failed = 0;
      for (const doc of docs) {
        status.textContent = "Saving " + (done + failed + 1) + " of " + docs.length + "...";
        try {
          if (!(await getCachedDoc(doc))) await saveDoc(doc);
          done++;
        } catch (e) {
          failed++;
        }
      }

      saveAll.disabled = false;
      status.textContent =
        done + " of " + docs.length + " documents ready for offline use." +
        (failed ? " " + failed + " couldn’t be saved." : "");
    });

    clearAll.addEventListener("click", async () => {
      await caches.delete(DOCS);
      status.textContent = "Offline copies removed.";
    });
  }

  const originalShowDocuments = window.showDocuments;
  if (typeof originalShowDocuments === "function") {
    window.showDocuments = async function (content, trip) {
      await originalShowDocuments.apply(this, arguments);
      try {
        addDocPanel(content, trip);
      } catch (e) {}
    };
  }
})();
