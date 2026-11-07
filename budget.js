(function () {
  const CATS = [
    ["flights", "Flights"],
    ["lodging", "Lodging"],
    ["food", "Food & drink"],
    ["transportation", "Transportation"],
    ["activities", "Activities"],
    ["shopping", "Shopping"],
    ["other", "Other"]
  ];
  const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "MXN", "JPY"];

  const style = document.createElement("style");
  style.textContent =
    ".bud-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}" +
    ".bud-stat{background:var(--bg);border:1px solid var(--line);border-radius:14px;padding:10px 12px}" +
    ".bud-stat small{display:block;color:var(--mute);font-size:12px}" +
    '.bud-stat b{font-family:"Bricolage Grotesque","DM Sans",sans-serif;font-size:20px}' +
    ".bud-bar{height:10px;border-radius:99px;background:var(--line);overflow:hidden;margin-top:8px}" +
    ".bud-bar i{display:block;height:100%;background:var(--fun)}" +
    ".bud-bar.over i{background:var(--social)}" +
    ".bud-row{display:flex;justify-content:space-between;gap:8px;font-size:14px;padding:7px 0;border-bottom:1px solid var(--line)}" +
    ".bud-row span:last-child{color:var(--mute);text-align:right}" +
    ".bud-warn{color:var(--social);font-weight:700;font-size:14px}";
  document.head.appendChild(style);

  window.showBudget = async function (content, trip) {
    let currency = "USD";
    let budgetTotal = null;
    let expenses = [];
    let editingId = null;

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

    const num = (v) => (v === null || v === undefined ? null : Number(v));

    function money(n) {
      try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency: currency }).format(n || 0);
      } catch (e) {
        return currency + " " + Number(n || 0).toFixed(2);
      }
    }

    function catLabel(value) {
      return (CATS.find((c) => c[0] === value) || CATS[CATS.length - 1])[1];
    }

    function field(labelText, input) {
      const label = document.createElement("label");
      label.textContent = labelText;
      label.appendChild(input);
      input.style.display = "block";
      input.style.width = "100%";
      return label;
    }

    function parseAmount(raw, label) {
      const t = raw.trim();
      if (t === "") return { value: null };
      const v = Number(t);
      if (!Number.isFinite(v) || v < 0) return { error: label + " must be a positive number." };
      return { value: Math.round(v * 100) / 100 };
    }

    content.appendChild(
      makeElement(
        "p",
        canEdit
          ? "Set a budget, add estimated costs while planning, then fill in the actual amount once you’ve paid."
          : "The budget and spending for this trip."
      )
    );

    const summary = document.createElement("div");
    content.appendChild(summary);

    let budgetInput = null;
    let currencySelect = null;
    const list = document.createElement("div");
    const paidList = document.createElement("datalist");
    paidList.id = "paidby-names";

    function renderSummary() {
      summary.replaceChildren();

      const spent = expenses.reduce((t, e) => t + (num(e.actual_amount) || 0), 0);
      const planned = expenses.reduce((t, e) => t + (num(e.estimated_amount) || 0), 0);
      const projected = expenses.reduce(
        (t, e) => t + (num(e.actual_amount) !== null ? num(e.actual_amount) : num(e.estimated_amount) || 0),
        0
      );

      const grid = document.createElement("div");
      grid.className = "bud-grid";

      function stat(label, value) {
        const box = document.createElement("div");
        box.className = "bud-stat";
        box.append(makeElement("small", label), makeElement("b", value));
        grid.appendChild(box);
      }

      stat("Budget", budgetTotal !== null ? money(budgetTotal) : "Not set");
      stat("Spent", money(spent));
      stat("Estimated", money(planned));
      stat("Left", budgetTotal !== null ? money(budgetTotal - spent) : "—");
      summary.appendChild(grid);

      if (budgetTotal !== null && budgetTotal > 0) {
        const bar = document.createElement("div");
        bar.className = "bud-bar" + (spent > budgetTotal ? " over" : "");
        const fill = document.createElement("i");
        fill.style.width = Math.min(100, (spent / budgetTotal) * 100) + "%";
        bar.appendChild(fill);
        summary.appendChild(bar);
        summary.appendChild(
          makeElement("p", Math.round((spent / budgetTotal) * 100) + "% of budget spent")
        );
        if (projected > budgetTotal) {
          summary.appendChild(
            makeElement(
              "p",
              "Heads up: spent plus remaining estimates is " + money(projected - budgetTotal) + " over budget.",
              "bud-warn"
            )
          );
        }
      }

      if (expenses.length === 0) return;

      summary.appendChild(makeElement("h3", "By category"));
      CATS.forEach(([value, label]) => {
        const items = expenses.filter((e) => (CATS.some((c) => c[0] === e.category) ? e.category : "other") === value);
        if (items.length === 0) return;
        const est = items.reduce((t, e) => t + (num(e.estimated_amount) || 0), 0);
        const act = items.reduce((t, e) => t + (num(e.actual_amount) || 0), 0);
        const row = document.createElement("div");
        row.className = "bud-row";
        row.append(makeElement("span", label), makeElement("span", "Est. " + money(est) + " · Spent " + money(act)));
        summary.appendChild(row);
      });

      const payers = {};
      expenses.forEach((e) => {
        const name = (e.paid_by || "").trim();
        if (!name || num(e.actual_amount) === null) return;
        const key = name.toLowerCase();
        if (!payers[key]) payers[key] = { name: name, total: 0 };
        payers[key].total += num(e.actual_amount);
      });
      const payerList = Object.values(payers);
      if (payerList.length > 0) {
        summary.appendChild(makeElement("h3", "Who paid"));
        payerList.forEach((p) => {
          const row = document.createElement("div");
          row.className = "bud-row";
          row.append(makeElement("span", p.name), makeElement("span", money(p.total)));
          summary.appendChild(row);
        });
      }
    }

    // ----- Budget form -----
    if (canEdit) {
      const form = document.createElement("form");
      form.className = "panel";

      budgetInput = document.createElement("input");
      budgetInput.type = "number";
      budgetInput.step = "0.01";
      budgetInput.min = "0";
      budgetInput.inputMode = "decimal";
      budgetInput.placeholder = "Example: 5000";

      currencySelect = document.createElement("select");
      CURRENCIES.forEach((c) => {
        const o = document.createElement("option");
        o.value = c;
        o.textContent = c;
        currencySelect.appendChild(o);
      });

      const saveBudget = makeElement("button", "Save budget");
      saveBudget.type = "submit";
      const budgetMsg = document.createElement("p");

      form.append(
        makeElement("h3", "Trip budget"),
        field("Total budget", budgetInput),
        field("Currency", currencySelect),
        saveBudget,
        budgetMsg
      );

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const parsed = parseAmount(budgetInput.value, "Budget");
        if (parsed.error) {
          budgetMsg.textContent = parsed.error;
          return;
        }
        saveBudget.disabled = true;
        budgetMsg.textContent = "Saving...";
        const { error } = await db.from("trip_budgets").upsert(
          {
            trip_id: trip.id,
            total_budget: parsed.value,
            currency: currencySelect.value,
            updated_at: new Date().toISOString()
          },
          { onConflict: "trip_id" }
        );
        saveBudget.disabled = false;
        if (error) {
          budgetMsg.textContent = "Could not save: " + error.message;
          return;
        }
        budgetMsg.textContent = "Budget saved.";
        await loadAll();
      });

      content.appendChild(form);
    }

    // ----- Expense form -----
    let expForm = null;
    let descInput, catSelect, estInput, actInput, dateInput, paidInput, addButton, cancelButton, expMsg;

    if (canEdit) {
      expForm = document.createElement("form");
      expForm.className = "panel";

      descInput = document.createElement("input");
      descInput.type = "text";
      descInput.placeholder = "Example: Hotel in Paris";
      descInput.required = true;

      catSelect = document.createElement("select");
      CATS.forEach(([value, label]) => {
        const o = document.createElement("option");
        o.value = value;
        o.textContent = label;
        catSelect.appendChild(o);
      });

      function amountInput(placeholder) {
        const i = document.createElement("input");
        i.type = "number";
        i.step = "0.01";
        i.min = "0";
        i.inputMode = "decimal";
        i.placeholder = placeholder;
        return i;
      }
      estInput = amountInput("Estimated cost");
      actInput = amountInput("Actual cost (when paid)");

      dateInput = document.createElement("input");
      dateInput.type = "date";

      paidInput = document.createElement("input");
      paidInput.type = "text";
      paidInput.placeholder = "Example: Tyler";
      paidInput.setAttribute("list", "paidby-names");

      addButton = makeElement("button", "Add expense");
      addButton.type = "submit";
      cancelButton = makeElement("button", "Cancel edit", "secondary-button");
      cancelButton.type = "button";
      cancelButton.classList.add("hidden");
      expMsg = document.createElement("p");

      expForm.append(
        makeElement("h3", "Add an expense"),
        field("What was it for?", descInput),
        field("Category", catSelect),
        field("Estimated amount", estInput),
        field("Actual amount", actInput),
        field("Date (optional)", dateInput),
        field("Paid by (optional)", paidInput),
        paidList,
        addButton,
        cancelButton,
        expMsg
      );

      function resetExpenseForm() {
        editingId = null;
        expForm.reset();
        addButton.textContent = "Add expense";
        cancelButton.classList.add("hidden");
        expForm.querySelector("h3").textContent = "Add an expense";
      }

      cancelButton.addEventListener("click", () => {
        resetExpenseForm();
        expMsg.textContent = "";
      });

      expForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const est = parseAmount(estInput.value, "Estimated amount");
        const act = parseAmount(actInput.value, "Actual amount");
        if (est.error || act.error) {
          expMsg.textContent = est.error || act.error;
          return;
        }
        if (est.value === null && act.value === null) {
          expMsg.textContent = "Enter an estimated or actual amount.";
          return;
        }

        addButton.disabled = true;
        expMsg.textContent = "Saving...";

        const row = {
          trip_id: trip.id,
          description: descInput.value.trim(),
          category: catSelect.value,
          estimated_amount: est.value,
          actual_amount: act.value,
          expense_date: dateInput.value || null,
          paid_by: paidInput.value.trim() || null
        };

        let result;
        if (editingId) {
          result = await db.from("trip_expenses").update(row).eq("id", editingId).eq("trip_id", trip.id);
        } else {
          row.created_by = currentUser.id;
          result = await db.from("trip_expenses").insert(row);
        }

        addButton.disabled = false;

        if (result.error) {
          expMsg.textContent = "Could not save: " + result.error.message;
          return;
        }

        resetExpenseForm();
        expMsg.textContent = "Saved!";
        await loadAll();
      });

      content.appendChild(expForm);
    }

    content.appendChild(makeElement("h3", "Expenses"));
    content.appendChild(list);

    function renderList() {
      list.replaceChildren();

      if (expenses.length === 0) {
        list.appendChild(makeElement("div", "No expenses yet.", "map-empty"));
        return;
      }

      CATS.forEach(([value, label]) => {
        const items = expenses.filter((e) => (CATS.some((c) => c[0] === e.category) ? e.category : "other") === value);
        if (items.length === 0) return;

        list.appendChild(makeElement("h2", label));

        items.forEach((e) => {
          const card = document.createElement("div");
          card.className = "trip-card";
          card.appendChild(makeElement("h3", e.description));

          const amounts = [];
          if (num(e.estimated_amount) !== null) amounts.push("Est. " + money(num(e.estimated_amount)));
          amounts.push(num(e.actual_amount) !== null ? "Paid " + money(num(e.actual_amount)) : "Not paid yet");
          card.appendChild(makeElement("p", amounts.join(" · ")));

          const meta = [];
          if (e.expense_date) {
            meta.push(
              new Date(e.expense_date + "T00:00:00").toLocaleDateString([], {
                month: "short",
                day: "numeric",
                year: "numeric"
              })
            );
          }
          if (e.paid_by) meta.push("Paid by " + e.paid_by);
          if (meta.length) card.appendChild(makeElement("p", meta.join(" · ")));

          if (canEdit) {
            const edit = makeElement("button", "Edit", "secondary-button");
            edit.type = "button";
            edit.addEventListener("click", () => {
              editingId = e.id;
              descInput.value = e.description || "";
              catSelect.value = CATS.some((c) => c[0] === e.category) ? e.category : "other";
              estInput.value = e.estimated_amount === null ? "" : e.estimated_amount;
              actInput.value = e.actual_amount === null ? "" : e.actual_amount;
              dateInput.value = e.expense_date || "";
              paidInput.value = e.paid_by || "";
              addButton.textContent = "Save changes";
              cancelButton.classList.remove("hidden");
              expForm.querySelector("h3").textContent = "Edit expense";
              expMsg.textContent = "Editing: " + e.description;
              expForm.scrollIntoView({ behavior: "smooth", block: "start" });
            });

            const del = makeElement("button", "Delete", "delete-button");
            del.type = "button";
            del.addEventListener("click", async () => {
              if (!confirm('Delete "' + e.description + '"?')) return;
              del.disabled = true;
              const { error } = await db
                .from("trip_expenses")
                .delete()
                .eq("id", e.id)
                .eq("trip_id", trip.id);
              if (error) {
                del.disabled = false;
                alert("Could not delete: " + error.message);
                return;
              }
              await loadAll();
            });

            card.append(edit, del);
          }

          list.appendChild(card);
        });
      });
    }

    async function loadAll() {
      const [b, x] = await Promise.all([
        db.from("trip_budgets").select("*").eq("trip_id", trip.id).maybeSingle(),
        db
          .from("trip_expenses")
          .select("*")
          .eq("trip_id", trip.id)
          .order("created_at", { ascending: false })
      ]);

      if (b.error || x.error) {
        summary.replaceChildren();
        summary.appendChild(
          makeElement("p", "Unable to load budget: " + (b.error || x.error).message)
        );
        return;
      }

      budgetTotal = b.data ? num(b.data.total_budget) : null;
      currency = b.data && b.data.currency ? b.data.currency : "USD";
      expenses = x.data || [];

      if (canEdit) {
        budgetInput.value = budgetTotal === null ? "" : budgetTotal;
        currencySelect.value = currency;

        paidList.replaceChildren();
        [...new Set(expenses.map((e) => (e.paid_by || "").trim()).filter(Boolean))].forEach((name) => {
          const o = document.createElement("option");
          o.value = name;
          paidList.appendChild(o);
        });
      }

      renderSummary();
      renderList();
    }

    await loadAll();
  };
})();
