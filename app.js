
const config = window.TRAVEL_HUB_CONFIG;

const statusEl = document.getElementById("status");
const setupSection = document.getElementById("setup");
const authSection = document.getElementById("auth");
const appSection = document.getElementById("app");

let db;
let currentUser = null;
let isPasswordRecovery = false;
let activeMap = null;
let mapMarkers = [];

function showMessage(elementId, message) {
  const element = document.getElementById(elementId);
  if (element) element.textContent = message;
}

function showStatus(message) {
  if (statusEl) statusEl.textContent = message;
}

function showScreen(screen) {
  setupSection.classList.add("hidden");
  authSection.classList.add("hidden");
  appSection.classList.add("hidden");

  if (screen === "setup") setupSection.classList.remove("hidden");
  if (screen === "auth") authSection.classList.remove("hidden");
  if (screen === "app") appSection.classList.remove("hidden");
}

function formatDateTimeForInput(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return localDate.toISOString().slice(0, 16);
}

function formatTimeRange(item) {
  if (!item.starts_at) return "Time not specified";

  const startTime = new Date(item.starts_at).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });

  if (!item.ends_at) return startTime;

  const endTime = new Date(item.ends_at).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });

  return `${startTime} – ${endTime}`;
}

function makeElement(tag, text, className) {
  const element = document.createElement(tag);

  if (text !== undefined && text !== null) {
    element.textContent = text;
  }

  if (className) element.className = className;

  return element;
}

async function loadTrips() {
  const tripsContainer = document.getElementById("trips");
  tripsContainer.replaceChildren();
  showStatus("Loading trips...");

  const { data, error } = await db
    .from("trips")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    showStatus("Unable to load trips");
    tripsContainer.textContent = error.message;
    return;
  }

  if (!data || data.length === 0) {
    showStatus("Ready");
    tripsContainer.textContent =
      "No trips yet. Create your first trip above!";
    return;
  }

  data.forEach((trip) => {
    const card = document.createElement("section");
    card.className = "trip-card";

    const heading = makeElement("h2", trip.name);
    const destination = makeElement(
      "p",
      trip.destination || "Destination not added"
    );

    const dates = makeElement(
      "p",
      `${trip.start_date || "Date not set"} – ${trip.end_date || "Date not set"}`
    );

    const openButton = makeElement("button", "Open trip");

    openButton.addEventListener("click", () => openTrip(trip));

    card.append(heading, destination, dates, openButton);
    tripsContainer.appendChild(card);
  });

  showStatus("Ready");
}

