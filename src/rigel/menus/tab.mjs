// Sekme sağ tık menüsü (#tabContextMenu). Firefox menüyü geç yerelleştirir: etiketlere dokunmadan önce
// gBrowser.translateTabContextMenu() çağrılır. Firefox'a özgü öğeler gizlenir; Rigel öğeleri eklenir:
// "Alana taşı ›", "Temiz bağlantıyı kopyala"; "Sekmeyi boşalt" → "Sekmeyi uyut", "Yeni kapsayıcı sekmede aç" → "Kapsayıcıda yeniden aç".
import { Disposer } from "../zen/util.mjs";
import { cleanUrl } from "../search/cleanurl.mjs";
import { applyIcons, copyText, hideAll, padIcons, setLabel, tidySeparators, xul } from "./common.mjs";

const HIDE = [
  "context_askChat", "context_askChatSummarize", "context_createAITab", "context_aiSeparator",
  "context_shareSelectedTabs", "context_shareSelectedTabsSeparator",
  "context_sendTabToDevice", "context_sendTabToDeviceSeparator",
  "context_addNote", "context_editNote",
];

const ICONS = {
  context_openANewTab: "plus", context_moveTabToNewGroup: "folder", context_moveSplitViewToNewGroup: "folder",
  context_moveTabToGroup: "folder", context_ungroupTab: "folder", context_ungroupSplitView: "folder",
  context_moveTabToSplitView: "layout", context_separateSplitView: "layout", context_reverseSplitView: "layout",
  context_reloadTab: "reload", context_reloadSelectedTabs: "reload",
  context_playTab: "play", context_playSelectedTabs: "play",
  context_toggleMuteTab: "volume", context_toggleMuteSelectedTabs: "volume",
  context_pinTab: "pin", context_unpinTab: "pin", context_pinSelectedTabs: "pin", context_unpinSelectedTabs: "pin",
  context_unloadTab: "moon", context_duplicateTab: "copy", context_duplicateTabs: "copy",
  "rigel-tabctx-cleanlink": "cleanlink", "rigel-tabctx-space": "space",
  context_bookmarkSelectedTabs: "bookmark", context_bookmarkTab: "bookmark",
  context_moveTabOptions: "arrow", context_reopenInContainer: "container", context_selectAllTabs: "selectall",
  context_closeTab: "close", context_closeDuplicateTabs: "close", context_closeTabOptions: "close",
  context_undoCloseTab: "undo", context_fullscreenAutohide: "compact", context_fullscreenExit: "expand",
};

const LABELS = {
  context_unloadTab: ["Sekmeyi uyut", "u"],
  context_reopenInContainer: ["Kapsayıcıda yeniden aç", "K"],
  context_reloadTab: ["Sekmeyi yenile", "y"],
  context_reloadSelectedTabs: ["Sekmeleri yenile", "y"],
  context_undoCloseTab: ["Kapatılan sekmeyi geri aç", "g"],
};

export function init(win) {
  const doc = win.document;
  const menu = doc.getElementById("tabContextMenu");
  if (!menu) return { destroy() {} };
  const d = new Disposer();
  const R = () => win.Rigel;

  const translateOnce = () => {
    try {
      win.gBrowser.translateTabContextMenu?.();
    } catch {}
  };
  translateOnce();
  hideAll(doc, HIDE);

  const anchor = (id) => doc.getElementById(id);
  const insertAfter = (el, id) => {
    const a = anchor(id);
    if (a) a.after(el);
    else menu.append(el);
    d.add(() => el.remove());
    return el;
  };

  const targetTabs = () => {
    const t = win.TabContextMenu?.contextTab;
    if (!t) return [];
    return t.multiselected ? [...win.gBrowser.selectedTabs] : [t];
  };

  // Alana taşı ›
  const spaceMenu = xul(doc, "menu", { id: "rigel-tabctx-space", label: "Alana taşı" });
  const spacePopup = xul(doc, "menupopup", { id: "rigel-tabctx-space-popup" });
  spaceMenu.append(spacePopup);
  insertAfter(spaceMenu, "context_moveTabOptions");
  d.on(spacePopup, "popupshowing", (e) => {
    if (e.target !== spacePopup) return;
    spacePopup.replaceChildren();
    const sp = R()?.spaces;
    const tabs = targetTabs();
    const cur = tabs[0] ? sp?.spaceOf?.(tabs[0]) : null;
    for (const s of sp?.list?.() ?? []) {
      const it = xul(doc, "menuitem", { label: `${s.icon ?? ""}  ${s.name}`.trim(), type: "radio", name: "rigel-tabctx-space", checked: s.id === cur });
      it.addEventListener("command", () => {
        for (const t of targetTabs()) sp.moveTab(t, s.id);
      });
      spacePopup.append(it);
    }
  });

  // Temiz bağlantıyı kopyala
  const cleanLink = xul(doc, "menuitem", { id: "rigel-tabctx-cleanlink", label: "Temiz bağlantıyı kopyala" });
  cleanLink.addEventListener("command", () => {
    const urls = targetTabs()
      .map((t) => t.linkedBrowser?.currentURI?.spec)
      .filter((u) => /^https?:/.test(u ?? ""))
      .map(cleanUrl);
    if (urls.length) {
      copyText(urls.join("\n"));
      R()?.toast?.(urls.length > 1 ? "Temiz bağlantılar kopyalandı" : "Temiz bağlantı kopyalandı");
    }
  });
  insertAfter(cleanLink, "context_duplicateTabs");

  applyIcons(doc, ICONS);

  const relabel = () => {
    for (const [id, [text, key]] of Object.entries(LABELS)) setLabel(anchor(id), text, key);
  };
  const update = (e) => {
    if (e.target !== menu) return;
    translateOnce();
    relabel();
    // Kimliği olmayan, yalnız l10n kimliği olan Firefox öğeleri (Paylaş, cihaza gönder, yapay zekâ).
    for (const el of menu.children) {
      const l = el.getAttribute("data-l10n-id") ?? el.getAttribute("data-lazy-l10n-id") ?? "";
      if (/share|send-?to-?device|ask-?chat|ai-?tab/i.test(l)) el.setAttribute("rigel-hide", "");
    }
    const tabs = targetTabs();
    spaceMenu.hidden = !(R()?.spaces && (R().spaces.list?.().length ?? 0) > 1 && tabs.length && !tabs.some((t) => t.pinned));
    cleanLink.hidden = !tabs.some((t) => /^https?:/.test(t.linkedBrowser?.currentURI?.spec ?? ""));
    padIcons(menu);
    tidySeparators(menu);
  };
  d.on(menu, "popupshowing", update);
  d.on(menu, "popupshown", (e) => {
    if (e.target !== menu) return;
    // Firefox etiketleri ilk açılışta eşzamansız yerelleştirir; yerelleştirme bitince bizimkini yeniden yaz.
    relabel();
    win.setTimeout(relabel, 150);
    tidySeparators(menu);
  });

  return { destroy: () => d.run() };
}
