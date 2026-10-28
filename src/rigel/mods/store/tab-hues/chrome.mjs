// Sekme renkleri — Rigel modu (davranış). Her sekmeye sitenin ikonundan (olmazsa alan adı karmasından) bir renk atar:
// sekme öğesine ve Ada/Dock düğmelerine (`.tab` özelliği olanlar) `--rtc` değişkeni ile `rigel-hue` özniteliği yazar.
// Boyamayı chrome.css yapar. Temizlikte hepsi geri alınır.
export default function (api) {
  const { window: win, document: doc } = api;
  const gB = win.gBrowser;
  const XHTML = "http://www.w3.org/1999/xhtml";
  const useIcon = api.prefs.source !== "domain";
  const cache = new Map();
  const touched = new Set();
  let raf = 0;

  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const hsl = (h, s, l) => `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
  const hostOf = tab => {
    try { const u = tab.linkedBrowser?.currentURI; if (!u) return tab.label || ""; try { return u.asciiHost || u.spec; } catch { return u.spec; } } catch { return tab.label || ""; }
  };
  // Alan adının kök kısmı (www. ve alt alan adları aynı rengi versin)
  const domainColor = host => {
    const parts = String(host).replace(/^www\./, "").split(".");
    const base = parts.length > 2 ? parts.slice(-2).join(".") : parts.join(".");
    return hsl(hash(base || "rigel") % 360, 0.62, 0.55);
  };

  // 16x16'ya küçült, doygun pikselleri ağırlıkla ortala. Gri/tek renksiz ikonlarda null (alan adına düşer).
  function fromImage(src) {
    return new Promise(resolve => {
      const done = v => { win.clearTimeout(t); resolve(v); };
      const t = win.setTimeout(() => resolve(null), 3000);
      const img = new win.Image();
      img.onload = () => {
        try {
          const c = doc.createElementNS(XHTML, "canvas");
          c.width = c.height = 16;
          const x = c.getContext("2d", { willReadFrequently: true });
          x.drawImage(img, 0, 0, 16, 16);
          const d = x.getImageData(0, 0, 16, 16).data;
          let r = 0, g = 0, b = 0, w = 0, sat = 0, n = 0;
          for (let i = 0; i < d.length; i += 4) {
            const a = d[i + 3] / 255;
            if (a < 0.4) continue;
            const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
            const s = mx === 0 ? 0 : (mx - mn) / mx;
            const wt = a * (0.05 + s * s * 4);
            r += d[i] * wt; g += d[i + 1] * wt; b += d[i + 2] * wt; w += wt; sat += s; n++;
          }
          if (!n || sat / n < 0.14 || w <= 0) return done(null);
          r /= w * 255; g /= w * 255; b /= w * 255;
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn;
          let h = 0;
          if (dl > 0.001) h = mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4;
          h = (h * 60 + 360) % 360;
          done(hsl(h, 0.66, 0.54));
        } catch { done(null); }
      };
      img.onerror = () => done(null);
      img.src = src;
    });
  }

  function colorFor(tab) {
    const host = hostOf(tab);
    const icon = useIcon ? tab.getAttribute("image") || "" : "";
    const key = icon ? "i:" + icon : "h:" + host;
    let c = cache.get(key);
    if (c) return c;
    c = domainColor(host || tab.label || "");
    cache.set(key, c);
    if (icon) fromImage(icon).then(v => { if (v) { cache.set(key, v); schedule(); } });
    return c;
  }

  const setHue = (el, c) => { el.style.setProperty("--rtc", c); el.setAttribute("rigel-hue", ""); touched.add(el); };
  function paint() {
    raf = 0;
    for (const el of touched) if (!el.isConnected) touched.delete(el);
    for (const tab of gB.tabs) setHue(tab, colorFor(tab));
    for (const n of doc.querySelectorAll('[role="tab"]')) if (n.tab) setHue(n, colorFor(n.tab));
  }
  function schedule() { if (!raf) raf = win.requestAnimationFrame(paint); }

  for (const t of ["TabOpen", "TabAttrModified", "TabSelect", "TabMove", "TabPinned", "TabUnpinned"]) api.listen(gB.tabContainer, t, schedule);
  const mo = new win.MutationObserver(schedule);
  mo.observe(doc.documentElement, { childList: true, subtree: true });
  paint();
  api.setInterval(schedule, 4000); // yavaş yüklenen ikonlar için güvenlik ağı

  return () => {
    mo.disconnect();
    if (raf) win.cancelAnimationFrame(raf);
    for (const el of doc.querySelectorAll("[rigel-hue]")) { el.removeAttribute("rigel-hue"); el.style.removeProperty("--rtc"); }
    touched.clear();
  };
}