async function openTrip(trip) {
  if (activeMap) {
    activeMap.remove();
    activeMap = null;
  }

  const appTitle = document.querySelector("#app > h1");
  const createPanel = document.querySelector("#app > .panel");
  const tripsContainer = document.getElementById("trips");

  appTitle.classList.add("hidden");
  createPanel.classList.add("hidden");
  tripsContainer.replaceChildren();

  const workspace = document.createElement("section");
  workspace.className = "panel";

  const backButton = makeElement("button", "← Back to trips");

  backButton.addEventListener("click", async () => {
    if (activeMap) {
      activeMap.remove();
      activeMap = null;
    }

    appTitle.classList.remove("hidden");
    createPanel.classList.remove("hidden");
    await loadTrips();
  });

  const heading = makeElement("h1", trip.name);

  const destination = makeElement(
    "p",
    "Destination: " + (trip.destination || "Not specified")
  );

  const dates = makeElement(
    "p",
    (trip.start_date || "No start date") +
      " – " +
      (trip.end_date || "No end date")
  );

  const navigation = document.createElement("div");
  navigation.className = "workspace-navigation";

  const content = document.createElement("section");
  content.className = "workspace-content";

  const sections = {
    Overview: "Your trip overview and important travel information.",
    Itinerary: "Your daily schedule, activities, reservations, and plans.",
    Map: "Save and explore hotels, restaurants, attractions, and other places.",
    Documents: "Your flight confirmations, hotel reservations, and travel documents.",
    Budget: "Track your estimated trip costs and actual spending."
  };

  async function showSection(sectionName) {
    if (activeMap) {
      activeMap.remove();
      activeMap = null;
    }

    content.replaceChildren();

    const title = makeElement("h2", sectionName);
    content.appendChild(title);

    if (sectionName === "Overview") {
      content.appendChild(makeElement("p", sections.Overview));

      const summary = makeElement(
        "div",
        "",
        "map-empty"
      );

      summary.appendChild(
        makeElement("strong", "Your trip workspace")
      );

      summary.appendChild(
        makeElement(
          "p",
          "Use the tabs above to manage your itinerary, save places on your map, and organize your travel details."
        )
      );

      content.appendChild(summary);
      return;
    }

    if (sectionName === "Itinerary") {
      await showItinerary();
      return;
    }

    if (sectionName === "Map") {
      await showMap();
      return;
    }

    content.appendChild(makeElement("p", sections[sectionName]));
  }

  // The itinerary and map functions are added in the next sections.

  async function showItinerary() {
    const intro = makeElement(
      "p",
      "Plan your trip, one activity or reservation at a time."
    );
    content.appendChild(intro);

    const form = document.createElement("form");
    form.className = "panel";

    function addField(labelText, input) {
      const label = document.createElement("label");
      label.textContent = labelText;
      label.appendChild(input);
      input.style.display = "block";
      input.style.width = "100%";
      return label;
    }

    const type = document.createElement("select");

    [
      ["activity", "Activity"],
      ["flight", "Flight"],
      ["hotel", "Hotel"],
      ["restaurant", "Restaurant"],
      ["transportation", "Transportation"],
      ["event", "Event"],
      ["day_trip", "Day trip"]
    ].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      type.appendChild(option);
    });

    const name = document.createElement("input");
    name.type = "text";
    name.placeholder = "Example: Visit the Eiffel Tower";
    name.required = true;

    const start = document.createElement("input");
    start.type = "datetime-local";

    const end = document.createElement("input");
    end.type = "datetime-local";

    const location = document.createElement("input");
    location.type = "text";
    location.placeholder =
      "Example: Delta Airlines, Hotel name, or venue";

    const confirmationNumber = document.createElement("input");
    confirmationNumber.type = "text";
    confirmationNumber.placeholder = "Confirmation number";

    const bookingReference = document.createElement("input");
    bookingReference.type = "text";
    bookingReference.placeholder = "Booking reference";

    const address = document.createElement("input");
    address.type = "text";
    address.placeholder = "Full street address";

    const notes = document.createElement("textarea");
    notes.placeholder =
      "Additional details, check-in instructions, etc.";
    notes.rows = 3;

    const save = makeElement("button", "Add to itinerary");
    save.type = "submit";

    const cancelEdit = makeElement("button", "Cancel edit");
    cancelEdit.type = "button";
    cancelEdit.classList.add("hidden");

    const message = document.createElement("p");

    form.append(
      addField("Type of plan", type),
      addField("Name", name),
      addField("Start date and time", start),
      addField("End date and time", end),
      addField("Location or provider", location),
      addField("Confirmation number", confirmationNumber),
      addField("Booking reference", bookingReference),
      addField("Street address", address),
      addField("Notes", notes),
      save,
      cancelEdit,
      message
    );

    content.appendChild(form);

    const listTitle = makeElement("h3", "Your planned activities");
    content.appendChild(listTitle);

    let editingItemId = null;

    const list = document.createElement("div");
    content.appendChild(list);

    function resetEditor() {
      editingItemId = null;
      form.reset();
      save.textContent = "Add to itinerary";
      cancelEdit.classList.add("hidden");
      message.textContent = "";
    }

    cancelEdit.addEventListener("click", resetEditor);

    async function loadItems() {
      list.replaceChildren();

      const { data, error } = await db
        .from("itinerary_items")
        .select("*")
        .eq("trip_id", trip.id)
        .order("starts_at", { ascending: true });

      if (error) {
        list.textContent =
          "Unable to load itinerary: " + error.message;
        return;
      }

      if (!data || data.length === 0) {
        list.textContent = "No activities added yet.";
        return;
      }

      const groupedItems = {};

      data.forEach((item) => {
        const day = item.starts_at
          ? new Date(item.starts_at).toLocaleDateString([], {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric"
            })
          : "Date not specified";

        if (!groupedItems[day]) groupedItems[day] = [];
        groupedItems[day].push(item);
      });

      Object.entries(groupedItems).forEach(([day, items]) => {
        const dayHeading = makeElement("h2", day);
        list.appendChild(dayHeading);

        items.forEach((item) => {
          const card = document.createElement("div");
          card.className = "trip-card";

          const itemHeading = makeElement("h3", item.title);

          const category = makeElement(
            "p",
            item.item_type
              ? item.item_type.replaceAll("_", " ")
              : "Plan"
          );

          const date = makeElement("p", formatTimeRange(item));

          const place = makeElement("p", item.location || "");

          const addressLine = makeElement(
            "p",
            item.address ? "Address: " + item.address : ""
          );

          const reservationParts = [];

          if (item.confirmation_number) {
            reservationParts.push(
              "Confirmation: " + item.confirmation_number
            );
          }

          if (item.booking_reference) {
            reservationParts.push(
              "Booking reference: " + item.booking_reference
            );
          }

          const reservationDetails = makeElement(
            "p",
            reservationParts.join(" | ")
          );

          const detail = makeElement("p", item.notes || "");

          const editButton = makeElement("button", "Edit");

          editButton.addEventListener("click", () => {
            editingItemId = item.id;

            type.value = item.item_type || "activity";
            name.value = item.title || "";
            start.value = formatDateTimeForInput(item.starts_at);
            end.value = formatDateTimeForInput(item.ends_at);
            location.value = item.location || "";
            confirmationNumber.value =
              item.confirmation_number || "";
            bookingReference.value =
              item.booking_reference || "";
            address.value = item.address || "";
            notes.value = item.notes || "";

            save.textContent = "Save changes";
            cancelEdit.classList.remove("hidden");
            message.textContent = "Editing: " + item.title;

            form.scrollIntoView({
              behavior: "smooth",
              block: "start"
            });
          });

          const deleteButton = makeElement("button", "Delete");

          deleteButton.addEventListener("click", async () => {
            if (!confirm("Delete this itinerary item?")) return;

            const { error: deleteError } = await db
              .from("itinerary_items")
              .delete()
              .eq("id", item.id)
              .eq("trip_id", trip.id);

            if (deleteError) {
              message.textContent =
                "Could not delete: " + deleteError.message;
              return;
            }

            if (editingItemId === item.id) resetEditor();

            message.textContent = "Activity deleted.";
            await loadItems();
          });

          card.append(itemHeading, category, date);

          if (place.textContent) card.appendChild(place);
          if (addressLine.textContent) {
            card.appendChild(addressLine);
          }
          if (reservationDetails.textContent) {
            card.appendChild(reservationDetails);
          }
          if (detail.textContent) card.appendChild(detail);

          card.append(editButton, deleteButton);
          list.appendChild(card);
        });
      });
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!currentUser) {
        message.textContent =
          "Please sign in to add itinerary items.";
        return;
      }

      if (start.value && end.value && end.value < start.value) {
        message.textContent =
          "The end time must be after the start time.";
        return;
      }

      save.disabled = true;
      cancelEdit.disabled = true;
      message.textContent = "Saving...";

      const itemData = {
        trip_id: trip.id,
        item_type: type.value,
        title: name.value.trim(),
        starts_at: start.value
          ? new Date(start.value).toISOString()
          : null,
        ends_at: end.value
          ? new Date(end.value).toISOString()
          : null,
        location: location.value.trim() || null,
        confirmation_number:
          confirmationNumber.value.trim() || null,
        booking_reference:
          bookingReference.value.trim() || null,
        address: address.value.trim() || null,
        notes: notes.value.trim() || null,
        created_by: currentUser.id
      };

      let result;

      if (editingItemId) {
        result = await db
          .from("itinerary_items")
          .update(itemData)
          .eq("id", editingItemId)
          .eq("trip_id", trip.id);
      } else {
        result = await db
          .from("itinerary_items")
          .insert(itemData);
      }

      save.disabled = false;
      cancelEdit.disabled = false;

      if (result.error) {
        message.textContent =
          "Could not save: " + result.error.message;
        return;
      }

      resetEditor();
      message.textContent = "Itinerary saved successfully!";
      await loadItems();
    });

    await loadItems();
  }

  async function showMap() {
    const intro = makeElement(
      "p",
      "Save restaurants, hotels, attractions, and other places you want to visit. Your saved places will appear on the map."
    );
    content.appendChild(intro);

    if (!window.L) {
      content.appendChild(
        makeElement(
          "p",
          "The map library did not load. Please refresh the page and try again."
        )
      );
      return;
    }

    const mapElement = document.createElement("div");
    mapElement.id = "trip-map";
    content.appendChild(mapElement);

    const form = document.createElement("form");
    form.className = "map-form";

    const formTitle = makeElement("h3", "Add a place");

    function addMapField(labelText, input) {
      const label = document.createElement("label");
      label.textContent = labelText;
      label.appendChild(input);
      return label;
    }

    const placeName = document.createElement("input");
    placeName.type = "text";
    placeName.placeholder = "Example: Sagrada Familia";
    placeName.required = true;

    const category = document.createElement("select");

    [
      ["restaurant", "Restaurant"],
      ["attraction", "Attraction"],
      ["hotel", "Hotel"],
      ["transportation", "Transportation"],
      ["shopping", "Shopping"],
      ["event", "Event"],
      ["other", "Other"]
    ].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      category.appendChild(option);
    });

    const placeAddress = document.createElement("input");
    placeAddress.type = "text";
    placeAddress.placeholder = "Street address or city";

    const website = document.createElement("input");
    website.type = "url";
    website.placeholder = "https://example.com";

    const placeNotes = document.createElement("textarea");
    placeNotes.placeholder = "Why you want to visit or other details";
    placeNotes.rows = 3;

    const favoriteLabel = document.createElement("label");
    const favorite = document.createElement("input");
    favorite.type = "checkbox";
    favoriteLabel.append(favorite, document.createTextNode(" Mark as favorite"));

    const savePlace = makeElement("button", "Save place");
    savePlace.type = "submit";

    const mapMessage = document.createElement("p");

    form.append(
      formTitle,
      addMapField("Place name", placeName),
      addMapField("Category", category),
      addMapField("Address", placeAddress),
      addMapField("Website (optional)", website),
      addMapField("Notes (optional)", placeNotes),
      favoriteLabel,
      savePlace,
      mapMessage
    );

    content.appendChild(form);

    const help = makeElement(
      "p",
      "Tip: Enter an address to place the location accurately on the map. Address lookup happens when you save, not while you type.",
      "map-help"
    );
    content.appendChild(help);

    const listHeading = makeElement("h3", "Saved places");
    content.appendChild(listHeading);

    const placesList = document.createElement("div");
    content.appendChild(placesList);

    let editingPlaceId = null;

    async function findCoordinates(addressText) {
      const query = addressText.trim();

      if (!query) return null;

      const url =
        "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" +
        encodeURIComponent(query);

      const response = await fetch(url, {
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error("Address lookup is temporarily unavailable.");
      }

      const results = await response.json();

      if (!results.length) return null;

      return {
        latitude: Number(results[0].lat),
        longitude: Number(results[0].lon)
      };
    }

    function directionsUrl(place) {
      const destinationText =
        place.address ||
        (
          place.latitude !== null &&
          place.latitude !== undefined &&
          place.longitude !== null &&
          place.longitude !== undefined
            ? `${place.latitude},${place.longitude}`
            : place.name
        );

      return (
        "https://maps.apple.com/?daddr=" +
        encodeURIComponent(destinationText)
      );
    }

    function openDirections(place) {
      window.open(directionsUrl(place), "_blank");
    }

    function resetPlaceForm() {
      editingPlaceId = null;
      form.reset();
      formTitle.textContent = "Add a place";
      savePlace.textContent = "Save place";
      mapMessage.textContent = "";

      const cancel = form.querySelector(".cancel-place-edit");
      if (cancel) cancel.remove();
    }

    function cancelPlaceEdit() {
      resetPlaceForm();
    }

    function beginPlaceEdit(place) {
      editingPlaceId = place.id;

      placeName.value = place.name || "";
      category.value = place.category || "other";
      placeAddress.value = place.address || "";
      website.value = place.website_url || "";
      placeNotes.value = place.notes || "";
      favorite.checked = Boolean(place.is_favorite);

      formTitle.textContent = "Edit place";
      savePlace.textContent = "Save changes";
      mapMessage.textContent = "Editing: " + place.name;

      let cancelButton = form.querySelector(".cancel-place-edit");

      if (!cancelButton) {
        cancelButton = makeElement("button", "Cancel edit");
        cancelButton.type = "button";
        cancelButton.className = "secondary-button cancel-place-edit";
        cancelButton.addEventListener("click", cancelPlaceEdit);
        form.appendChild(cancelButton);
      }

      form.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

    async function savePlaceRecord() {
      if (!currentUser) {
        mapMessage.textContent = "Please sign in to save places.";
        return;
      }

      const nameValue = placeName.value.trim();
      const addressValue = placeAddress.value.trim();

      if (!nameValue) {
        mapMessage.textContent = "Enter a place name.";
        return;
      }

      savePlace.disabled = true;
      mapMessage.textContent = "Saving place...";

      let coordinates = null;

      if (addressValue) {
        try {
          coordinates = await findCoordinates(addressValue);
        } catch (error) {
          savePlace.disabled = false;
          mapMessage.textContent = error.message;
          return;
        }

        if (!coordinates) {
          savePlace.disabled = false;
          mapMessage.textContent =
            "We couldn't find that address. Check the address and try again.";
          return;
        }
      }

      const placeData = {
        trip_id: trip.id,
        name: nameValue,
        category: category.value,
        address: addressValue || null,
        latitude: coordinates
          ? coordinates.latitude
          : null,
        longitude: coordinates
          ? coordinates.longitude
          : null,
        notes: placeNotes.value.trim() || null,
        website_url: website.value.trim() || null,
        is_favorite: favorite.checked,
        source: "manual",
        created_by: currentUser.id
      };

      let result;

      if (editingPlaceId) {
        result = await db
          .from("trip_places")
          .update(placeData)
          .eq("id", editingPlaceId)
          .eq("trip_id", trip.id);
      } else {
        result = await db
          .from("trip_places")
          .insert(placeData);
      }

      savePlace.disabled = false;

      if (result.error) {
        mapMessage.textContent =
          "Could not save place: " + result.error.message;
        return;
      }

      resetPlaceForm();
      mapMessage.textContent = "Place saved successfully!";
      await loadPlaces();
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await savePlaceRecord();
    });

    // Place loading and map rendering are added in Part 4.

    async function loadPlaces() {
      placesList.replaceChildren();

      mapMarkers.forEach((marker) => marker.remove());
      mapMarkers = [];

      const { data, error } = await db
        .from("trip_places")
        .select("*")
        .eq("trip_id", trip.id)
        .order("created_at", { ascending: false });

      if (error) {
        placesList.textContent =
          "Unable to load saved places: " + error.message;
        return;
      }

      if (!data || data.length === 0) {
        placesList.appendChild(
          makeElement(
            "div",
            "No places saved yet. Add your first place above!",
            "map-empty"
          )
        );
        return;
      }

      const validPlaces = [];

      data.forEach((place) => {
        const hasCoordinates =
          Number.isFinite(Number(place.latitude)) &&
          Number.isFinite(Number(place.longitude)) &&
          place.latitude !== null &&
          place.longitude !== null;

        if (hasCoordinates) {
          const marker = L.marker([
            Number(place.latitude),
            Number(place.longitude)
          ]).addTo(activeMap);

          const popup = document.createElement("div");
          const popupHeading = makeElement("strong", place.name);
          const popupCategory = makeElement(
            "p",
            place.category.replaceAll("_", " ")
          );

          popup.append(popupHeading, popupCategory);

          if (place.address) {
            popup.appendChild(makeElement("p", place.address));
          }

          if (place.notes) {
            popup.appendChild(makeElement("p", place.notes));
          }

          const directionsLink = makeElement(
            "a",
            "Get directions"
          );
          directionsLink.href = directionsUrl(place);
          directionsLink.target = "_blank";
          directionsLink.rel = "noopener noreferrer";

          popup.appendChild(directionsLink);

          marker.bindPopup(popup);
          mapMarkers.push(marker);
          validPlaces.push(marker);
        }

        const card = document.createElement("article");
        card.className = "map-place-card";

        const cardHeading = makeElement("h3", place.name);

        if (place.is_favorite) {
          cardHeading.appendChild(
            makeElement("span", " ★", "map-favorite")
          );
        }

        const categoryText = makeElement(
          "p",
          "Category: " + place.category.replaceAll("_", " ")
        );

        card.append(cardHeading, categoryText);

        if (place.address) {
          card.appendChild(
            makeElement("p", "Address: " + place.address)
          );
        }

        if (place.notes) {
          card.appendChild(
            makeElement("p", place.notes)
          );
        }

        if (place.website_url) {
          try {
            const websiteUrl = new URL(place.website_url);

            if (
              websiteUrl.protocol === "https:" ||
              websiteUrl.protocol === "http:"
            ) {
              const websiteLink = makeElement(
                "a",
                "Visit website"
              );
              websiteLink.href = websiteUrl.href;
              websiteLink.target = "_blank";
              websiteLink.rel = "noopener noreferrer";
              card.appendChild(websiteLink);
            }
          } catch (error) {
            // Ignore invalid website addresses.
          }
        }

        const actions = document.createElement("div");
        actions.className = "map-place-actions";

        const directionsButton = makeElement(
          "button",
          "Directions"
        );

        directionsButton.addEventListener("click", () => {
          openDirections(place);
        });

        const favoriteButton = makeElement(
          "button",
          place.is_favorite ? "★ Unfavorite" : "☆ Favorite",
          "secondary-button"
        );

        favoriteButton.addEventListener("click", async () => {
          favoriteButton.disabled = true;

          const { error: favoriteError } = await db
            .from("trip_places")
            .update({
              is_favorite: !place.is_favorite
            })
            .eq("id", place.id)
            .eq("trip_id", trip.id);

          if (favoriteError) {
            favoriteButton.disabled = false;
            alert(
              "Could not update favorite: " +
              favoriteError.message
            );
            return;
          }

          await loadPlaces();
        });

        const editButton = makeElement(
          "button",
          "Edit",
          "secondary-button"
        );

        editButton.addEventListener("click", () => {
          beginPlaceEdit(place);
        });

        const deleteButton = makeElement(
          "button",
          "Delete",
          "delete-button"
        );

        deleteButton.addEventListener("click", async () => {
          if (!confirm(`Delete "${place.name}" from this map?`)) {
            return;
          }

          deleteButton.disabled = true;

          const { error: deleteError } = await db
            .from("trip_places")
            .delete()
            .eq("id", place.id)
            .eq("trip_id", trip.id);

          if (deleteError) {
            deleteButton.disabled = false;
            alert(
              "Could not delete place: " +
              deleteError.message
            );
            return;
          }

          if (editingPlaceId === place.id) {
            resetPlaceForm();
          }

          mapMessage.textContent = "Place deleted.";
          await loadPlaces();
        });

        actions.append(
          directionsButton,
          favoriteButton,
          editButton,
          deleteButton
        );

        card.appendChild(actions);
        placesList.appendChild(card);
      });

      if (validPlaces.length > 0) {
        const group = L.featureGroup(validPlaces);
        activeMap.fitBounds(group.getBounds(), {
          padding: [35, 35],
          maxZoom: 15
        });
      }
    }

    activeMap = L.map(mapElement).setView([20, 0], 2);

    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }
    ).addTo(activeMap);

    await loadPlaces();

    requestAnimationFrame(() => {
      if (activeMap) activeMap.invalidateSize();
    });
  }
  
  // Build the trip workspace navigation.
  Object.keys(sections).forEach((sectionName) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = sectionName;

    button.addEventListener("click", () => {
      showSection(sectionName);
    });

    navigation.appendChild(button);
  });

  await showSection("Overview");

  workspace.append(
    backButton,
    heading,
    destination,
    dates,
    navigation,
    content
  );

  tripsContainer.appendChild(workspace);
}

