// Sayfa içeriği sağ tık menüsü (#contentAreaContextMenu): Rigel'e göre ayıklanmış.
//  - Firefox'a özgü / gürültü öğeler (cihaza gönder, akıllı pencere, ön izleme, e-posta ile gönder, ...) gizlenir.
//  - Rigel öğeleri eklenir: bağlantıyı alanda aç, temiz bağlantıyı kopyala, seçim için ara (motor + bang'ler),
//    sayfayı çevir, temiz adresi kopyala. Göz at (glance.mjs) ve kapsayıcıda aç (Firefox'un kendi alt menüsü) yeniden adlandırılır.
//  - Her açılışta `popupshowing` ile görünürlük yeniden hesaplanır; öğeler yalnız bir kez eklenir.
import { Disposer } from "../zen/util.mjs";
import { cleanUrl, stripTracking } from "../search/cleanurl.mjs";
import { parseBang } from "../search/bangs.mjs";
import { allBangs, bangSettings, refreshEngine, searchEngine } from "../palette/settings.mjs";
import {
  applyIcons, copyText, hideAll, isHttp, padIcons, setIcon, setLabel, tidySeparators, truncate, xul,
} from "./common.mjs";

const HIDE = [
  "context-openlinkincontainertab", "context-openlinkinsplitview", "context-openlinksmartwindow", "context-previewlink",
  "context-sendlinktodevice", "context-sep-sendlinktodevice", "context-stripOnShareLink",
  "context-media-hidecontrols", "context-media-showcontrols", "context-sendimage", "context-sendvideo", "context-sendaudio",
  "context-reloadimage", "context-viewimageinfo", "context-viewimagedesc", "context-visual-search",
  "context-setDesktopBackground", "context-sep-setbackground",
  "use-relay-mask", "manage-saved-logins", "context-use-mini-window", "context-ask-chat", "context-create-aitab",
  "context-searchselect", "context-searchselect-private", "context-print-selection", "context-viewpartialsource-selection",
  "context-inspect-a11y", "context-sendpagetodevice", "context-sep-sendpagetodevice",
  "context-media-eme-separator", "context-media-eme-learnmore",
  "context-bidi-text-direction-toggle", "context-bidi-page-direction-toggle", "context-sep-bidi",
  "spell-add-dictionaries-main", "context-copy-link-to-highlight",
];

const ICONS = {
  "context-back": "back", "context-forward": "forward", "context-reload": "reload", "context-stop": "stop",
  "context-bookmarkpage": "bookmark",
  "context-openlinkincurrent": "external", "context-openlinkintab": "tab", "rigel-context-glance": "eye",
  "context-openlinkinusercontext-menu": "container", "rigel-ctx-space": "space",
  "context-openlink": "window", "context-openlinkprivate": "mask",
  "context-bookmarklink": "bookmark", "context-savelink": "download", "context-copyemail": "mail",
  "context-copyphone": "phone", "context-copylink": "link", "rigel-ctx-cleanlink": "cleanlink",
  "context-media-play": "play", "context-media-pause": "pause", "context-media-mute": "volumeOff",
  "context-media-unmute": "volume", "context-media-playbackrate": "speed", "context-media-loop": "loop",
  "context-video-fullscreen": "expand", "context-leave-dom-fullscreen": "expand", "context-viewvideo": "external",
  "context-video-pictureinpicture": "pip", "context-viewimage": "external", "context-saveimage": "download",
  "context-video-saveimage": "capture", "context-savevideo": "download", "context-saveaudio": "download",
  "context-copyimage-contents": "image", "context-copyimage": "link", "context-copyvideourl": "link",
  "context-copyaudiourl": "link", "context-imagetext": "text",
  "context-savepage": "download", "rigel-ctx-translate": "translate", "rigel-ctx-cleanpage": "cleanlink",
  "fill-login": "key", "fill-login-generated-password": "key",
  "context-undo": "undo", "context-redo": "redo", "context-cut": "cut", "context-copy": "copy",
  "context-paste": "paste", "context-paste-no-formatting": "paste", "context-delete": "trash",
  "context-selectall": "selectall", "context-reveal-password": "eye",
  "context-copy-link-to-highlight": "link", "context-copy-clean-link-to-highlight": "cleanlink",
  "context-remove-highlight": "highlight", "context-take-screenshot": "capture", "context-add-engine": "plus",
  "rigel-ctx-search": "search", "context-translate-selection": "translate",
  "frame": "layout", "spell-dictionaries": "globe", "context-viewsource": "code", "context-inspect": "inspect",
};

