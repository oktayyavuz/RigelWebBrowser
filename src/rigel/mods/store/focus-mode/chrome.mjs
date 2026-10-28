// Odak modu — Rigel modu (davranış). Bütün arayüzü gizler; imleç kenara gelince geçici gösterir.
// Rigel'in betik API'si (mods/STORE.md): window, document, prefs, onPrefChange, onLayoutChange, addStyle, commands, addToolbarButton, toast.
export default function (api) {
  const { window: win, document: doc } = api;
  const root = doc.documentElement;
  const XHTML = "http://www.w3.org/1999/xhtml";
  let on = false;
  let revealed = null; // "top" | "bottom" | "left"
  let timer = null;
  let parsed = parseKeys(api.prefs.shortcut);

  function parseKeys(s) {
    const parts = String(s || "").split("+").map(x => x.trim().toLowerCase()).filter(Boolean);
    const key = parts.pop() ?? "";
    return { ctrl: parts.includes("ctrl") || parts.includes("control"), alt: parts.includes("alt"), shift: parts.includes("shift"), meta: parts.includes("meta") || parts.includes("cmd"), key };
  }
  const matches = (e, k) => k.key && e.ctrlKey === k.ctrl && e.altKey === k.alt && e.shiftKey === k.shift && e.metaKey === k.meta
    && (e.key.toLowerCase() === k.key || e.code.toLowerCase() === "key" + k.key || e.code.toLowerCase() === k.key);

  // Gizleme: kenarlara yaslı yüzer çubuklar; kenar "sıcak bölgeleri" imleci yakalar (web içeriği ayrı süreçte olduğundan
  // imleç olaylarını yalnız bu öğeler alır).
  api.addStyle(`
    :root[rigel-focus-mode]:not([inDOMFullscreen]) #navigator-toolbox {
      position: fixed !important; top: 0 !important; inset-inline: 0 !important; z-index: 10 !important;
      transform: translateY(calc(-100% - 4px)) !important; transition: transform 200ms cubic-bezier(.2,.8,.2,1) !important;
      box-shadow: none !important;
    }
    :root[rigel-focus-mode][rigel-focus-reveal="top"] #navigator-toolbox { transform: none !important; box-shadow: var(--shadow, 0 8px 28px rgba(0,0,0,.4)) !important; }
    :root[rigel-focus-mode][data-rigel-layout="dock"]:not([inDOMFullscreen]) #rigel-dock {
      position: fixed !important; bottom: 0 !important; inset-inline: 0 !important; z-index: 10 !important;
      transform: translateY(calc(100% + 4px)) !important; transition: transform 200ms cubic-bezier(.2,.8,.2,1) !important;
    }
    :root[rigel-focus-mode][data-rigel-layout="dock"][rigel-focus-reveal="bottom"] #rigel-dock { transform: none !important; box-shadow: var(--shadow, 0 -8px 28px rgba(0,0,0,.4)) !important; }
    :root[rigel-focus-mode][data-rigel-layout="yanpanel"]:not([inDOMFullscreen]) #sidebar-container {
      position: fixed !important; top: 0 !important; bottom: 0 !important; left: 0 !important; z-index: 10 !important;
      transform: translateX(calc(-100% - 4px)) !important; transition: transform 200ms cubic-bezier(.2,.8,.2,1) !important;
    }
    :root[rigel-focus-mode][data-rigel-layout="yanpanel"][rigel-focus-reveal="left"] #sidebar-container { transform: none !important; box-shadow: var(--shadow, 8px 0 28px rgba(0,0,0,.4)) !important; }
    :root[rigel-focus-mode][data-rigel-layout="yanpanel"] #tabbrowser-tabbox { margin: 0 !important; border-radius: 0 !important; border: none !important; }
    :root[rigel-focus-mode] #PersonalToolbar { display: none !important; }
    :root[rigel-focus-mode] #tabbrowser-tabbox { padding: 0 !important; }
    :root[rigel-focus-mode] #tabbrowser-tabpanels :is(.browserContainer, .browserStack) { border-radius: 0 !important; box-shadow: none !important; }
    .rigel-focus-edge { position: fixed; z-index: 11; background: transparent; display: none; }
    :root[rigel-focus-mode]:not([inDOMFullscreen]) .rigel-focus-edge { display: block; }
    .rigel-focus-edge[data-edge="top"] { top: 0; inset-inline: 0; height: var(--rigel-mod-focus-mode-edge, 6px); }
    .rigel-focus-edge[data-edge="bottom"] { bottom: 0; inset-inline: 0; height: var(--rigel-mod-focus-mode-edge, 6px); }
    .rigel-focus-edge[data-edge="left"] { top: 0; bottom: 0; left: 0; width: var(--rigel-mod-focus-mode-edge, 6px); }
    @media (prefers-reduced-motion: reduce) { :root[rigel-focus-mode] :is(#navigator-toolbox, #rigel-dock, #sidebar-container) { transition: none !important; } }
  `);

  const edges = {};
  for (const e of ["top", "bottom", "left"]) {
    const z = doc.createElementNS(XHTML, "div");
    z.className = "rigel-focus-edge";
    z.dataset.edge = e;
    z.addEventListener("mouseenter", () => reveal(e));
    z.addEventListener("dragenter", () => reveal(e));
    root.append(z);
    edges[e] = z;
  }
  const edgeOfLayout = () => (api.layout === "dock" ? "bottom" : api.layout === "yanpanel" ? "left" : "top");
  const panelOf = e => doc.getElementById(e === "bottom" ? "rigel-dock" : e === "left" ? "sidebar-container" : "navigator-toolbox");

  function reveal(e) {
    if (!on) return;
    win.clearTimeout(timer);
    if (revealed !== e) { revealed = e; root.setAttribute("rigel-focus-reveal", e); }
  }
  const busy = () => !!(win.gURLBar?.focused || win.gURLBar?.view?.isOpen || doc.querySelector("panel[panelopen], menupopup[state=open]"));
  function scheduleHide() {
    win.clearTimeout(timer);
    timer = win.setTimeout(() => {
      if (busy()) return scheduleHide();
      revealed = null;
      root.removeAttribute("rigel-focus-reveal");
    }, api.prefs.delay);
  }
  // Üst (ya da alt/sol) çubuktan çıkınca gizle; üstündeyken açık kalsın.
  for (const id of ["navigator-toolbox", "rigel-dock", "sidebar-container"]) {
    const n = doc.getElementById(id);
    if (!n) continue;
    api.listen(n, "mouseleave", () => { if (revealed) scheduleHide(); });
    api.listen(n, "mouseenter", () => { win.clearTimeout(timer); });
    api.listen(n, "focusin", () => { if (on && id === panelOf(edgeOfLayout())?.id) reveal(edgeOfLayout()); });
  }
  // Adres çubuğuna odak (Ctrl+L, palet) çubuğu açar.
  api.listen(win, "focusin", e => { if (on && panelOf(edgeOfLayout())?.contains(e.target)) reveal(edgeOfLayout()); }, true);

  function setOn(v, silent) {
    on = !!v;
    win.clearTimeout(timer);
    revealed = null;
    root.removeAttribute("rigel-focus-reveal");
    if (on) root.setAttribute("rigel-focus-mode", ""); else root.removeAttribute("rigel-focus-mode");
    if (!silent && api.prefs.hint) api.toast(on ? `Odak modu açık (${api.prefs.shortcut} ile çık)` : "Odak modu kapalı");
  }
  const toggle = () => setOn(!on);

  api.listen(win, "keydown", e => { if (matches(e, parsed)) { e.preventDefault(); e.stopPropagation(); toggle(); } }, true);
  api.commands.register({ id: "toggle", label: "Odak modu: aç / kapat", sub: api.prefs.shortcut, icon: "eye", run: toggle });
  api.addToolbarButton({ id: "toggle", icon: "◐", label: "Odak modu", onClick: toggle });
  api.onPrefChange(() => { parsed = parseKeys(api.prefs.shortcut); });
  api.onLayoutChange(() => { if (on) setOn(true, true); });
  if (api.prefs.hint) api.toast(`Odak modu hazır: ${api.prefs.shortcut}`);

  return () => {
    win.clearTimeout(timer);
    root.removeAttribute("rigel-focus-mode");
    root.removeAttribute("rigel-focus-reveal");
    for (const z of Object.values(edges)) z.remove();
  };
}