async function createTrip() {
  const name = document.getElementById("tripname").value.trim();
  const destination = document.getElementById("destination").value.trim();
  const startDate = document.getElementById("startdate").value;
  const endDate = document.getElementById("enddate").value;

  if (!name) {
    showMessage("tripmsg", "Please enter a trip name.");
    return;
  }

  if (startDate && endDate && endDate < startDate) {
    showMessage(
      "tripmsg",
      "The end date must be after the start date."
    );
    return;
  }

  showMessage("tripmsg", "Creating your trip...");

  const { error } = await db
    .from("trips")
    .insert({
      name,
      destination: destination || null,
      start_date: startDate || null,
      end_date: endDate || null,
      owner_id: currentUser.id
    });

  if (error) {
    showMessage(
      "tripmsg",
      "Could not create trip: " + error.message
    );
    return;
  }

  document.getElementById("tripname").value = "";
  document.getElementById("destination").value = "";
  document.getElementById("startdate").value = "";
  document.getElementById("enddate").value = "";

  showMessage("tripmsg", "Trip created!");
  await loadTrips();
}

async function resetPassword() {
  const email = document.getElementById("email").value.trim();

  if (!email) {
    showMessage("authmsg", "Enter your email address first.");
    return;
  }

  showMessage("authmsg", "Sending password reset email...");

  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: "https://tylerdetmer.github.io/travel-hub/"
  });

  if (error) {
    showMessage("authmsg", error.message);
    return;
  }

  showMessage(
    "authmsg",
    "Password reset email sent! Check your inbox."
  );
}