// Firefox'un İngilizce / yarı Türkçe etiketleri yerine Rigel'in dili.
const LABELS = {
  "context-video-pictureinpicture": ["Resim içinde resim", "R"],
  "context-take-screenshot": ["Ekran görüntüsü", "E"],
  "context-openlinkinusercontext-menu": ["Bağlantıyı kapsayıcıda aç", "k"],
  "context-viewsource": ["Sayfa kaynağı", "S"],
  "context-inspect": ["İncele", "N"],
  "context-savepage": ["Sayfayı kaydet…", "f"],
  "context-video-saveimage": ["Geçerli kareyi kaydet…", "k"],
  "context-copy-clean-link-to-highlight": ["Vurgunun bağlantısını kopyala", "V"],
};

const TOP_BANGS = ["yt", "wtr", "gh", "so", "mdn", "eksi", "ddg"];

export function init(win) {
  const doc = win.document;
  const menu = doc.getElementById("contentAreaContextMenu");
  if (!menu) return { destroy() {} };
  const d = new Disposer();
  const R = () => win.Rigel;
  const added = [];
  const add = (el, anchorId, where = "after") => {
    const a = doc.getElementById(anchorId);
    if (a) a[where](el);
    else menu.append(el);
    added.push(el);
    d.add(() => el.remove());
    return el;
  };

  hideAll(doc, HIDE);

  // --- Rigel öğeleri -------------------------------------------------------------
  const item = (id, label, command, extra = {}) => {
    const e = xul(doc, "menuitem", { id, label, ...extra });
    e.addEventListener("command", command);
    return e;
  };

  // Bağlantıyı alanda aç ›
  const spaceMenu = xul(doc, "menu", { id: "rigel-ctx-space", label: "Bağlantıyı alanda aç" });
  const spacePopup = xul(doc, "menupopup", { id: "rigel-ctx-space-popup" });
  spaceMenu.append(spacePopup);
  add(spaceMenu, "context-openlinkinusercontext-menu");
  d.on(spacePopup, "popupshowing", (e) => {
    if (e.target !== spacePopup) return;
    spacePopup.replaceChildren();
    const sp = R()?.spaces;
    const cur = sp?.active?.();
    for (const s of sp?.list?.() ?? []) {
      const it = xul(doc, "menuitem", { label: `${s.icon ?? ""}  ${s.name}`.trim(), type: "radio", name: "rigel-ctx-space", checked: s.id === cur });
      it.addEventListener("command", () => openLinkInSpace(s.id));
      spacePopup.append(it);
    }
  });
  function openLinkInSpace(spaceId) {
    const cm = win.gContextMenu;
    const url = cm?.linkURL;
    if (!url) return;
    const params = {
      inBackground: true,
      resolveOnNewTabCreated: (browser) => {
        const tab = win.gBrowser.getTabForBrowser(browser);
        if (tab) R()?.spaces?.moveTab?.(tab, spaceId);
      },
      ...(cm._getGlobalHistoryOptions?.() ?? {}),
    };
    win.openLinkIn(url, "tab", cm._openLinkInParameters ? cm._openLinkInParameters(params) : {
      ...params, triggeringPrincipal: cm.principal, csp: cm.csp,
    });
  }

  // Temiz bağlantıyı kopyala (bağlantı) ve temiz adresi kopyala (sayfa)
  const cleanLink = add(item("rigel-ctx-cleanlink", "Temiz bağlantıyı kopyala", () => {
    const u = win.gContextMenu?.linkURL;
    if (u) {
      copyText(cleanUrl(u));
      R()?.toast?.("Temiz bağlantı kopyalandı");
    }
  }), "context-copylink");
  const cleanPage = add(item("rigel-ctx-cleanpage", "Temiz adresi kopyala", () => {
    const u = win.gBrowser.selectedBrowser?.currentURI?.spec;
    if (u) {
      copyText(cleanUrl(u));
      R()?.toast?.("Temiz adres kopyalandı");
    }
  }), "context-savepage");

  // Sayfayı çevir
  const translate = add(item("rigel-ctx-translate", "Sayfayı çevir", () => R()?.commands?.run?.("translate")), "context-savepage", "before");

  // “seçim” için ara ›
  const searchMenu = xul(doc, "menu", { id: "rigel-ctx-search", label: "Ara" });
  const searchPopup = xul(doc, "menupopup", { id: "rigel-ctx-search-popup" });
  searchMenu.append(searchPopup);
  add(searchMenu, "context-selectall", "before");
  // Seçimle ilgili eylemler (Kopyala, ara, çevir) bir arada dursun.
  {
    const tr = doc.getElementById("context-translate-selection");
    if (tr) searchMenu.after(tr);
  }
  const selectedText = () => {
    const cm = win.gContextMenu;
    return (cm?.selectionInfo?.fullText ?? cm?.selectedText ?? "").replace(/\s+/g, " ").trim();
  };
  const openUrl = (url, priv = false) =>
    win.openTrustedLinkIn(url, priv ? "window" : "tab", priv ? { private: true } : {});
  const engineUrl = (q) => {
    try {
      const u = searchEngine().ref?.getSubmission(q)?.uri?.spec;
      if (u) return u;
    } catch {}
    return parseBang(`!ddg ${q}`)?.url ?? `https://duckduckgo.com/?q=${encodeURIComponent(q)}`;
  };
  d.on(searchPopup, "popupshowing", (e) => {
    if (e.target !== searchPopup) return;
    searchPopup.replaceChildren();
    const q = selectedText();
    if (!q) return;
    const eng = searchEngine();
    const first = xul(doc, "menuitem", { label: eng.name || "Varsayılan motor", class: "menuitem-iconic", ...(eng.icon ? { image: eng.icon } : {}) });
    first.addEventListener("command", () => openUrl(engineUrl(q)));
    searchPopup.append(first);

    // Bang'ler: önce kullanıcınınkiler (en çok 3), sonra seçilmiş yerleşikler.
    const bangs = allBangs();
    const picks = [...bangs.filter((b) => b.custom).slice(0, 3)];
    for (const t of TOP_BANGS) {
      const b = bangs.find((x) => !x.custom && x.trigger === t);
      if (b && picks.length < 8) picks.push(b);
    }
    if (picks.length) searchPopup.append(xul(doc, "menuseparator"));
    for (const b of picks) {
      const it = xul(doc, "menuitem", { label: b.name, acceltext: `!${b.trigger}` });
      it.addEventListener("command", () => {
        const url = parseBang(`!${b.trigger} ${q}`, bangSettings().customBangs)?.url;
        if (url) openUrl(url);
      });
      searchPopup.append(it);
    }
    searchPopup.append(xul(doc, "menuseparator"));
    const priv = xul(doc, "menuitem", { label: "Gizli pencerede ara" });
    priv.addEventListener("command", () => openUrl(engineUrl(q), true));
    searchPopup.append(priv);
  });
  refreshEngine().catch(() => {});

  applyIcons(doc, ICONS);

  // --- Her açılışta ----------------------------------------------------------------
  const update = (e) => {
    if (e.target !== menu) return;
    const cm = win.gContextMenu;
    if (!cm) return;
    for (const [id, [text, key]] of Object.entries(LABELS)) setLabel(doc.getElementById(id), text, key);

    const webLink = !!cm.onLink && !cm.onMailtoLink && !cm.onTelLink && isHttp(cm.linkURL);
    const spaces = R()?.spaces?.list?.() ?? [];
    spaceMenu.hidden = !(webLink && spaces.length > 1);
    cleanLink.hidden = !(webLink && !!stripTracking(cm.linkURL));

    const pageUrl = win.gBrowser.selectedBrowser?.currentURI?.spec ?? "";
    const plainPage = !cm.onLink && !cm.onImage && !cm.onVideo && !cm.onAudio && !cm.onCanvas
      && !cm.onTextInput && !cm.onEditable && !cm.isContentSelected && !cm.inSyntheticDoc && isHttp(pageUrl);
    cleanPage.hidden = !plainPage;
    translate.hidden = !plainPage;
    if (plainPage) {
      const lbl = R()?.commands?.list?.()?.find?.((c) => c.id === "translate")?.label;
      setLabel(translate, lbl || "Sayfayı çevir");
    }

    // “seçim” için ara: Firefox'un kendi arama öğesinin görünürlüğünü izler (aynı koşullar).
    const q = selectedText();
    const nativeShown = !doc.getElementById("context-searchselect")?.hidden;
    searchMenu.hidden = !(q && nativeShown);
    if (q) setLabel(searchMenu, `“${truncate(q, 24)}” için ara`);

    padIcons(menu);
    tidySeparators(menu);
  };
  d.on(menu, "popupshowing", update);
  // Bazı öğeleri Firefox popup açıldıktan sonra (eşzamansız) gösterir; ayraçları tekrar düzelt.
  d.on(menu, "popupshown", (e) => {
    if (e.target === menu) {
      padIcons(menu);
      tidySeparators(menu);
    }
  });

  return { destroy: () => d.run() };
}
