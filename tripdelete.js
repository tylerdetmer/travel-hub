(function () {
  const RESUME_KEY = "travelhub-resume";

  function addDelete(trip) {
    if (!currentUser || trip.owner_id !== currentUser.id) return;

    const workspace = document.querySelector("#trips > .panel");
    if (!workspace || workspace.querySelector(".trip-delete-button")) return;

    const nav = workspace.querySelector(".workspace-navigation");
    if (!nav) return;

    const deleteButton = makeElement("button", "Delete trip", "delete-button trip-delete-button");
    deleteButton.type = "button";

    const status = document.createElement("p");

    deleteButton.addEventListener("click", async () => {
      const answer = prompt(
        "This permanently deletes “" + trip.name + "” and everything in it: plans, places, documents, photos, packing list, and budget.\n\nTo confirm, type the trip name:"
      );
      if (answer === null) return;

      if (answer.trim().toLowerCase() !== (trip.name || "").trim().toLowerCase()) {
        status.textContent = "The name didn’t match, so nothing was deleted.";
        return;
      }

      deleteButton.disabled = true;
      status.textContent = "Deleting...";

      try {
        const [docs, photos] = await Promise.all([
          db.from("trip_documents").select("storage_path").eq("trip_id", trip.id),
          db.from("trip_photos").select("storage_path,thumb_path").eq("trip_id", trip.id)
        ]);

        const docPaths = (docs.data || []).map((d) => d.storage_path).filter(Boolean);
        const photoPaths = [];
        (photos.data || []).forEach((p) => {
          if (p.storage_path) photoPaths.push(p.storage_path);
          if (p.thumb_path) photoPaths.push(p.thumb_path);
        });

        if (docPaths.length) await db.storage.from("trip-documents").remove(docPaths);
        if (photoPaths.length) await db.storage.from("trip-photos").remove(photoPaths);

        const { error } = await db.from("trips").delete().eq("id", trip.id);
        if (error) throw error;

        const { data: still } = await db
          .from("trips")
          .select("id")
          .eq("id", trip.id)
          .maybeSingle();
        if (still) throw new Error("You don’t have permission to delete this trip.");

        try {
          localStorage.removeItem(RESUME_KEY);
        } catch (e) {}

        const back = document.querySelector("#trips > .panel > button:first-child");
        if (back) back.click();
        else location.reload();
      } catch (e) {
        deleteButton.disabled = false;
        status.textContent = "Could not delete: " + ((e && e.message) || e);
      }
    });

    const editButton = workspace.querySelector(".trip-edit-button");
    if (editButton) editButton.after(deleteButton);
    else workspace.insertBefore(deleteButton, nav);
    workspace.insertBefore(status, nav);
  }

  const originalOpenTrip = window.openTrip;
  if (typeof originalOpenTrip === "function") {
    window.openTrip = async function (trip) {
      const result = await originalOpenTrip.apply(this, arguments);
      try {
        addDelete(trip);
      } catch (e) {}
      return result;
    };
  }
})();
