// Sağ çekmeceler (380 px, sağdan kayar): sekme paneli ve indirmeler. Rigel.drawers.toggle(name).
// Dışarı tıklama ya da Esc kapatır. Aynı anda tek çekmece açık.
import { el } from "../commands/ui.mjs";
import { createTabsPanel } from "./tabs.mjs";
import { createDownloadsPanel } from "./downloads.mjs";

export function createDrawers(win) {
  const doc = win.document;
  let root = null, shell = null;
  let current = null;
  const panels = {};

  function build() {
    shell = el(doc, "div", { class: "rgl-drawer" });
    root = el(doc, "div", { id: "rigel-drawer", hidden: true }, shell);
    root.addEventListener("mousedown", (e) => { if (e.target === root) { e.preventDefault(); close(); } });
    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !e.defaultPrevented) { e.preventDefault(); close(); }
    });
    doc.documentElement.append(root);
    panels.tabs = createTabsPanel(win, api);
    panels.downloads = createDownloadsPanel(win, api);
  }

  function open(name) {
    if (!root) build();
    const p = panels[name];
    if (!p) throw new Error(`Rigel.drawers: bilinmeyen çekmece "${name}"`);
    win.Rigel?.palette?.close?.({ restoreFocus: false });
    if (current && current !== name) panels[current].hide();
    current = name;
    shell.replaceChildren(p.element);
    root.setAttribute("panel", name);
    root.hidden = false;
    // Kayma animasyonu için bir kare bekle.
    win.requestAnimationFrame(() => root.setAttribute("open", "true"));
    p.show();
  }

  function close({ restoreFocus = true } = {}) {
    if (!root || root.hidden) return;
    panels[current]?.hide();
    root.removeAttribute("open");
    current = null;
    root.hidden = true;
    if (restoreFocus) win.gBrowser.selectedBrowser.focus();
  }

  const toggle = (name) => (current === name ? close() : open(name));
  const api = { open, close, toggle, current: () => current, isOpen: () => !!current };
  build();
  return api;
}
