const config = window.TRAVEL_HUB_CONFIG;

const statusEl = document.getElementById("status");
const setupSection = document.getElementById("setup");
const authSection = document.getElementById("auth");
const appSection = document.getElementById("app");

let db;
let currentUser = null;
let isPasswordRecovery = false;

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
    tripsContainer.textContent = "No trips yet. Create your first trip above!";
    return;
  }

  data.forEach((trip) => {
    const card = document.createElement("section");
    card.className = "trip-card";

    const heading = document.createElement("h2");
    heading.textContent = trip.name;

    const destination = document.createElement("p");
    destination.textContent = trip.destination || "Destination not added";

    const dates = document.createElement("p");
    dates.textContent =
      `${trip.start_date || "Date not set"} – ${trip.end_date || "Date not set"}`;

    const openButton = document.createElement("button");
    openButton.textContent = "Open trip";
    openButton.addEventListener("click", () => openTrip(trip));

    card.append(heading, destination, dates, openButton);
    tripsContainer.appendChild(card);
  });

  showStatus("Ready");
}

async function openTrip(trip) {
  const appTitle = document.querySelector("#app > h1");
  const createPanel = document.querySelector("#app > .panel");
  const tripsContainer = document.getElementById("trips");

  appTitle.classList.add("hidden");
  createPanel.classList.add("hidden");
  tripsContainer.replaceChildren();

  const workspace = document.createElement("section");
  workspace.className = "panel";

  const backButton = document.createElement("button");
  backButton.textContent = "← Back to trips";

  backButton.addEventListener("click", async () => {
    appTitle.classList.remove("hidden");
    createPanel.classList.remove("hidden");
    await loadTrips();
  });

  const heading = document.createElement("h1");
  heading.textContent = trip.name;

  const destination = document.createElement("p");
  destination.textContent =
    "Destination: " + (trip.destination || "Not specified");

  const dates = document.createElement("p");
  dates.textContent =
    (trip.start_date || "No start date") +
    " – " +
    (trip.end_date || "No end date");

  const navigation = document.createElement("div");
  navigation.className = "workspace-navigation";

  const content = document.createElement("section");
  content.className = "workspace-content";

  const sections = {
    Overview: "Your trip overview and important travel information.",
    Itinerary: "Your daily schedule, activities, reservations, and plans will appear here.",
    Map: "Your hotels, restaurants, attractions, and saved locations will appear here.",
    Documents: "Your flight confirmations, hotel reservations, and travel documents will appear here.",
    Budget: "Track your estimated trip costs and actual spending here."
  };
    async function showSection(sectionName) {
    content.replaceChildren();

    const title = document.createElement("h2");
    title.textContent = sectionName;
    content.appendChild(title);

    if (sectionName !== "Itinerary") {
      const text = document.createElement("p");
      text.textContent = sections[sectionName];
      content.appendChild(text);
      return;
    }

    const intro = document.createElement("p");
    intro.textContent =
      "Plan your trip, one activity or reservation at a time.";
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

    const save = document.createElement("button");
    save.type = "submit";
    save.textContent = "Add to itinerary";

    const cancelEdit = document.createElement("button");
    cancelEdit.type = "button";
    cancelEdit.textContent = "Cancel edit";
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

    const listTitle = document.createElement("h3");
    listTitle.textContent = "Your planned activities";
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
        list.textContent = "Unable to load itinerary: " + error.message;
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
        const dayHeading = document.createElement("h2");
        dayHeading.textContent = day;
        list.appendChild(dayHeading);

        items.forEach((item) => {
          const card = document.createElement("div");
          card.className = "trip-card";

          const itemHeading = document.createElement("h3");
          itemHeading.textContent = item.title;

          const category = document.createElement("p");
          category.textContent = item.item_type
            ? item.item_type.replaceAll("_", " ")
            : "Plan";

          const date = document.createElement("p");
          date.textContent = formatTimeRange(item);

          const place = document.createElement("p");
          place.textContent = item.location || "";

          const addressLine = document.createElement("p");
          addressLine.textContent = item.address
            ? "Address: " + item.address
            : "";

          const reservationDetails = document.createElement("p");
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

          reservationDetails.textContent = reservationParts.join(" | ");

          const detail = document.createElement("p");
          detail.textContent = item.notes || "";

          const editButton = document.createElement("button");
          editButton.textContent = "Edit";

          editButton.addEventListener("click", () => {
            editingItemId = item.id;

            type.value = item.item_type || "activity";
            name.value = item.title || "";
            start.value = formatDateTimeForInput(item.starts_at);
            end.value = formatDateTimeForInput(item.ends_at);
            location.value = item.location || "";
            confirmationNumber.value = item.confirmation_number || "";
            bookingReference.value = item.booking_reference || "";
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

          const deleteButton = document.createElement("button");
          deleteButton.textContent = "Delete";

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
          if (addressLine.textContent) card.appendChild(addressLine);
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
        message.textContent = "Please sign in to add itinerary items.";
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
    showMessage("tripmsg", "The end date must be after the start date.");
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
    showMessage("tripmsg", "Could not create trip: " + error.message);
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
    showMessage("resetmsg", "Password must be at least 8 characters.");
    return;
  }

  showMessage("resetmsg", "Updating password...");

  const { error } = await db.auth.updateUser({ password });

  if (error) {
    showMessage("resetmsg", error.message);
    return;
  }

  isPasswordRecovery = false;

  document.getElementById("password-reset-panel").classList.add("hidden");
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
    showMessage("authmsg", "Use a password with at least 8 characters.");
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
  document.getElementById("resetpassword").addEventListener("click", resetPassword);
  document.getElementById("savepassword").addEventListener("click", saveNewPassword);
  document.getElementById("create").addEventListener("click", createTrip);
  document.getElementById("signout").addEventListener("click", signOut);

  db.auth.onAuthStateChange(async (event, session) => {
    currentUser = session?.user || null;

    if (event === "PASSWORD_RECOVERY") {
      isPasswordRecovery = true;
    }

    if (isPasswordRecovery) {
      showScreen("auth");
      document.getElementById("password-reset-panel").classList.remove("hidden");
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
    document.getElementById("password-reset-panel").classList.remove("hidden");
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
  showStatus("Startup error: " + (error?.message || "Unknown error"));
});
