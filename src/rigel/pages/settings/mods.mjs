// Ayarlar > Modlar: CSS modlarının listesi, ayar formu, düzenleyici (canlı önizleme), içe aktarma.
// Yönetici: chrome://userscripts/content/mods/manager.sys.mjs (tek örnek; pencereler de bunu kullanır).
import { h, icon, watch, onDispose, toggle, select, notify, chromeWin, openInTab, getPref, setPref } from "./ui.mjs";

const { Mods } = ChromeUtils.importESModule("chrome://userscripts/content/mods/manager.sys.mjs");

const TARGETS = { chrome: "Arayüz", content: "Web sayfaları", both: "Arayüz + Web" };
const btn = (text, onclick, cls = "soft", ic) => h("button", { type: "button", class: "btn " + cls, onclick }, ic && icon(ic, 14), text);

function pickPath(mode, title, cssFilter) {
  return new Promise(resolve => {
    try {
      const fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
      fp.init(window.browsingContext, title, mode);
      if (cssFilter) fp.appendFilter("CSS", "*.css");
      fp.open(r => resolve(r === Ci.nsIFilePicker.returnOK ? fp.file.path : null));
    } catch (e) {
      notify("Dosya seçici açılamadı: " + e.message, false);
      resolve(null);
    }
  });
}

/** Mod başına ayar denetimi (checkbox | dropdown | string). Değerler rigel.mods.values içinde. */
export function prefControl(mod, p) {
  const get = () => Mods.getValue(mod.id, p);
  const set = v => Mods.setValue(mod.id, p.key, v);
  const names = ["rigel.mods.values"];
  if (p.type === "checkbox") return toggle(null, { get, set, names });
  if (p.type === "dropdown") return select((p.options ?? []).map(o => [o.value, o.label]), { get, set, names });
  const input = h("input", { type: "text", class: "modstr", spellcheck: "false", value: String(get()) });
  let t;
  input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => set(input.value), 300); });
  input.addEventListener("change", () => { clearTimeout(t); set(input.value); });
  watch(names, () => { if (document.activeElement !== input) input.value = String(get()); });
  return input;
}

function badges(mod) {
  return [
    h("span", { class: "tbadge " + mod.target, text: TARGETS[mod.target] }),
    mod.builtin && h("span", { class: "tbadge builtin", text: "Yerleşik" }),
    mod.store && h("span", { class: "tbadge builtin", text: "Mağaza" }),
  ];
}

