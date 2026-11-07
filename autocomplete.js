(function () {
  const SELECTOR =
    'input[placeholder="Street address or city"],' +
    'input[placeholder="Full street address"]';

  const style = document.createElement("style");
  style.textContent =
    ".ac-list{position:absolute;left:0;right:0;top:100%;margin:4px 0 0;padding:4px;list-style:none;" +
    "background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:12px;" +
    "box-shadow:0 8px 20px rgba(0,0,0,.2);z-index:30;max-height:240px;overflow:auto;" +
    "font-weight:400;text-align:left}" +
    ".ac-list li{padding:10px;border-radius:8px;font-size:14px;line-height:1.3}" +
    ".ac-list li b{display:block;font-weight:700}" +
    ".ac-list li small{color:var(--mute);font-size:13px}" +
    ".ac-list li:active{background:var(--bg)}";
  document.head.appendChild(style);

  function describe(p) {
    const street = [p.housenumber, p.street].filter(Boolean).join(" ");
    const area = [p.city || p.district || p.county, p.state].filter(Boolean).join(", ");
    const full = [...new Set([street || p.name, area, p.postcode, p.country].filter(Boolean))].join(", ");
    const title = p.name && p.name !== street ? p.name : street;
    const sub = [...new Set([street && street !== title ? street : "", area, p.country].filter(Boolean))].join(", ");
    return { full, title: title || full, sub };
  }

  function attach(input) {
    if (input.dataset.ac) return;
    input.dataset.ac = "1";
    input.autocomplete = "off";

    const holder = input.parentElement;
    holder.style.position = "relative";

    const list = document.createElement("ul");
    list.className = "ac-list";
    list.style.display = "none";
    holder.appendChild(list);

    let timer = null;
    let seq = 0;

    function hide() {
      list.style.display = "none";
      list.replaceChildren();
    }

    function render(results) {
      list.replaceChildren();
      if (!results.length || document.activeElement !== input) {
        hide();
        return;
      }
      results.forEach((r) => {
        const li = document.createElement("li");
        const b = document.createElement("b");
        b.textContent = r.title;
        li.appendChild(b);
        if (r.sub) {
          const s = document.createElement("small");
          s.textContent = r.sub;
          li.appendChild(s);
        }
        li.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          input.value = r.full;
          hide();
        });
        list.appendChild(li);
      });
      list.style.display = "block";
    }

    async function search(q) {
      const mine = ++seq;
      try {
        const res = await fetch(
          "https://photon.komoot.io/api/?limit=5&lang=en&q=" + encodeURIComponent(q)
        );
        if (!res.ok) return hide();
        const data = await res.json();
        if (mine !== seq) return;
        const seen = new Set();
        const results = (data.features || [])
          .map((f) => describe(f.properties || {}))
          .filter((r) => r.full && !seen.has(r.full) && seen.add(r.full));
        render(results);
      } catch (e) {
        hide();
      }
    }

    input.addEventListener("input", () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 3) {
        seq++;
        hide();
        return;
      }
      timer = setTimeout(() => search(q), 350);
    });

    input.addEventListener("blur", () => setTimeout(hide, 150));
  }

  function scan() {
    document.querySelectorAll(SELECTOR).forEach(attach);
  }

  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  scan();
})();
