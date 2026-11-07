(function () {
  const CATS = [
    ["clothing", "Clothing"],
    ["toiletries", "Toiletries"],
    ["electronics", "Electronics"],
    ["documents", "Documents & money"],
    ["health", "Health & safety"],
    ["kids", "Kids"],
    ["gear", "Gear & activities"],
    ["other", "Other"]
  ];

  const BASICS = [
    { name: "Passport / ID", category: "documents", quantity: 1 },
    { name: "Wallet and cards", category: "documents", quantity: 1 },
    { name: "Phone charger", category: "electronics", quantity: 1 },
    { name: "Portable battery", category: "electronics", quantity: 1 },
    { name: "Headphones", category: "electronics", quantity: 1 },
    { name: "Underwear", category: "clothing", quantity: 5 },
    { name: "Socks", category: "clothing", quantity: 5 },
    { name: "Comfortable walking shoes", category: "clothing", quantity: 1 },
    { name: "Pajamas", category: "clothing", quantity: 1 },
    { name: "Toothbrush and toothpaste", category: "toiletries", quantity: 1 },
    { name: "Deodorant", category: "toiletries", quantity: 1 },
    { name: "Sunscreen", category: "toiletries", quantity: 1 },
    { name: "Medications", category: "health", quantity: 1 },
    { name: "First-aid basics", category: "health", quantity: 1 }
  ];

  const style = document.createElement("style");
  style.textContent =
    ".pk-bar{height:10px;border-radius:99px;background:var(--line);overflow:hidden;margin:6px 0 10px}" +
    ".pk-bar i{display:block;height:100%;background:var(--fun)}" +
    ".pk-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}" +
    ".pk-row:last-child{border-bottom:0}" +
    ".pk-box{flex:none;width:30px;height:30px;margin:0;padding:0;border-radius:8px;border:2px solid var(--mute);" +
    "background:var(--surface);color:var(--on);font-size:17px;line-height:1;font-weight:700;" +
    "display:flex;align-items:center;justify-content:center}" +
    ".pk-box.on{background:var(--fun);border-color:var(--fun)}" +
    ".pk-main{flex:1;min-width:0}" +
    ".pk-name{font-weight:500}" +
    ".pk-row.done .pk-name{text-decoration:line-through;color:var(--mute)}" +
    ".pk-sub{font-size:13px;color:var(--mute)}" +
    ".pk-actions{display:flex;gap:6px;flex:none}" +
    ".pk-x{margin:0;padding:6px 10px;background:none;color:var(--mute);border:1px solid var(--line);font-size:13px;font-weight:400}";
  document.head.appendChild(style);

  window.showPacking = async function (content, trip) {
    let canEdit = Boolean(currentUser) && trip.owner_id === currentUser.id;
    if (!canEdit && currentUser) {
      const { data: me } = await db
        .from("trip_members")
        .select("role")
        .eq("trip_id", trip.id)
        .eq("user_id", currentUser.id)
        .eq("status", "accepted")
        .maybeSingle();
      canEdit = Boolean(me) && (me.role === "owner" || me.role === "editor");
    }

    let items = [];
    let templates = [];
    let filter = "all";

    function normCat(value) {
      return CATS.some((c) => c[0] === value) ? value : "other";
    }

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
        canEdit
          ? "Build a packing list, assign items to family members, and check things off as you pack."
          : "The packing list for this trip."
      )
    );

    const summary = document.createElement("div");
    content.appendChild(summary);

    const chips = document.createElement("div");
    chips.className = "chips";
    chips.style.margin = "8px 0";
    content.appendChild(chips);

    const list = document.createElement("div");
    const nameList = document.createElement("datalist");
    nameList.id = "packing-names";

    let nameInput, categorySelect, qtyInput, assignInput, addButton, addMsg;
    let tplSelect, tplMsg, deleteTplButton;

    // ----- Add item form + templates (editors only) -----
    if (canEdit) {
      const form = document.createElement("form");
      form.className = "panel";

      nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.placeholder = "Example: Rain jacket";
      nameInput.required = true;

      categorySelect = document.createElement("select");
      CATS.forEach(([value, label]) => {
        const o = document.createElement("option");
        o.value = value;
        o.textContent = label;
        categorySelect.appendChild(o);
      });

      qtyInput = document.createElement("input");
      qtyInput.type = "number";
      qtyInput.min = "1";
      qtyInput.step = "1";
      qtyInput.inputMode = "numeric";
      qtyInput.value = "1";

      assignInput = document.createElement("input");
      assignInput.type = "text";
      assignInput.placeholder = "Example: Emma (optional)";
      assignInput.setAttribute("list", "packing-names");

      addButton = makeElement("button", "Add to list");
      addButton.type = "submit";
      addMsg = document.createElement("p");

      form.append(
        makeElement("h3", "Add an item"),
        field("Item", nameInput),
        field("Category", categorySelect),
        field("Quantity", qtyInput),
        field("Who’s packing it?", assignInput),
        nameList,
        addButton,
        addMsg
      );

      form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const qty = Math.max(1, Math.floor(Number(qtyInput.value) || 1));
        addButton.disabled = true;
        addMsg.textContent = "Adding...";

        const { error } = await db.from("packing_items").insert({
          trip_id: trip.id,
          name: nameInput.value.trim(),
          category: categorySelect.value,
          quantity: qty,
          assigned_to: assignInput.value.trim() || null,
          created_by: currentUser.id
        });

        addButton.disabled = false;

        if (error) {
          addMsg.textContent = "Could not add: " + error.message;
          return;
        }

        nameInput.value = "";
        qtyInput.value = "1";
        addMsg.textContent = "Added.";
        nameInput.focus();
        await loadAll();
      });

      content.appendChild(form);

      const tplPanel = document.createElement("div");
      tplPanel.className = "panel";

      tplSelect = document.createElement("select");
      tplMsg = document.createElement("p");

      const addTpl = makeElement("button", "Add these to this trip");
      addTpl.type = "button";

      deleteTplButton = makeElement("button", "Delete this template", "delete-button");
      deleteTplButton.type = "button";

      const saveTpl = makeElement("button", "Save this list as a template", "secondary-button");
      saveTpl.type = "button";

      const uncheck = makeElement("button", "Uncheck everything", "secondary-button");
      uncheck.type = "button";

      tplPanel.append(
        makeElement("h3", "Reusable lists"),
        field("Start from", tplSelect),
        addTpl,
        deleteTplButton,
        saveTpl,
        uncheck,
        tplMsg
      );

      function selectedTemplate() {
        const v = tplSelect.value;
        if (v === "builtin") return { items: BASICS };
        return templates.find((t) => "t:" + t.id === v) || null;
      }

      tplSelect.addEventListener("change", () => {
        deleteTplButton.classList.toggle("hidden", tplSelect.value === "builtin");
      });

      addTpl.addEventListener("click", async () => {
        const tpl = selectedTemplate();
        if (!tpl) return;

        const have = new Set(items.map((i) => i.name.trim().toLowerCase()));
        const rows = (tpl.items || [])
          .filter((s) => !have.has(String(s.name).trim().toLowerCase()))
          .map((s) => ({
            trip_id: trip.id,
            name: s.name,
            category: normCat(s.category),
            quantity: Math.max(1, Number(s.quantity) || 1),
            created_by: currentUser.id
          }));

        if (rows.length === 0) {
          tplMsg.textContent = "Everything in that list is already on this trip.";
          return;
        }

        addTpl.disabled = true;
        tplMsg.textContent = "Adding...";
        const { error } = await db.from("packing_items").insert(rows);
        addTpl.disabled = false;

        if (error) {
          tplMsg.textContent = "Could not add: " + error.message;
          return;
        }
        tplMsg.textContent = "Added " + rows.length + " item" + (rows.length === 1 ? "" : "s") + ".";
        await loadAll();
      });

      saveTpl.addEventListener("click", async () => {
        if (items.length === 0) {
          tplMsg.textContent = "Add some items first.";
          return;
        }
        const name = prompt("Name this template (example: Beach week):");
        if (!name || !name.trim()) return;

        const { error } = await db.from("packing_templates").insert({
          owner_id: currentUser.id,
          name: name.trim(),
          items: items.map((i) => ({ name: i.name, category: i.category, quantity: i.quantity }))
        });

        if (error) {
          tplMsg.textContent = "Could not save template: " + error.message;
          return;
        }
        tplMsg.textContent = "Template saved.";
        await loadAll();
      });

      deleteTplButton.addEventListener("click", async () => {
        const tpl = selectedTemplate();
        if (!tpl || !tpl.id) return;
        if (!confirm('Delete the template "' + tpl.name + '"?')) return;

        const { error } = await db.from("packing_templates").delete().eq("id", tpl.id);
        if (error) {
          tplMsg.textContent = "Could not delete: " + error.message;
          return;
        }
        tplMsg.textContent = "Template deleted.";
        await loadAll();
      });

      uncheck.addEventListener("click", async () => {
        if (!items.some((i) => i.is_packed)) {
          tplMsg.textContent = "Nothing is checked off.";
          return;
        }
        if (!confirm("Uncheck every item on this list?")) return;

        const { error } = await db
          .from("packing_items")
          .update({ is_packed: false })
          .eq("trip_id", trip.id)
          .eq("is_packed", true);

        if (error) {
          tplMsg.textContent = "Could not update: " + error.message;
          return;
        }
        items.forEach((i) => (i.is_packed = false));
        tplMsg.textContent = "All items unchecked.";
        renderAll();
      });

      content.appendChild(tplPanel);
    }

    content.appendChild(makeElement("h3", "Packing list"));
    content.appendChild(list);

    function refreshTemplateOptions() {
      if (!canEdit) return;
      const previous = tplSelect.value;
      tplSelect.replaceChildren();

      const builtin = document.createElement("option");
      builtin.value = "builtin";
      builtin.textContent = "Travel basics (starter)";
      tplSelect.appendChild(builtin);

      templates.forEach((t) => {
        const o = document.createElement("option");
        o.value = "t:" + t.id;
        o.textContent = t.name;
        tplSelect.appendChild(o);
      });

      if ([...tplSelect.options].some((o) => o.value === previous)) {
        tplSelect.value = previous;
      }
      deleteTplButton.classList.toggle("hidden", tplSelect.value === "builtin");
    }

    function visible() {
      if (filter === "all") return items;
      if (filter === "__none") return items.filter((i) => !(i.assigned_to || "").trim());
      return items.filter((i) => (i.assigned_to || "").trim().toLowerCase() === filter);
    }

    function renderChips() {
      chips.replaceChildren();

      const names = {};
      items.forEach((i) => {
        const n = (i.assigned_to || "").trim();
        if (n && !names[n.toLowerCase()]) names[n.toLowerCase()] = n;
      });

      if (canEdit) {
        nameList.replaceChildren();
        Object.values(names).forEach((n) => {
          const o = document.createElement("option");
          o.value = n;
          nameList.appendChild(o);
        });
      }

      const keys = Object.keys(names);
      if (keys.length === 0) {
        filter = "all";
        return;
      }
      if (filter !== "all" && filter !== "__none" && !names[filter]) filter = "all";

      const options = [["all", "Everyone"]].concat(keys.map((k) => [k, names[k]]));
      if (items.some((i) => !(i.assigned_to || "").trim())) options.push(["__none", "Unassigned"]);

      options.forEach(([key, label]) => {
        const chip = makeElement("button", label, "chip" + (filter === key ? " on" : ""));
        chip.type = "button";
        chip.addEventListener("click", () => {
          filter = key;
          renderAll();
        });
        chips.appendChild(chip);
      });
    }

    function renderSummary() {
      summary.replaceChildren();
      const shown = visible();
      const packed = shown.filter((i) => i.is_packed).length;

      summary.appendChild(
        makeElement("h3", shown.length ? packed + " of " + shown.length + " packed" : "Nothing on the list yet")
      );

      if (shown.length) {
        const bar = document.createElement("div");
        bar.className = "pk-bar";
        const fill = document.createElement("i");
        fill.style.width = (packed / shown.length) * 100 + "%";
        bar.appendChild(fill);
        summary.appendChild(bar);
      }
    }

    function renderList() {
      list.replaceChildren();
      const shown = visible();

      if (shown.length === 0) {
        list.appendChild(
          makeElement(
            "div",
            items.length === 0
              ? "No items yet. Add one above, or start from a template."
              : "No items match this filter.",
            "map-empty"
          )
        );
        return;
      }

      CATS.forEach(([value, label]) => {
        const group = shown.filter((i) => normCat(i.category) === value);
        if (group.length === 0) return;

        const card = document.createElement("div");
        card.className = "trip-card";
        card.appendChild(makeElement("h3", label));

        group.forEach((item) => {
          const row = document.createElement("div");
          row.className = "pk-row" + (item.is_packed ? " done" : "");

          const box = document.createElement("button");
          box.type = "button";
          box.className = "pk-box" + (item.is_packed ? " on" : "");
          box.textContent = item.is_packed ? "✓" : "";
          box.setAttribute("aria-label", (item.is_packed ? "Unpack " : "Pack ") + item.name);
          box.disabled = !canEdit;
          box.addEventListener("click", async () => {
            box.disabled = true;
            const next = !item.is_packed;
            const { error } = await db
              .from("packing_items")
              .update({ is_packed: next })
              .eq("id", item.id)
              .eq("trip_id", trip.id);
            if (error) {
              box.disabled = false;
              alert("Could not update: " + error.message);
              return;
            }
            item.is_packed = next;
            renderAll();
          });

          const main = document.createElement("div");
          main.className = "pk-main";
          main.appendChild(
            makeElement("div", item.quantity > 1 ? item.name + " ×" + item.quantity : item.name, "pk-name")
          );
          main.appendChild(
            makeElement(
              "div",
              (item.assigned_to || "").trim() ? "Packing: " + item.assigned_to.trim() : "Unassigned",
              "pk-sub"
            )
          );

          row.append(box, main);

          if (canEdit) {
            const actions = document.createElement("div");
            actions.className = "pk-actions";

            const assign = makeElement("button", "Assign", "pk-x");
            assign.type = "button";
            assign.addEventListener("click", async () => {
              const answer = prompt(
                "Who is packing this? (leave blank to unassign)",
                item.assigned_to || ""
              );
              if (answer === null) return;
              const value = answer.trim() || null;
              const { error } = await db
                .from("packing_items")
                .update({ assigned_to: value })
                .eq("id", item.id)
                .eq("trip_id", trip.id);
              if (error) {
                alert("Could not assign: " + error.message);
                return;
              }
              item.assigned_to = value;
              renderAll();
            });

            const remove = makeElement("button", "✕", "pk-x");
            remove.type = "button";
            remove.setAttribute("aria-label", "Remove " + item.name);
            remove.addEventListener("click", async () => {
              remove.disabled = true;
              const { error } = await db
                .from("packing_items")
                .delete()
                .eq("id", item.id)
                .eq("trip_id", trip.id);
              if (error) {
                remove.disabled = false;
                alert("Could not remove: " + error.message);
                return;
              }
              items = items.filter((i) => i.id !== item.id);
              renderAll();
            });

            actions.append(assign, remove);
            row.appendChild(actions);
          }

          card.appendChild(row);
        });

        list.appendChild(card);
      });
    }

    function renderAll() {
      renderChips();
      renderSummary();
      renderList();
    }

    async function loadAll() {
      const [i, t] = await Promise.all([
        db
          .from("packing_items")
          .select("*")
          .eq("trip_id", trip.id)
          .order("created_at", { ascending: true }),
        db.from("packing_templates").select("*").order("name", { ascending: true })
      ]);

      if (i.error) {
        list.textContent = "Unable to load packing list: " + i.error.message;
        return;
      }

      items = i.data || [];
      templates = t.error ? [] : t.data || [];
      refreshTemplateOptions();
      renderAll();
    }

    await loadAll();
  };
})();