async function saveNewPassword() {
  const password = document.getElementById("newpassword").value;

  if (password.length < 8) {
    showMessage(
      "resetmsg",
      "Password must be at least 8 characters."
    );
    return;
  }

  showMessage("resetmsg", "Updating password...");

  const { error } = await db.auth.updateUser({ password });

  if (error) {
    showMessage("resetmsg", error.message);
    return;
  }

  isPasswordRecovery = false;

  document
    .getElementById("password-reset-panel")
    .classList.add("hidden");

  showMessage("authmsg", "Password updated successfully!");

  if (currentUser) {
    showScreen("app");
    await loadTrips();
  }
}

async function signIn() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  showMessage("authmsg", "Signing in...");

  const { error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) showMessage("authmsg", error.message);
}

async function signUp() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    showMessage("authmsg", "Enter an email and password.");
    return;
  }

  if (password.length < 8) {
    showMessage(
      "authmsg",
      "Use a password with at least 8 characters."
    );
    return;
  }

  showMessage("authmsg", "Creating your account...");

  const { data, error } = await db.auth.signUp({
    email,
    password
  });

  if (error) {
    showMessage("authmsg", error.message);
    return;
  }

  if (!data.session) {
    showMessage(
      "authmsg",
      "Account created! Check your email for a confirmation link, then return here to sign in."
    );
  }
}

