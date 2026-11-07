(function () {
  const APP_URL = "https://tylerdetmer.github.io/travel-hub/";

  const style = document.createElement("style");
  style.textContent =
    "#app > h1.hidden ~ #invites{display:none}" +
    ".invite-card{border-color:var(--accent)}";
  document.head.appendChild(style);

  function roleLabel(role) {
    if (role === "owner") return "Owner";
    if (role === "editor") return "Editor";
    return "Viewer";
  }

  async function refreshInvitations() {
    const app = document.getElementById("app");
    if (!app || typeof db === "undefined" || !db || !currentUser) return;

    const { data, error } = await db.rpc("my_pending_invitations");

    let box = document.getElementById("invites");
    if (!box) {
      box = document.createElement("section");
      box.id = "invites";
      app.insertBefore(box, document.getElementById("trips"));
    }
    box.replaceChildren();

    if (error || !data || data.length === 0) return;

    box.appendChild(makeElement("h2", "Trip invitations"));

    data.forEach((inv) => {
      const card = document.createElement("div");
      card.className = "trip-card invite-card";

      card.appendChild(makeElement("h3", inv.trip_name));
      if (inv.trip_destination) {
        card.appendChild(makeElement("p", inv.trip_destination));
      }
      card.appendChild(
        makeElement("p", "You’ve been invited as: " + roleLabel(inv.member_role))
      );

      const msg = document.createElement("p");

      const accept = makeElement("button", "Accept");
      accept.type = "button";
      accept.addEventListener("click", async () => {
        accept.disabled = true;
        msg.textContent = "Joining...";
        const { error: acceptError } = await db.rpc("accept_trip_invitation", {
          p_invite_id: inv.invitation_id
        });
        if (acceptError) {
          accept.disabled = false;
          msg.textContent = "Could not accept: " + acceptError.message;
          return;
        }
        await loadTrips();
      });

      const decline = makeElement("button", "Decline", "secondary-button");
      decline.type = "button";
      decline.addEventListener("click", async () => {
        if (!confirm("Decline this invitation?")) return;
        const { error: declineError } = await db.rpc("decline_trip_invitation", {
          p_invite_id: inv.invitation_id
        });
        if (declineError) {
          msg.textContent = "Could not decline: " + declineError.message;
          return;
        }
        await refreshInvitations();
      });

      card.append(accept, decline, msg);
      box.appendChild(card);
    });
  }

  window.showMembers = async function (content, trip) {
    const isOwner = Boolean(currentUser) && trip.owner_id === currentUser.id;

    content.appendChild(
      makeElement(
        "p",
        isOwner
          ? "Invite family to this trip. Editors can add and change plans, places, and documents. Viewers can only look."
          : "People who can see this trip."
      )
    );

    const message = document.createElement("p");
    const list = document.createElement("div");

    async function loadMembers() {
      list.replaceChildren();

      const { data, error } = await db
        .from("trip_members")
        .select("*")
        .eq("trip_id", trip.id)
        .order("created_at", { ascending: true });

      if (error) {
        list.textContent = "Unable to load members: " + error.message;
        return;
      }

      data.sort((a, b) => (a.role === "owner" ? 0 : 1) - (b.role === "owner" ? 0 : 1));

      data.forEach((m) => {
        const isMe = m.user_id === currentUser.id;
        const label =
          (m.invited_email || (isMe ? currentUser.email : "Trip owner")) +
          (isMe ? " (you)" : "");

        const card = document.createElement("div");
        card.className = "trip-card";
        card.appendChild(makeElement("h3", label));
        card.appendChild(
          makeElement(
            "p",
            roleLabel(m.role) +
              " • " +
              (m.status === "pending" ? "Invitation pending" : "Joined")
          )
        );

        if (isOwner && m.role !== "owner") {
          const remove = makeElement(
            "button",
            m.status === "pending" ? "Cancel invite" : "Remove",
            "delete-button"
          );
          remove.type = "button";
          remove.addEventListener("click", async () => {
            if (!confirm("Remove " + label + " from this trip?")) return;
            remove.disabled = true;
            const { error: removeError } = await db
              .from("trip_members")
              .delete()
              .eq("id", m.id)
              .eq("trip_id", trip.id);
            if (removeError) {
              remove.disabled = false;
              alert("Could not remove: " + removeError.message);
              return;
            }
            await loadMembers();
          });
          card.appendChild(remove);
        }

        list.appendChild(card);
      });
    }

    if (isOwner) {
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

      const emailInput = document.createElement("input");
      emailInput.type = "email";
      emailInput.placeholder = "family@example.com";
      emailInput.required = true;
      emailInput.autocapitalize = "none";

      const roleSelect = document.createElement("select");
      [
        ["editor", "Editor (can add and edit)"],
        ["viewer", "Viewer (view only)"]
      ].forEach(([value, text]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = text;
        roleSelect.appendChild(option);
      });

      const inviteButton = makeElement("button", "Send invite");
      inviteButton.type = "submit";

      form.append(
        makeElement("h3", "Invite someone"),
        addField("Their email", emailInput),
        addField("Access", roleSelect),
        inviteButton,
        message
      );

      form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = emailInput.value.trim().toLowerCase();
        if (!email) return;

        if (currentUser.email && email === currentUser.email.toLowerCase()) {
          message.textContent = "That’s your own email.";
          return;
        }

        inviteButton.disabled = true;
        message.textContent = "Saving invite...";

        const { error } = await db.from("trip_members").insert({
          trip_id: trip.id,
          invited_email: email,
          role: roleSelect.value,
          status: "pending"
        });

        inviteButton.disabled = false;

        if (error) {
          message.textContent =
            error.code === "23505"
              ? "That email is already invited to this trip."
              : "Could not invite: " + error.message;
          return;
        }

        form.reset();
        message.textContent =
          "Invite saved. Ask them to sign in or create an account with " +
          email +
          ". Tap Share app link to send them the address.";
        await loadMembers();
      });

      content.appendChild(form);

      const shareButton = makeElement("button", "Share app link", "secondary-button");
      shareButton.type = "button";
      shareButton.addEventListener("click", async () => {
        const text =
          "Join my trip “" + trip.name + "” on Travel Hub. Sign in or create an account with the email I invited, then accept the invitation.";

        if (navigator.share) {
          try {
            await navigator.share({ title: "Travel Hub", text: text, url: APP_URL });
          } catch (e) {}
          return;
        }

        try {
          await navigator.clipboard.writeText(text + " " + APP_URL);
          message.textContent = "Invitation message copied.";
        } catch (e) {
          message.textContent = "Share this link: " + APP_URL;
        }
      });
      content.appendChild(shareButton);
    }

    content.appendChild(makeElement("h3", "People on this trip"));
    content.appendChild(list);

    await loadMembers();
  };

  // Show the invitation banner whenever the trips list loads
  const originalLoadTrips = window.loadTrips;
  if (typeof originalLoadTrips === "function") {
    window.loadTrips = async function () {
      const result = await originalLoadTrips.apply(this, arguments);
      refreshInvitations();
      return result;
    };
  }

  const appEl = document.getElementById("app");
  if (appEl && !appEl.classList.contains("hidden")) refreshInvitations();
})();