export function modlar() {
  const listBox = h("div", { class: "modlist" });
  const editorBox = h("div", {});
  let armed = null; // silme onayı bekleyen mod
  let editing = null; // düzenleyici durumu

  // ---- liste ----
  function renderList() {
    const mods = Mods.list();
    if (!mods.length) {
      listBox.replaceChildren(h("p", { class: "hint", text: "Henüz mod yok. \"Yeni mod\" ile kendi CSS'ini yaz ya da bir klasör / .css dosyası içe aktar." }));
      return;
    }
    listBox.replaceChildren(...mods.map(modItem));
  }
  function modItem(mod) {
    const sw = toggle(null, { get: () => Mods.isEnabled(mod.id), set: on => Mods.setEnabled(mod.id, on), names: ["rigel.mods.enabled"] });
    sw.setAttribute("aria-label", mod.name + " aç/kapat");
    const del = h("button", { type: "button", class: "iconbtn", title: "Sil", "aria-label": "Sil" }, icon("trash", 16));
    del.addEventListener("click", async () => {
      if (armed !== mod.id) {
        armed = mod.id;
        del.classList.add("armed");
        del.title = "Silmek için tekrar tıkla";
        setTimeout(() => { if (armed === mod.id) { armed = null; del.classList.remove("armed"); del.title = "Sil"; } }, 3000);
        return;
      }
      armed = null;
      if (editing?.id === mod.id) closeEditor();
      await Mods.remove(mod.id);
      notify(`"${mod.name}" silindi`);
    });
    const meta = [mod.author && `${mod.author}`, `v${mod.version}`].filter(Boolean).join(" · ");
    const head = h("div", { class: "row modhead" },
      h("span", { class: "txt" },
        h("b", {}, mod.name, badges(mod)),
        mod.description && h("small", { text: mod.description }),
        h("small", { class: "modmeta", text: meta })),
      h("span", { class: "modact" },
        h("button", { type: "button", class: "iconbtn", title: "Düzenle", "aria-label": "Düzenle", onclick: () => openEditor(mod.id) }, icon("edit", 16)),
        del, sw));
    const item = h("div", { class: "mod", "data-keywords": `${mod.name} ${mod.description} ${mod.author} mod css ${TARGETS[mod.target]} ${mod.builtin ? "yerleşik" : ""}` }, head);
    if (mod.prefs?.length) {
      const form = h("div", { class: "modprefs" }, mod.prefs.map(p => h("div", { class: "row sub" },
        h("span", { class: "txt" }, h("b", { text: p.label })), prefControl(mod, p))));
      form.append(h("div", { class: "row sub right" }, btn("Varsayılanlara dön", () => Mods.resetValues(mod.id), "ghost", "undo")));
      const sync = () => item.classList.toggle("off", !Mods.isEnabled(mod.id));
      sync();
      watch("rigel.mods.enabled", sync);
      item.append(form);
    }
    return item;
  }

  // ---- düzenleyici ----
  function closeEditor() {
    editing = null;
    Mods.clearPreview();
    editorBox.replaceChildren();
  }
  function openEditor(id) {
    const cur = id ? Mods.get(id) : null;
    editing = { id: id ?? null };
    const name = h("input", { type: "text", placeholder: "Mod adı", value: cur?.meta.name ?? "", "aria-label": "Mod adı" });
    const desc = h("input", { type: "text", placeholder: "Kısa açıklama (isteğe bağlı)", value: cur?.meta.description ?? "", "aria-label": "Açıklama" });
    const chrome = h("textarea", { class: "code", spellcheck: "false", rows: "9", "aria-label": "Arayüz CSS", placeholder: "/* Tarayıcı arayüzü için CSS */\n:root:root .tab-label { font-size: 12px !important; }" });
    const content = h("textarea", { class: "code", spellcheck: "false", rows: "9", "aria-label": "Web sayfası CSS", placeholder: "/* Web sayfaları için CSS */\nbody { font-family: serif !important; }" });
    chrome.value = cur?.chrome ?? "";
    content.value = cur?.content ?? "";
    let target = cur?.meta.target ?? "chrome";
    const preview = h("input", { type: "checkbox", class: "switch", role: "switch", checked: true, "aria-label": "Canlı önizleme" });
    const chromeWrap = h("label", { class: "field" }, h("span", { text: "Arayüz CSS (chrome)" }), chrome);
    const contentWrap = h("label", { class: "field" }, h("span", { text: "Web sayfası CSS (content)" }), content);
    const tseg = h("div", { class: "seg", role: "radiogroup" });
    const tbtns = Object.entries(TARGETS).map(([v, label]) => {
      const b = h("button", { type: "button", role: "radio", text: label, onclick: () => { target = v; refresh(); push(); } });
      b.dataset.v = v;
      return b;
    });
    tseg.append(...tbtns);
    const refresh = () => {
      for (const b of tbtns) { b.classList.toggle("on", b.dataset.v === target); b.setAttribute("aria-checked", b.dataset.v === target); }
      chromeWrap.hidden = target === "content";
      contentWrap.hidden = target === "chrome";
    };
    let t;
    const push = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (!editing) return;
        if (preview.checked) Mods.setPreview({ id: editing.id, target, chrome: chrome.value, content: content.value });
        else Mods.clearPreview();
      }, 120);
    };
    for (const el of [chrome, content]) el.addEventListener("input", push);
    preview.addEventListener("change", push);
    const save = async () => {
      const data = { name: name.value, description: desc.value, target, chrome: chrome.value, content: content.value };
      try {
        if (editing.id) await Mods.update(editing.id, data);
        else await Mods.create(data);
        notify(editing.id ? "Mod kaydedildi" : "Mod oluşturuldu ve açıldı");
        closeEditor();
      } catch (e) {
        notify("Kaydedilemedi: " + e.message, false);
      }
    };
    refresh();
    editorBox.replaceChildren(h("section", { class: "card editor" },
      h("div", { class: "chead" }, h("h2", { text: cur ? `Düzenle: ${cur.meta.name}` : "Yeni mod" })),
      h("div", { class: "edgrid" }, name, desc),
      h("div", { class: "row tight" }, h("span", { class: "txt" }, h("b", { text: "Hedef" }), h("small", { text: "Arayüz: tarayıcının kendisi. Web: tüm sitelerin sayfaları." })), tseg),
      chromeWrap, contentWrap,
      h("div", { class: "row tight" },
        h("span", { class: "txt" }, h("b", { text: "Canlı önizleme" }), h("small", { text: "Yazdıkça uygulanır; kaydetmezsen vazgeçince geri alınır." })), preview),
      h("div", { class: "edactions" }, btn(cur ? "Kaydet" : "Oluştur", save, "", "check"), btn("Vazgeç", closeEditor, "ghost")),
      h("p", { class: "hint", html: "CSS'te mod ayarlarına <code>--rigel-mod-&lt;id&gt;-&lt;anahtar&gt;</code> değişkeniyle ve (arayüzde) kökteki <code>rigel-mod-&lt;id&gt;-&lt;anahtar&gt;</code> özniteliğiyle ulaşılır. Ayar tanımları <code>mod.json</code> içindeki <code>prefs</code> listesindedir; mod klasöründen düzenleyebilirsin." })));
    push();
    name.focus();
    editorBox.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }

  // ---- içe aktar ----
  const importTarget = h("select", { class: "tsel", "aria-label": "İçe aktarılan CSS'in hedefi" },
    Object.entries(TARGETS).map(([v, l]) => h("option", { value: v, text: l })));
  const guard = fn => async () => {
    try { await fn(); } catch (e) { notify("İçe aktarılamadı: " + (e.message ?? e), false); }
  };
  const importFolder = guard(async () => {
    const p = await pickPath(Ci.nsIFilePicker.modeGetFolder, "Mod klasörünü seç");
    if (!p) return;
    const id = await Mods.importFolder(p);
    notify(`"${Mods.get(id)?.meta.name ?? id}" içe aktarıldı (kapalı)`);
  });
  const importCss = guard(async () => {
    const p = await pickPath(Ci.nsIFilePicker.modeOpen, ".css dosyasını seç", true);
    if (!p) return;
    const id = await Mods.importCss(p, importTarget.value);
    notify(`"${Mods.get(id)?.meta.name ?? id}" içe aktarıldı (kapalı)`);
  });

  const openStore = () => {
    const w = chromeWin();
    if (w?.Rigel?.mods?.openStore) w.Rigel.mods.openStore();
    else openInTab("chrome://rigel/content/store/store.html");
  };
  const storeUrl = h("input", { type: "text", class: "modstr", style: "width:min(340px,100%)", spellcheck: "false", placeholder: "https://…/index.json (boş: yalnız yerleşik mağaza)", "aria-label": "Uzak mağaza adresi", value: String(getPref("rigel.mods.storeUrl", "")) });
  storeUrl.addEventListener("change", () => {
    const v = storeUrl.value.trim();
    if (v && !/^https?:\/\//i.test(v)) { notify("Adres http:// ya da https:// ile başlamalı", false); storeUrl.value = String(getPref("rigel.mods.storeUrl", "")); return; }
    setPref("rigel.mods.storeUrl", v);
    notify(v ? "Mağaza adresi kaydedildi" : "Uzak mağaza kapatıldı");
  });

  const toolbar = h("section", { class: "card" },
    h("div", { class: "row tight", "data-keywords": "mod css yeni oluştur içe aktar klasör dosya userchrome usercontent" },
      h("span", { class: "txt" }, h("b", { text: "Modlar" }), h("small", { text: "Sade CSS dosyalarıyla arayüzü ve sayfaları dilediğin gibi değiştir. Açıp kapatınca hemen uygulanır." })),
      h("span", { class: "modact" }, btn("Mağazaya göz at", openStore, "soft", "brush"), btn("Yeni mod", () => openEditor(null), "", "plus"))),
    h("div", { class: "row tight", "data-keywords": "mağaza uzak adres dizin index.json katalog depo" },
      h("span", { class: "txt" }, h("b", { text: "Uzak mağaza adresi" }), h("small", { text: "Kendi ya da bir topluluk mod dizinin (index.json) adresi. Yerleşik mağazaya eklenir; boş bırakılabilir." })),
      storeUrl),
    h("div", { class: "toolrow" },
      btn("Klasörden içe aktar", importFolder, "soft", "import"),
      h("span", { class: "csspick" }, btn(".css dosyasından", importCss, "soft", "import"), h("span", { class: "tlabel", text: "hedef" }), importTarget),
      btn("Modlar klasörünü aç", () => Mods.revealFolder(), "ghost", "folder"),
      btn("Yenile", guard(async () => { await Mods.reload(); notify("Modlar yenilendi"); }), "ghost", "undo")));

  Mods.init().then(renderList);
  renderList();
  watch("topic:rigel-mods-list", renderList);
  onDispose(() => { if (editing) { editing = null; Mods.clearPreview(); } });

  return [toolbar, editorBox, h("section", { class: "card mods" }, listBox)];
}
