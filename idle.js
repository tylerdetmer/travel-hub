(function () {
  const MINUTES = 10;

  const LIMIT = MINUTES * 60 * 1000;
  const ACTIVE_KEY = "travelhub-lastactive";
  const RESUME_KEY = "travelhub-resume";

  function stamp() {
    try {
      localStorage.setItem(ACTIVE_KEY, String(Date.now()));
    } catch (e) {}
  }

  // If the app was left alone longer than the limit, forget the saved trip
  try {
    const last = Number(localStorage.getItem(ACTIVE_KEY) || 0);
    if (last && Date.now() - last > LIMIT) localStorage.removeItem(RESUME_KEY);
  } catch (e) {}

  let lastActivity = Date.now();
  let lastStamp = 0;
  stamp();

  function activity() {
    const now = Date.now();
    lastActivity = now;
    if (now - lastStamp > 5000) {
      lastStamp = now;
      stamp();
    }
  }

  ["pointerdown", "touchstart", "keydown", "input"].forEach((name) =>
    document.addEventListener(name, activity, { capture: true, passive: true })
  );
  window.addEventListener("scroll", activity, { capture: true, passive: true });

  function tripOpen() {
    return Boolean(document.querySelector("#app > h1.hidden"));
  }

  function toast(text) {
    const el = document.createElement("div");
    el.textContent = text;
    el.style.cssText =
      "position:fixed;left:16px;right:16px;bottom:calc(20px + env(safe-area-inset-bottom,0px));" +
      "max-width:428px;margin:0 auto;padding:12px 14px;border-radius:12px;" +
      "background:var(--accent);color:var(--on);font-size:14px;text-align:center;z-index:70";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }

  function goBack() {
    // Close the photo viewer and the style picker if either is open
    const photoClose = document.querySelector(".ph-view button");
    if (photoClose) photoClose.click();
    document.querySelectorAll(".scrim.open").forEach((s) => s.classList.remove("open"));

    const back = [...document.querySelectorAll("#trips > .panel > button:first-child")].find(
      (b) => b.textContent.indexOf("←") === 0
    );
    if (!back) return;

    back.click();
    lastActivity = Date.now();
    toast("Returned to your trips after " + MINUTES + " minutes of inactivity.");
  }

  function check() {
    if (!tripOpen()) {
      lastActivity = Date.now();
      return;
    }
    if (Date.now() - lastActivity >= LIMIT) goBack();
  }

  setInterval(check, 15000);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
    else stamp();
  });
  window.addEventListener("pageshow", check);
  window.addEventListener("pagehide", stamp);
})();
