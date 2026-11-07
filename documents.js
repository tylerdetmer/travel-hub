const DOC_CATEGORIES = [
  ["flight", "Flights"],
  ["hotel", "Hotels"],
  ["rental_car", "Rental cars"],
  ["tickets", "Tickets & activities"],
  ["insurance", "Insurance"],
  ["other", "Other"]
];

const DOC_MAX_BYTES = 10 * 1024 * 1024;

function docSizeText(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

async function openTripDocument(doc, asDownload) {
  const tab = asDownload ? null : window.open("", "_blank");

  const { data, error } = await db.storage
    .from("trip-documents")
    .createSignedUrl(
      doc.storage_path,
      300,
      asDownload ? { download: doc.file_name } : undefined
    );

  if (error || !data) {
    if (tab) tab.close();
    alert("Could not open file: " + (error ? error.message : "Unknown error"));
    return;
  }

  if (tab) {
    tab.location.href = data.signedUrl;
  } else {
    window.location.href = data.signedUrl;
  }
}

async function showDocuments(content, trip) {
  content.appendChild(
    makeElement(
      "p",
      "Save flight confirmations, hotel reservations, tickets, and other travel documents. PDFs and photos up to 10 MB."
    )
  );

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

  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.placeholder = "Example: Delta flight confirmation";
  titleInput.required = true;

  const categorySelect = document.createElement("select");
  DOC_CATEGORIES.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    categorySelect.appendChild(option);
  });

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept =
    "application/pdf,image/jpeg,image/png,image/heic,image/heif,image/webp";
  fileInput.required = true;

  const uploadButton = makeElement("button", "Upload document");
  uploadButton.type = "submit";

  const message = document.createElement("p");

  form.append(
    makeElement("h3", "Add a document"),
    addField("Title", titleInput),
    addField("Category", categorySelect),
    addField("File", fileInput),
    uploadButton,
    message
  );

  content.appendChild(form);
  content.appendChild(makeElement("h3", "Saved documents"));

  const list = document.createElement("div");
  content.appendChild(list);

  async function loadDocuments() {
    list.replaceChildren();

    const { data, error } = await db
      .from("trip_documents")
      .select("*")
      .eq("trip_id", trip.id)
      .order("created_at", { ascending: false });

    if (error) {
      list.textContent = "Unable to load documents: " + error.message;
      return;
    }

    if (!data || data.length === 0) {
      list.appendChild(
        makeElement("div", "No documents uploaded yet.", "map-empty")
      );
      return;
    }

    DOC_CATEGORIES.forEach(([categoryValue, categoryLabel]) => {
      const docs = data.filter((d) => d.category === categoryValue);
      if (docs.length === 0) return;

      list.appendChild(makeElement("h2", categoryLabel));

      docs.forEach((doc) => {
        const card = document.createElement("div");
        card.className = "trip-card";

        card.appendChild(makeElement("h3", doc.title));

        const details = [doc.file_name, docSizeText(doc.size_bytes)]
          .filter(Boolean)
          .join(" • ");
        card.appendChild(makeElement("p", details));

        const viewButton = makeElement("button", "View");
        viewButton.type = "button";
        viewButton.addEventListener("click", () =>
          openTripDocument(doc, false)
        );

        const downloadButton = makeElement(
          "button",
          "Download",
          "secondary-button"
        );
        downloadButton.type = "button";
        downloadButton.addEventListener("click", () =>
          openTripDocument(doc, true)
        );

        const deleteButton = makeElement(
          "button",
          "Delete",
          "delete-button"
        );
        deleteButton.type = "button";
        deleteButton.addEventListener("click", async () => {
          if (!confirm('Delete "' + doc.title + '"?')) return;

          deleteButton.disabled = true;

          const { error: rowError } = await db
            .from("trip_documents")
            .delete()
            .eq("id", doc.id)
            .eq("trip_id", trip.id);

          if (rowError) {
            deleteButton.disabled = false;
            alert("Could not delete: " + rowError.message);
            return;
          }

          await db.storage
            .from("trip-documents")
            .remove([doc.storage_path]);

          message.textContent = "Document deleted.";
          await loadDocuments();
        });

        card.append(viewButton, downloadButton, deleteButton);
        list.appendChild(card);
      });
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser) {
      message.textContent = "Please sign in to upload documents.";
      return;
    }

    const file = fileInput.files[0];

    if (!file) {
      message.textContent = "Choose a file first.";
      return;
    }

    if (file.size > DOC_MAX_BYTES) {
      message.textContent = "That file is over 10 MB.";
      return;
    }

    uploadButton.disabled = true;
    message.textContent = "Uploading...";

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath =
      trip.id + "/" + crypto.randomUUID() + "-" + safeName;

    const { error: uploadError } = await db.storage
      .from("trip-documents")
      .upload(storagePath, file, { contentType: file.type });

    if (uploadError) {
      uploadButton.disabled = false;
      message.textContent = "Upload failed: " + uploadError.message;
      return;
    }

    const { error: insertError } = await db
      .from("trip_documents")
      .insert({
        trip_id: trip.id,
        title: titleInput.value.trim(),
        category: categorySelect.value,
        file_name: file.name,
        storage_path: storagePath,
        mime_type: file.type || null,
        size_bytes: file.size,
        created_by: currentUser.id
      });

    uploadButton.disabled = false;

    if (insertError) {
      await db.storage.from("trip-documents").remove([storagePath]);
      message.textContent = "Could not save: " + insertError.message;
      return;
    }

    form.reset();
    message.textContent = "Document uploaded!";
    await loadDocuments();
  });

  await loadDocuments();
}
