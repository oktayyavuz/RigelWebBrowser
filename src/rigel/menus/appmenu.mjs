// Modlar ve Mod mağazası her yerden bulunsun diye:
//  - Uygulama (hamburger) menüsü: "Ayarlar"ın hemen üstüne "Modlar" ve "Mod mağazası" (ikonlu).
//  - Araç çubuğu düğmesi "Modlar" (CustomizableUI parçacığı, varsayılan yerleşimde yok; Özelleştir'den eklenir).
// Sağ tık menüsündeki öğeler toolbar.mjs'te. Mağaza ve modlar sayfaları: Rigel.mods.openStore(), Rigel.settings.open("modlar").
import { Disposer } from "../zen/util.mjs";

const WIDGET = "rigel-mods-button";

const openMods = (win) => (win.Rigel?.settings ? win.Rigel.settings.open("modlar") : win.openTrustedLinkIn("chrome://rigel/content/settings/settings.html#modlar", "tab"));
const openStore = (win) => (win.Rigel?.mods?.openStore ? win.Rigel.mods.openStore() : win.openTrustedLinkIn("chrome://rigel/content/store/store.html", "tab"));

function makeButton(doc, id, label, icon, run) {
  const b = doc.createXULElement("toolbarbutton");
  b.id = id;
  b.className = "subviewbutton";
  b.setAttribute("label", label);
  b.setAttribute("rigel-icon", icon);
  b.addEventListener("command", (e) => {
    run(doc.defaultView);
    // Hamburger paneli kapat
    doc.defaultView.PanelUI?.hide?.();
  });
  return b;
}

/** Ana görünüme (appMenu-mainView) düğmeleri ekler; görünüm ilk açılışta kurulabildiği için idempotent. */
function addAppMenuItems(win, d) {
  const doc = win.document;
  // Görünüm içeriği <template>/viewCache içinde durabilir; getElementById yerine PanelMultiView.getViewNode.
  const find = (id) => win.PanelMultiView?.getViewNode(doc, id) ?? doc.getElementById(id);
  if (find("rigel-appmenu-mods")) return true;
  const settings = find("appMenu-settings-button");
  if (!settings) return false;
  const mods = makeButton(doc, "rigel-appmenu-mods", "Modlar", "brush", openMods);
  const store = makeButton(doc, "rigel-appmenu-store", "Mod mağazası", "bag", openStore);
  settings.before(mods, store);
  d.add(() => { mods.remove(); store.remove(); });
  return true;
}

function createWidget(win) {
  const { CustomizableUI } = win;
  if (CustomizableUI.getWidget(WIDGET)?.provider === CustomizableUI.PROVIDER_API) return;
  CustomizableUI.createWidget({
    id: WIDGET,
    type: "custom",
    label: "Modlar",
    tooltiptext: "Modlar: arayüzü ve siteleri CSS modlarıyla özelleştir (Shift+tık: Mod mağazası)",
    removable: true,
    defaultArea: null, // varsayılan yerleşimde yok; Özelleştir ile eklenir
    onBuild(aDoc) {
      const b = aDoc.createXULElement("toolbarbutton");
      b.id = WIDGET;
      b.className = "toolbarbutton-1 chromeclass-toolbar-additional";
      b.setAttribute("label", "Modlar");
      b.setAttribute("tooltiptext", "Modlar: arayüzü ve siteleri CSS modlarıyla özelleştir (Shift+tık: Mod mağazası)");
      b.setAttribute("rigel-icon", "brush");
      b.addEventListener("click", (e) => {
        if (e.button !== 0) return;
        const w = aDoc.defaultView;
        if (e.shiftKey) openStore(w);
        else openMods(w);
      });
      return b;
    },
  });
}

export function init(win) {
  const d = new Disposer();
  try {
    createWidget(win);
  } catch (e) {
    win.dump(`[rigel] Modlar düğmesi oluşturulamadı: ${e}\n${e.stack}\n`);
  }
  // Hamburger görünümü ilk açılışta kurulur (PanelUI.ensureReady); kurulunca öğeleri ekle.
  if (!addAppMenuItems(win, d)) {
    const P = win.PanelUI;
    const orig = P?.ensureReady;
    if (typeof orig === "function" && !P.__rigelModsPatched) {
      P.__rigelModsPatched = true;
      P.ensureReady = async function (...args) {
        const r = await orig.apply(this, args);
        try {
          addAppMenuItems(win, d);
        } catch (e) {
          win.dump(`[rigel] hamburger öğeleri: ${e}\n`);
        }
        return r;
      };
      d.add(() => { P.ensureReady = orig; P.__rigelModsPatched = false; });
    }
  }
  return { destroy: () => d.run() };
}
