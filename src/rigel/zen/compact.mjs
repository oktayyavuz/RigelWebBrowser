// Kompakt mod: etkin düzenin çerçevesini (üst şerit, yan sütun, dock) gizler; fare ilgili ekran
// kenarına gelince gösterir, çıkınca yeniden gizler. Zen Browser'ın compact mode'undan fikir.
//
// - Tercih: rigel.compact (bool). Kökte data-rigel-compact; açılan kenarlar
//   data-rigel-compact-reveal="top bottom left" ile işaretlenir. Kurallar zen/zen.css'te.
// - Kenar algılama: içerik süreci fare olaylarını üst pencereye vermediği için her kenarda
//   birkaç piksellik saydam bir "sıcak bölge" var.
// - Açılır menü/panel açıkken ya da çerçevede odak (ör. adres çubuğu) varken gizlenmez.

import { Disposer, el } from "./util.mjs";

const PREF = "rigel.compact";
const HIDE_DELAY = 380;
const SHOW_DELAY = 70;

/** Düzene göre kenar → gösterilecek öğelerin kimlikleri. */
const EDGES = {
  ada: { top: ["navigator-toolbox"] },
  komuta: { top: ["navigator-toolbox"] },
  klasik: { top: ["navigator-toolbox"] },
  dock: { top: ["navigator-toolbox"], bottom: ["rigel-dock"] },
  yanpanel: { left: ["sidebar-container"] },
};

