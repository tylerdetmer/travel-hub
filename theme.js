(function () {
  const KEYS = ["bg","surface","ink","mute","line","accent","on","social","work","home","bills","health","family","fun","misc"];

  const PALS = {
    classic:{n:"Classic",s:"",t:"Clean slate. Follows your phone’s light or dark mode.",c:["#F4F6F8","#FFFFFF","#16202B","#6B7785","#E1E6EB","#16202B","#FFFFFF","#E4572E","#2F6FDE","#0E8FA3","#C98A00","#D6336C","#7B4FD6","#1F9D6B","#6B7785"]},
    blossom:{n:"Blossom",s:"Spring",t:"Blush pink and rose",c:["#FFF5F7","#FFFFFF","#3B2A33","#8A6F7B","#F3DDE4","#D6477F","#FFFFFF","#E0507A","#5B7FD6","#2E9E8F","#C17D1A","#C23B8B","#8A5BD0","#3FA060","#8A6F7B"]},
    meadow:{n:"Meadow",s:"Spring",t:"Dark forest and sage",d:true,c:["#111A14","#1A261E","#E6F0E4","#8DA394","#2A3B2F","#7BC27F","#111A14","#F28B63","#78B2E8","#5CCBC0","#E0B64A","#F07F8F","#B39CEB","#8FD16F","#8DA394"]},
    sunset:{n:"Sunset",s:"Summer",t:"Warm peach and coral",c:["#FFF4EA","#FFFFFF","#3A2A22","#8C6E5E","#F5DECB","#E5533D","#FFFFFF","#E5533D","#2A9BB5","#1E9E8A","#C27C0A","#D63A7A","#9A55C9","#D4691A","#8C6E5E"]},
    ocean:{n:"Ocean",s:"Summer",t:"Deep sea teal at night",d:true,c:["#0A1A20","#11272F","#E3F1F5","#84A3AE","#1D3943","#3FB6D6","#0A1A20","#FF8F6B","#6AA8F2","#4FD6C2","#EBC04F","#FF7D8A","#A79CF2","#5ED39B","#84A3AE"]},
    mulberry:{n:"Mulberry",s:"Fall",t:"Plum and dusty rose",c:["#FAF0EE","#FFFFFF","#3D2530","#8B6A74","#EBD6D6","#9C3F5F","#FFFFFF","#C65A3A","#5B6FB5","#3E8E7E","#B8791A","#B83A6A","#7C4FA0","#5E8F3A","#8B6A74"]},
    timber:{n:"Timber",s:"Fall",t:"Dark walnut and amber",d:true,c:["#1E1812","#2A2118","#F3E8D8","#A8977F","#3D3226","#E0A44A","#1E1812","#F08A5D","#7FB0E0","#5CC0B0","#E0A44A","#EE7E8E","#B79AE8","#8CC56A","#A8977F"]},
    frost:{n:"Frost",s:"Winter",t:"Icy lilac and silver",c:["#F3F2FB","#FFFFFF","#2A2842","#6F6D92","#DEDCF0","#6E56C8","#FFFFFF","#D6558F","#4E7FD8","#2E9AA6","#B98A1E","#C2438E","#7A5BD0","#3E9E78","#6F6D92"]},
    midnight:{n:"Midnight",s:"Winter",t:"Deep navy and sky blue",d:true,c:["#0E1420","#172033","#E8EEF7","#8896AD","#25314A","#6FB1FF","#0E1420","#FF8A6B","#6FB1FF","#4FD0D0","#F0C04A","#FF7A93","#A99BFF","#5FD39A","#8896AD"]}
  };

  const CBG = {
    light:[["Snow","#F4F6F8","#FFFFFF","#E1E6EB","#16202B","#6B7785"],["Cream","#FAF5EA","#FFFDF8","#EADFC8","#2E261A","#86775C"],["Blush","#FFF5F7","#FFFFFF","#F3DDE4","#3B2A33","#8A6F7B"],["Mint","#EFF7F3","#FFFFFF","#D3E6DC","#17302A","#5F7D72"],["Sky","#EEF5FA","#FFFFFF","#D5E4EF","#14293D","#61798E"],["Lavender","#F3F1FA","#FFFFFF","#DEDAF0","#2A2842","#6F6D92"]],
    dark:[["Graphite","#12161B","#1C2229","#2B343D","#EEF2F6","#8C98A6"],["Navy","#0E1420","#172033","#25314A","#E8EEF7","#8896AD"],["Forest","#111A14","#1A261E","#2A3B2F","#E6F0E4","#8DA394"],["Plum","#1A121C","#261A29","#3A2A3E","#F3E8F5","#A58EAA"],["Espresso","#1E1812","#2A2118","#3D3226","#F3E8D8","#A8977F"],["Black","#000000","#111111","#262626","#F5F5F5","#8A8A8A"]]
  };
  const CACC = [["Blue","#2F6FDE","#6FB1FF"],["Teal","#0E8FA3","#4FD0D0"],["Green","#1F9D6B","#5FD39A"],["Gold","#C98A00","#F0C04A"],["Coral","#E4572E","#FF8A6B"],["Rose","#D6336C","#FF7A93"],["Purple","#7B4FD6","#A99BFF"],["Slate","#16202B","#EEF2F6"]];
  const CSEC = {
    light:["#E4572E","#2F6FDE","#0E8FA3","#C98A00","#D6336C","#7B4FD6","#1F9D6B"],
    dark:["#FF8A6B","#6FB1FF","#4FD0D0","#F0C04A","#FF7A93","#A99BFF","#5FD39A"]
  };

  const STORE = "travelhub-prefs";
  let state = {};
  try { state = JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) {}

  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ palette: state.palette, custom: state.custom }));
    } catch (e) {}
  }

  function customColors() {
    const c = state.custom || { mode: "light", bg: 0, acc: 0 };
    const m = c.mode;
    const b = CBG[m][c.bg] || CBG[m][0];
    const a = CACC[c.acc] || CACC[0];
    const accent = m === "light" ? a[1] : a[2];
    return [b[1], b[2], b[4], b[5], b[3], accent, m === "light" ? "#FFFFFF" : b[1], ...CSEC[m], b[5]];
  }

  PALS.custom = {
    n: "Custom", s: "", t: "Choose your own background and accent",
    get c() { return customColors(); },
    get d() { return (state.custom || {}).mode === "dark"; }
  };

  function applyPal(key) {
    const root = document.documentElement;
    const p = PALS[key];
    KEYS.forEach((n) => root.style.removeProperty("--" + n));
    root.style.colorScheme = "";
    if (key !== "classic" && p) {
      KEYS.forEach((n, i) => root.style.setProperty("--" + n, p.c[i]));
      root.style.colorScheme = p.d ? "dark" : "light";
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(document.body).backgroundColor;
  }

  const scrim = document.createElement("div");
  scrim.className = "scrim";
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  scrim.appendChild(sheet);
  document.body.appendChild(scrim);

  function drawTheme() {
    const cur = state.palette || "classic";
    const row = (k) => {
      const p = PALS[k];
      const swatches = [p.c[0], p.c[5], p.c[7], p.c[8]]
        .map((c) => `<i style="background:${c}"></i>`).join("");
      return `<button class="thm ${cur === k ? "on" : ""}" data-pal="${k}">` +
        `<span class="sw">${swatches}</span>` +
        `<span class="thn"><b>${p.n}</b><small>${p.t}${p.s ? " · " + (p.d ? "Dark" : "Light") : ""}</small></span>` +
        `${cur === k ? "✓" : ""}</button>`;
    };
    let html = "<h2>App style</h2>" + row("classic") + row("custom");
    ["Spring", "Summer", "Fall", "Winter"].forEach((s) => {
      html += `<div class="dh">${s}</div>` +
        Object.keys(PALS).filter((k) => PALS[k].s === s).map(row).join("");
    });
    sheet.innerHTML = html + '<div class="btns"><button class="btn" data-act="done">Done</button></div>';
  }

  function drawCustom() {
    const c = state.custom;
    const m = c.mode;
    const bgs = CBG[m].map((b, i) =>
      `<button class="swb ${c.bg === i ? "on" : ""}" data-cbg="${i}" style="background:${b[1]}" aria-label="${b[0]}"><span style="background:${b[2]}"></span></button>`
    ).join("");
    const accs = CACC.map((a, i) =>
      `<button class="swb ${c.acc === i ? "on" : ""}" data-cac="${i}" style="background:${m === "light" ? a[1] : a[2]}" aria-label="${a[0]}"></button>`
    ).join("");
    sheet.innerHTML = "<h2>Custom style</h2><label>Mode</label>" +
      `<div class="chips"><button class="chip ${m === "light" ? "on" : ""}" data-cm="light">Light</button>` +
      `<button class="chip ${m === "dark" ? "on" : ""}" data-cm="dark">Dark</button></div>` +
      `<label>Background</label><div class="swr">${bgs}</div>` +
      `<label>Accent</label><div class="swr">${accs}</div>` +
      '<div class="btns"><button class="btn ghost" data-act="back">Back</button><button class="btn" data-act="done">Done</button></div>';
  }

  scrim.addEventListener("click", (e) => {
    if (e.target === scrim) { scrim.classList.remove("open"); return; }
    const t = e.target.closest("button");
    if (!t) return;
    const d = t.dataset;

    if (d.cm || d.cbg || d.cac) {
      if (d.cm) state.custom.mode = d.cm;
      if (d.cbg) state.custom.bg = Number(d.cbg);
      if (d.cac) state.custom.acc = Number(d.cac);
      applyPal("custom");
      save();
      drawCustom();
      return;
    }
    if (d.pal) {
      state.palette = d.pal;
      if (d.pal === "custom" && !state.custom) state.custom = { mode: "light", bg: 0, acc: 0 };
      applyPal(d.pal);
      save();
      if (d.pal === "custom") drawCustom(); else drawTheme();
      return;
    }
    if (d.act === "back") drawTheme();
    if (d.act === "done") scrim.classList.remove("open");
  });

  const topbar = document.querySelector(".topbar");
  const title = topbar && topbar.querySelector("h2");
  if (title) {
    const themeButton = document.createElement("button");
    themeButton.type = "button";
    themeButton.className = "mini";
    themeButton.textContent = "◐";
    themeButton.setAttribute("aria-label", "App style");
    themeButton.addEventListener("click", () => {
      drawTheme();
      scrim.classList.add("open");
    });
    title.after(themeButton);
  }

  // Highlight the active trip tab without changing app.js
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".workspace-navigation button");
    if (!b) return;
    b.parentElement.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
  });
  new MutationObserver(() => {
    document.querySelectorAll(".workspace-navigation").forEach((nav) => {
      if (!nav.querySelector("button.on") && nav.firstElementChild) {
        nav.firstElementChild.classList.add("on");
      }
    });
  }).observe(document.body, { childList: true, subtree: true });

  applyPal(state.palette || "classic");
})();
