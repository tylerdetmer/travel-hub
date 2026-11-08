(function () {
  async function canEditTrip(trip) {
    if (!currentUser) return false;
    if (trip.owner_id === currentUser.id) return true;

    const { data } = await db
      .from("trip_members")
      .select("role")
      .eq("trip_id", trip.id)
      .eq("user_id", currentUser.id)
      .eq("status", "accepted")
      .maybeSingle();

    return Boolean(data) && (data.role === "owner" || data.role === "editor");
  }

  function field(labelText, input) {
    const label = document.createElement("label");
    label.textContent = labelText;
    label.appendChild(input);
    input.style.display = "block";
    input.style.width = "100%";
    return label;
  }

  async function addEditor(trip) {
    const workspace = document.querySelector("#trips > .panel");
    if (!workspace) return;

    const nav = workspace.querySelector(".workspace-navigation");
    const heading = workspace.querySelector("h1");
    const paragraphs = [...workspace.children].filter((el) => el.tagName === "P");
    if (!nav || !heading || paragraphs.length < 2) return;

    if (!(await canEditTrip(trip))) return;
    if (!workspace.isConnected || workspace.querySelector(".trip-edit-button")) return;

    const destinationLine = paragraphs[0];
    const datesLine = paragraphs[1];

    const editButton = makeElement("button", "Edit trip details", "secondary-button trip-edit-button");
    editButton.type = "button";

    const status = document.createElement("p");

    const form = document.createElement("form");
    form.className = "panel hidden";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.required = true;
    nameInput.placeholder = "Trip name";

    const destinationInput = document.createElement("input");
    destinationInput.type = "text";
    destinationInput.placeholder = "Destination";

    const startInput = document.createElement("input");
    startInput.type = "date";

    const endInput = document.createElement("input");
    endInput.type = "date";

    const saveButton = makeElement("button", "Save changes");
    saveButton.type = "submit";

    const cancelButton = makeElement("button", "Cancel", "secondary-button");
    cancelButton.type = "button";

    const message = document.createElement("p");

    form.append(
      makeElement("h3", "Edit trip details"),
      field("Trip name", nameInput),
      field("Destination", destinationInput),
      field("Start date", startInput),
      field("End date", endInput),
      saveButton,
      cancelButton,
      message
    );

    function fillForm() {
      nameInput.value = trip.name || "";
      destinationInput.value = trip.destination || "";
      startInput.value = trip.start_date || "";
      endInput.value = trip.end_date || "";
      message.textContent = "";
    }

    editButton.addEventListener("click", () => {
      const opening = form.classList.contains("hidden");
      if (opening) fillForm();
      form.classList.toggle("hidden", !opening);
      status.textContent = "";
    });

    cancelButton.addEventListener("click", () => form.classList.add("hidden"));

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const name = nameInput.value.trim();
      const destination = destinationInput.value.trim();
      const start = startInput.value;
      const end = endInput.value;

      if (!name) {
        message.textContent = "Please enter a trip name.";
        return;
      }
      if (start && end && end < start) {
        message.textContent = "The end date must be after the start date.";
        return;
      }

      saveButton.disabled = true;
      message.textContent = "Saving...";

      const { data, error } = await db
        .from("trips")
        .update({
          name: name,
          destination: destination || null,
          start_date: start || null,
          end_date: end || null
        })
        .eq("id", trip.id)
        .select();

      saveButton.disabled = false;

      if (error) {
        message.textContent = "Could not save: " + error.message;
        return;
      }
      if (!data || data.length === 0) {
        message.textContent = "You don’t have permission to edit this trip.";
        return;
      }

      Object.assign(trip, data[0]);

      heading.textContent = trip.name;
      destinationLine.textContent = "Destination: " + (trip.destination || "Not specified");
      datesLine.textContent =
        (trip.start_date || "No start date") + " – " + (trip.end_date || "No end date");

      form.classList.add("hidden");
      status.textContent = "Trip details updated.";
      setTimeout(() => {
        status.textContent = "";
      }, 4000);

      // Refresh the open tab so countdown, weather, and other details use the new info
      const activeTab = workspace.querySelector(".workspace-navigation button.on");
      if (activeTab) activeTab.click();
    });

    workspace.insertBefore(editButton, nav);
    workspace.insertBefore(status, nav);
    workspace.insertBefore(form, nav);
  }

  const originalOpenTrip = window.openTrip;
  if (typeof originalOpenTrip === "function") {
    window.openTrip = async function (trip) {
      const result = await originalOpenTrip.apply(this, arguments);
      try {
        await addEditor(trip);
      } catch (e) {}
      return result;
    };
  }
})();
