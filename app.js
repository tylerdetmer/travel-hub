
const config = window.TRAVEL_HUB_CONFIG;

const statusEl = document.getElementById("status");
const setupSection = document.getElementById("setup");
const authSection = document.getElementById("auth");
const appSection = document.getElementById("app");

let db;
let currentUser = null;

function showMessage(elementId, message) {
  document.getElementById(elementId).textContent = message;
}

function showStatus(message) {
  statusEl.textContent = message;
}

function showScreen(screen) {
  setupSection.classList.add("hidden");
  authSection.classList.add("hidden");
  appSection.classList.add("hidden");

  if (screen === "setup") setupSection.classList.remove("hidden");
  if (screen === "auth") authSection.classList.remove("hidden");
  if (screen === "app") appSection.classList.remove("hidden");
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
  destination.textContent = "Destination: " +
    (trip.destination || "Not specified");

  const dates = document.createElement("p");
  dates.textContent =
    (trip.start_date || "No start date") +
    " – " +
    (trip.end_date || "No end date");

  const overview = document.createElement("h2");
  overview.textContent = "Trip Overview";

  const description = document.createElement("p");
  description.textContent =
    "Your trip workspace is ready. We'll build your itinerary, maps, reservations, documents, and budget here.";

  workspace.append(
    backButton,
    heading,
    destination,
    dates,
    overview,
    description
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

  const { error } = await db.auth.updateUser({
    password: password
  });

  if (error) {
    showMessage("resetmsg", error.message);
    return;
  }

  document.getElementById("password-reset-panel").classList.add("hidden");
  showMessage("authmsg", "Password updated successfully!");
}

async function signIn() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  showMessage("authmsg", "Signing in...");

  const { error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showMessage("authmsg", error.message);
  }
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

  if (error) {
    showStatus(error.message);
  }
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

  const { data, error } = await db.auth.getSession();

  if (error) {
    showScreen("auth");
    showMessage("authmsg", error.message);
    return;
  }

  currentUser = data.session?.user || null;

  if (currentUser) {
    showScreen("app");
    await loadTrips();
  } else {
    showScreen("auth");
    showStatus("Please sign in");
  }

  
db.auth.onAuthStateChange(async (event, session) => {
  currentUser = session?.user || null;

  if (event === "PASSWORD_RECOVERY") {
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

}

startApp();