async function signOut() {
  const { error } = await db.auth.signOut();

  if (error) showStatus(error.message);
}

async function startApp() {
  if (
    !config ||
    !config.supabaseUrl ||
    !config.supabasePublishableKey ||
    config.supabaseUrl.includes("PASTE_") ||
    config.supabasePublishableKey.includes("PASTE_")
  ) {
    showScreen("setup");
    showStatus("Configuration needed");
    return;
  }

  if (!window.supabase) {
    showScreen("setup");
    showStatus("Supabase library did not load");
    return;
  }

  isPasswordRecovery =
    window.location.hash.includes("type=recovery") ||
    new URLSearchParams(window.location.search).get("type") === "recovery";

  db = window.supabase.createClient(
    config.supabaseUrl,
    config.supabasePublishableKey
  );

  document.getElementById("signin").addEventListener("click", signIn);
  document.getElementById("signup").addEventListener("click", signUp);
  document
    .getElementById("resetpassword")
    .addEventListener("click", resetPassword);
  document
    .getElementById("savepassword")
    .addEventListener("click", saveNewPassword);
  document.getElementById("create").addEventListener("click", createTrip);
  document.getElementById("signout").addEventListener("click", signOut);

  db.auth.onAuthStateChange(async (event, session) => {
    currentUser = session?.user || null;

    if (event === "PASSWORD_RECOVERY") {
      isPasswordRecovery = true;
    }

    if (isPasswordRecovery) {
      showScreen("auth");
      document
        .getElementById("password-reset-panel")
        .classList.remove("hidden");

      showMessage("authmsg", "Enter your new password below.");
      return;
    }

    if (currentUser) {
      showScreen("app");
      await loadTrips();
    } else {
      showScreen("auth");
      showStatus("Please sign in");
    }
  });

  const { data, error } = await db.auth.getSession();

  if (error) {
    showScreen("auth");
    showMessage("authmsg", error.message);
    return;
  }

  currentUser = data.session?.user || null;

  if (isPasswordRecovery) {
    showScreen("auth");
    document
      .getElementById("password-reset-panel")
      .classList.remove("hidden");

    showMessage("authmsg", "Enter your new password below.");
    return;
  }

  if (currentUser) {
    showScreen("app");
    await loadTrips();
  } else {
    showScreen("auth");
    showStatus("Please sign in");
  }
}

startApp().catch((error) => {
  console.error("Travel Hub startup error:", error);
  showScreen("setup");
  showStatus(
    "Startup error: " + (error?.message || "Unknown error")
  );
});

