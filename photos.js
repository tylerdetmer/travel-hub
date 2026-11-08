(function () {
  const BUCKET = "trip-photos";
  const MAX_EDGE = 2000;
  const THUMB_EDGE = 480;
  const MAX_BATCH = 20;

  const style = document.createElement("style");
  style.textContent =
    ".ph-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:8px}" +
    ".ph-cell{display:block;position:relative;width:100%;aspect-ratio:1/1;margin:0;padding:0;border:0;border-radius:8px;overflow:hidden;background:var(--line)}" +
    ".ph-cell img{width:100%;height:100%;object-fit:cover;display:block}" +
    ".ph-view{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;background:rgba(0,0,0,.94);color:#fff}" +
    ".ph-view button{margin:0;background:rgba(255,255,255,.16);color:#fff;border:0;font-weight:500}" +
    ".ph-top{display:flex;justify-content:space-between;align-items:center;padding:calc(10px + env(safe-area-inset-top,0px)) 14px 10px}" +
    ".ph-stage{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center}" +
    ".ph-stage img{max-width:100%;max-height:100%;object-fit:contain}" +
    ".ph-arrow{position:absolute;top:50%;transform:translateY(-50%);width:42px;height:42px;padding:0;border-radius:50%;font-size:22px;line-height:1}" +
    ".ph-prev{left:8px}.ph-next{right:8px}" +
    ".ph-info{padding:12px 16px calc(14px + env(safe-area-inset-bottom,0px))}" +
    ".ph-info p{margin:4px 0 0;font-size:14px;color:rgba(255,255,255,.75)}" +
    ".ph-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}" +
    ".ph-actions button{padding:9px 14px;font-size:14px}" +
    ".ph-actions .ph-del{color:#ff8a7a}";
  document.head.appendChild(style);

  // Resize a photo to a full-size and a thumbnail JPEG
  async function makeJpegs(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("couldn’t read this image"));
        el.src = url;
      });

      const srcW = img.naturalWidth;
      const srcH = img.naturalHeight;
      if (!srcW || !srcH) throw new Error("couldn’t read this image");

      async function render(edge, quality) {
        const scale = Math.min(1, edge / Math.max(srcW, srcH));
        const w = Math.max(1, Math.round(srcW * scale));
        const h = Math.max(1, Math.round(srcH * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
        if (!blob) throw new Error("couldn’t convert this image");
        return { blob, w, h };
      }

      return {
        full: await render(MAX_EDGE, 0.85),
        thumb: await render(THUMB_EDGE, 0.75)
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  window.showPhotos = async function (content, trip) {
    let isEditor = Boolean(currentUser) && trip.owner_id === currentUser.id;
    if (!isEditor && currentUser) {
      const { data: me } = await db
        .from("trip_members")
        .select("role")
        .eq("trip_id", trip.id)
        .eq("user_id", currentUser.id)
        .eq("status", "accepted")
        .maybeSingle();
      isEditor = Boolean(me) && (me.role === "owner" || me.role === "editor");
    }

    let photos = [];

    const isMine = (p) => Boolean(currentUser) && p.row.created_by === currentUser.id;
    const canManage = (p) => isMine(p) || isEditor;

    function field(labelText, input) {
      const label = document.createElement("label");
      label.textContent = labelText;
      label.appendChild(input);
      input.style.display = "block";
      input.style.width = "100%";
      return label;
    }

    content.appendChild(
      makeElement(
        "p",
        "Share vacation photos with everyone on this trip. Photos are resized to save space."
      )
    );

    // ----- Upload form -----
    const form = document.createElement("form");
    form.className = "panel";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.multiple = true;
    fileInput.required = true;

    const captionInput = document.createElement("input");
    captionInput.type = "text";
    captionInput.placeholder = "Example: Day at the beach (optional)";

    const uploadButton = makeElement("button", "Upload photos");
    uploadButton.type = "submit";
    const message = document.createElement("p");

    form.append(
      makeElement("h3", "Add photos"),
      field("Photos (up to " + MAX_BATCH + " at a time)", fileInput),
      field("Caption", captionInput),
      uploadButton,
      message
    );
    content.appendChild(form);

    const countHeading = makeElement("h3", "Photos");
    content.appendChild(countHeading);

    const grid = document.createElement("div");
    grid.className = "ph-grid";
    content.appendChild(grid);

    const empty = makeElement("div", "No photos yet. Add the first one above!", "map-empty");
    content.appendChild(empty);

    function renderGrid() {
      grid.replaceChildren();
      countHeading.textContent = photos.length
        ? photos.length + (photos.length === 1 ? " photo" : " photos")
        : "Photos";
      empty.classList.toggle("hidden", photos.length > 0);

      photos.forEach((p, index) => {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "ph-cell";
        cell.setAttribute("aria-label", p.row.caption || "Open photo");

        const img = document.createElement("img");
        img.loading = "lazy";
        img.decoding = "async";
        img.alt = p.row.caption || "Trip photo";
        img.src = p.thumbUrl;

        cell.appendChild(img);
        cell.addEventListener("click", () => openViewer(index));
        grid.appendChild(cell);
      });
    }

    async function loadPhotos() {
      const { data, error } = await db
        .from("trip_photos")
        .select("*")
        .eq("trip_id", trip.id)
        .order("created_at", { ascending: false });

      if (error) {
        grid.textContent = "Unable to load photos: " + error.message;
        return;
      }

      const rows = data || [];
      const urlMap = {};

      if (rows.length) {
        const { data: signed } = await db.storage
          .from(BUCKET)
          .createSignedUrls(rows.map((r) => r.thumb_path), 3600);
        (signed || []).forEach((s) => {
          if (s.signedUrl) urlMap[s.path] = s.signedUrl;
        });
      }

      photos = rows.map((row) => ({ row, thumbUrl: urlMap[row.thumb_path] || "" }));
      renderGrid();
    }

    // ----- Full-screen viewer -----
    function openViewer(startIndex) {
      let i = startIndex;
      let token = 0;
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      const overlay = document.createElement("div");
      overlay.className = "ph-view";

      const top = document.createElement("div");
      top.className = "ph-top";
      const closeButton = makeElement("button", "✕ Close");
      closeButton.type = "button";
      const counter = makeElement("span", "");
      top.append(closeButton, counter);

      const stage = document.createElement("div");
      stage.className = "ph-stage";
      const img = document.createElement("img");
      img.alt = "";
      const prev = makeElement("button", "‹", "ph-arrow ph-prev");
      const next = makeElement("button", "›", "ph-arrow ph-next");
      prev.type = "button";
      next.type = "button";
      stage.append(img, prev, next);

      const info = document.createElement("div");
      info.className = "ph-info";

      overlay.append(top, stage, info);
      document.body.appendChild(overlay);

      function close() {
        overlay.remove();
        document.body.style.overflow = previousOverflow;
      }

      function renderInfo(p) {
        info.replaceChildren();

        if (p.row.caption) info.appendChild(makeElement("div", p.row.caption));

        const who = isMine(p) ? "you" : p.row.uploader_email || "a family member";
        const when = new Date(p.row.created_at).toLocaleDateString([], {
          month: "short",
          day: "numeric",
          year: "numeric"
        });
        info.appendChild(makeElement("p", "Added by " + who + " · " + when));

        const actions = document.createElement("div");
        actions.className = "ph-actions";

        const download = makeElement("button", "Download");
        download.type = "button";
        download.addEventListener("click", async () => {
          const name = (p.row.file_name || "photo").replace(/\.[^.]+$/, "") + ".jpg";
          const { data, error } = await db.storage
            .from(BUCKET)
            .createSignedUrl(p.row.storage_path, 300, { download: name });
          if (error || !data) {
            alert("Could not download: " + (error ? error.message : "Unknown error"));
            return;
          }
          window.location.href = data.signedUrl;
        });
        actions.appendChild(download);

        if (canManage(p)) {
          const caption = makeElement("button", "Edit caption");
          caption.type = "button";
          caption.addEventListener("click", async () => {
            const answer = prompt("Caption:", p.row.caption || "");
            if (answer === null) return;
            const value = answer.trim() || null;
            const { error } = await db
              .from("trip_photos")
              .update({ caption: value })
              .eq("id", p.row.id)
              .eq("trip_id", trip.id);
            if (error) {
              alert("Could not save caption: " + error.message);
              return;
            }
            p.row.caption = value;
            renderInfo(p);
            renderGrid();
          });

          const del = makeElement("button", "Delete", "ph-del");
          del.type = "button";
          del.addEventListener("click", async () => {
            if (!confirm("Delete this photo?")) return;
            del.disabled = true;

            const { data, error } = await db
              .from("trip_photos")
              .delete()
              .eq("id", p.row.id)
              .eq("trip_id", trip.id)
              .select();

            if (error || !data || data.length === 0) {
              del.disabled = false;
              alert(error ? "Could not delete: " + error.message : "You don’t have permission to delete this photo.");
              return;
            }

            await db.storage.from(BUCKET).remove([p.row.storage_path, p.row.thumb_path]);

            photos.splice(i, 1);
            renderGrid();
            if (!photos.length) {
              close();
              return;
            }
            show(Math.min(i, photos.length - 1));
          });

          actions.append(caption, del);
        }

        info.appendChild(actions);
      }

      async function show(n) {
        i = (n + photos.length) % photos.length;
        const p = photos[i];
        const mine = ++token;

        img.src = p.thumbUrl;
        counter.textContent = i + 1 + " / " + photos.length;
        prev.classList.toggle("hidden", photos.length < 2);
        next.classList.toggle("hidden", photos.length < 2);
        renderInfo(p);

        const { data } = await db.storage.from(BUCKET).createSignedUrl(p.row.storage_path, 3600);
        if (data && mine === token) img.src = data.signedUrl;
      }

      closeButton.addEventListener("click", close);
      prev.addEventListener("click", () => show(i - 1));
      next.addEventListener("click", () => show(i + 1));

      let startX = null;
      stage.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; }, { passive: true });
      stage.addEventListener("touchend", (e) => {
        if (startX === null) return;
        const dx = e.changedTouches[0].clientX - startX;
        startX = null;
        if (Math.abs(dx) > 50 && photos.length > 1) show(i + (dx < 0 ? 1 : -1));
      });

      show(i);
    }

    // ----- Upload -----
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!currentUser) {
        message.textContent = "Please sign in to add photos.";
        return;
      }

      const files = [...fileInput.files];
      if (!files.length) {
        message.textContent = "Choose photos first.";
        return;
      }
      if (files.length > MAX_BATCH) {
        message.textContent = "Choose up to " + MAX_BATCH + " photos at a time.";
        return;
      }

      uploadButton.disabled = true;
      const caption = captionInput.value.trim() || null;
      let done = 0;
      const failed = [];

      for (let n = 0; n < files.length; n++) {
        const file = files[n];
        message.textContent = "Uploading " + (n + 1) + " of " + files.length + "...";

        try {
          const { full, thumb } = await makeJpegs(file);
          const base = trip.id + "/" + currentUser.id + "/" + crypto.randomUUID();
          const fullPath = base + ".jpg";
          const thumbPath = base + "-thumb.jpg";

          const up1 = await db.storage.from(BUCKET).upload(fullPath, full.blob, { contentType: "image/jpeg" });
          if (up1.error) throw up1.error;

          const up2 = await db.storage.from(BUCKET).upload(thumbPath, thumb.blob, { contentType: "image/jpeg" });
          if (up2.error) {
            await db.storage.from(BUCKET).remove([fullPath]);
            throw up2.error;
          }

          const ins = await db.from("trip_photos").insert({
            trip_id: trip.id,
            storage_path: fullPath,
            thumb_path: thumbPath,
            file_name: file.name,
            caption: caption,
            width: full.w,
            height: full.h,
            size_bytes: full.blob.size,
            uploader_email: currentUser.email || null,
            created_by: currentUser.id
          });
          if (ins.error) {
            await db.storage.from(BUCKET).remove([fullPath, thumbPath]);
            throw ins.error;
          }

          done++;
        } catch (e) {
          failed.push(file.name + " (" + ((e && e.message) || "error") + ")");
        }
      }

      uploadButton.disabled = false;
      form.reset();
      message.textContent =
        (done ? "Added " + done + (done === 1 ? " photo. " : " photos. ") : "") +
        (failed.length ? "Couldn’t add: " + failed.join(", ") : "");

      await loadPhotos();
    });

    await loadPhotos();
  };
})();