export function init(win) {
  const doc = win.document;
  const root = doc.documentElement;
  const d = new Disposer();
  Services.prefs.getDefaultBranch("").setBoolPref(PREF, false);

  const isOn = () => Services.prefs.getBoolPref(PREF, false);
  const layout = () => root.getAttribute("data-rigel-layout") || "";
  const edgesOf = () => EDGES[layout()] ?? { top: ["navigator-toolbox"] };
  const targets = edge => (edgesOf()[edge] ?? []).map(id => doc.getElementById(id)).filter(Boolean);

  const revealed = new Set();
  const hideTimers = {};
  const showTimers = {};

  function writeReveal() {
    if (revealed.size) root.setAttribute("data-rigel-compact-reveal", [...revealed].join(" "));
    else root.removeAttribute("data-rigel-compact-reveal");
  }

  function reveal(edge) {
    win.clearTimeout(hideTimers[edge]);
    if (!isOn() || revealed.has(edge)) return;
    revealed.add(edge);
    writeReveal();
  }

  function popupOpen() {
    for (const p of doc.querySelectorAll("menupopup, panel")) {
      if (p.state === "open" || p.state === "showing") return true;
    }
    return !!win.gURLBar?.view?.isOpen;
  }

  function busy(edge) {
    for (const t of targets(edge)) {
      if (t.matches(":hover") || t.matches(":focus-within")) return true;
    }
    if (edges[edge]?.matches(":hover")) return true;
    return popupOpen();
  }

  function scheduleHide(edge, delay = HIDE_DELAY) {
    win.clearTimeout(hideTimers[edge]);
    hideTimers[edge] = win.setTimeout(() => {
      if (!revealed.has(edge)) return;
      if (busy(edge)) return; // bir sonraki leave/popuphidden/focusout yeniden dener
      revealed.delete(edge);
      writeReveal();
    }, delay);
  }

  function hideAll() {
    for (const e of [...revealed]) {
      win.clearTimeout(hideTimers[e]);
      revealed.delete(e);
    }
    writeReveal();
  }

  // --- Sıcak bölgeler ----------------------------------------------------------
  const edges = {};
  for (const edge of ["top", "bottom", "left"]) {
    const z = el(doc, "div", { class: "rigel-compact-edge", "data-edge": edge });
    z.addEventListener("mouseenter", () => {
      win.clearTimeout(showTimers[edge]);
      showTimers[edge] = win.setTimeout(() => {
        if (z.matches(":hover")) reveal(edge);
      }, SHOW_DELAY);
    });
    z.addEventListener("mouseleave", () => {
      win.clearTimeout(showTimers[edge]);
      if (revealed.has(edge)) scheduleHide(edge);
    });
    // Sürükleme sırasında (sekme, bağlantı) da açılsın.
    z.addEventListener("dragenter", () => reveal(edge));
    edges[edge] = z;
    root.append(z);
    d.add(() => z.remove());
  }

  /** Bir olayın hangi kenarın öğesinde olduğunu bulur. */
  function edgeOfNode(node) {
    for (const [edge, ids] of Object.entries(edgesOf())) {
      for (const id of ids) {
        const t = doc.getElementById(id);
        if (t && node && t.contains(node)) return edge;
      }
    }
    return null;
  }

  // Öğelerin kendisi: üstündeyken açık kalsın, çıkınca gizlensin. (Düzen değişince öğeler
  // yeniden kurulduğu için dinleyiciler belgeye bağlı.)
  d.on(doc, "mouseover", e => {
    if (!isOn()) return;
    const edge = edgeOfNode(e.target);
    if (edge && revealed.has(edge)) win.clearTimeout(hideTimers[edge]);
  }, true);
  d.on(doc, "mouseout", e => {
    if (!isOn()) return;
    const edge = edgeOfNode(e.target);
    if (!edge || !revealed.has(edge)) return;
    if (e.relatedTarget && edgeOfNode(e.relatedTarget) === edge) return;
    scheduleHide(edge);
  }, true);
  // Klavye ile odak (Ctrl+L, Tab) gizli çerçeveye girerse göster; çıkınca gizle.
  d.on(doc, "focusin", e => {
    if (!isOn()) return;
    const edge = edgeOfNode(e.target);
    if (edge) reveal(edge);
  }, true);
  d.on(doc, "focusout", e => {
    if (!isOn()) return;
    const edge = edgeOfNode(e.target);
    if (edge && revealed.has(edge)) scheduleHide(edge);
  }, true);
  // Gizli çerçevedeki bir öğeye bağlı panel (izin istemi, uzantı, menü) açılırsa çerçeve görünsün.
  d.on(doc, "popupshowing", e => {
    if (!isOn()) return;
    const p = e.target;
    const edge = edgeOfNode(p.anchorNode) ?? edgeOfNode(p.triggerNode);
    if (edge) reveal(edge);
  }, true);
  d.on(doc, "popuphidden", () => {
    if (!isOn()) return;
    for (const edge of revealed) scheduleHide(edge);
  }, true);
  // Pencere dışına çıkınca (kenardan taşınca) bir süre açık kalır, sonra kapanır.
  d.on(root, "mouseleave", () => {
    for (const edge of revealed) scheduleHide(edge, HIDE_DELAY * 2);
  });

  function apply() {
    if (isOn()) root.setAttribute("data-rigel-compact", "true");
    else {
      root.removeAttribute("data-rigel-compact");
      hideAll();
    }
  }
  d.pref(PREF, apply);
  d.on(win, "rigel:layout-changed", () => hideAll());
  apply();

  const toggle = () => Services.prefs.setBoolPref(PREF, !isOn());
  const api = { toggle, isOn, set: v => Services.prefs.setBoolPref(PREF, !!v), reveal, hideAll };
  (win.Rigel ??= {}).compact = api;

  return {
    commands: () => [{
      id: "zen.compact",
      label: () => (isOn() ? "Kompakt modu kapat" : "Kompakt mod"),
      sub: "çerçeveyi gizle, kenara gelince göster",
      icon: "fullscreen",
      keys: ["Ctrl+Alt+C"],
      bind: true,
      run: toggle,
    }],
    destroy() {
      for (const t of [...Object.values(hideTimers), ...Object.values(showTimers)]) win.clearTimeout(t);
      root.removeAttribute("data-rigel-compact");
      root.removeAttribute("data-rigel-compact-reveal");
      d.run();
      if (win.Rigel?.compact === api) delete win.Rigel.compact;
    },
  };
}
