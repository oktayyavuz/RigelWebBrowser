// Rigel iletişim kutuları: Services.prompt yerine pencere içinde kart (palet görünümünde).
//
//   Rigel.dialog.prompt({ title, label, value, placeholder, okLabel, required, message })  → Promise<string | null>
//   Rigel.dialog.confirm({ title, message, okLabel, cancelLabel, danger })                  → Promise<boolean>
//   Rigel.dialog.pick({ title, label, options, value, columns, custom })                    → Promise<değer | null>
//   Rigel.dialog.form({ title, message, okLabel, fields: [...] })                           → Promise<{ [anahtar]: değer } | null>
//
// pick/seçenekler: ["🪐", "💼"] ya da [{ value, label?, title? }]. `custom: true` (varsayılan) bir "başka simge"
// kutusu ekler. form alanları: { key, type: "text" | "pick", label, value, placeholder, required, options, columns, custom }.
// Esc / dışarı tık: iptal (null / false). Enter: onay. Tab odağı kartın içinde döner. Aynı anda tek kutu
// açılır, ötekiler sıraya girer. Renkler yalnız tema belirteçlerinden (shell/dialog.css).

import { el } from "./common.mjs";

const SHEET = "chrome://userscripts/content/shell/dialog.css";
const instances = new WeakMap();

/** Pencere başına tek örnek; win.Rigel.dialog olarak da yayımlanır. */
export function getDialog(win) {
  let inst = instances.get(win);
  if (!inst) {
    inst = createDialog(win);
    instances.set(win, inst);
  }
  (win.Rigel ??= {}).dialog = inst;
  return inst;
}

const firstGrapheme = text => {
  const s = String(text ?? "").trim();
  if (!s) return "";
  try {
    for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)) return segment;
  } catch {}
  return [...s][0] ?? "";
};

function createDialog(win) {
  const doc = win.document;
  let chain = Promise.resolve();
  let loaded = false;
  let current = null; // { close(result) }

  function ensureSheet() {
    if (loaded) return;
    loaded = true;
    win.windowUtils.loadSheetUsingURIString(SHEET, win.windowUtils.AUTHOR_SHEET);
  }

  function open(spec) {
    const run = () => show(spec);
    const p = chain.then(run, run);
    chain = p.then(() => {}, () => {});
    return p;
  }

  /** Alan çizicileri: her biri { node, get(), focus(), valid() } döndürür. */
  function buildField(f, submit) {
    if (f.type === "pick") return buildPick(f, submit);
    const input = el(doc, "input", {
      type: "text", class: "rgl-dlg-input", spellcheck: "false", autocomplete: "off",
      placeholder: f.placeholder ?? "", value: f.value ?? "",
    });
    const node = el(doc, "label", { class: "rgl-dlg-field" },
      f.label ? el(doc, "span", { class: "rgl-dlg-lbl", text: f.label }) : null, input);
    return {
      node,
      input,
      get: () => input.value.trim(),
      focus: () => {
        input.focus();
        input.select();
      },
      valid: () => !f.required || input.value.trim() !== "",
      onChange: fn => input.addEventListener("input", fn),
    };
  }

  function buildPick(f, submit) {
    const opts = (f.options ?? []).map(o => (typeof o === "object" ? o : { value: o }));
    const cols = f.columns ?? 6;
    let value = f.value ?? opts[0]?.value ?? "";
    const listeners = [];
    const grid = el(doc, "div", { class: "rgl-dlg-grid", role: "radiogroup", "aria-label": f.label ?? "" });
    grid.style.setProperty("--cols", String(cols));
    const buttons = opts.map(o => el(doc, "button", {
      type: "button", class: "rgl-dlg-opt", role: "radio", title: o.title ?? o.label ?? "",
      onclick: () => choose(o.value),
      ondblclick: () => {
        choose(o.value);
        submit();
      },
    }, el(doc, "span", { text: o.label ?? String(o.value) })));
    grid.append(...buttons);
    let custom = null;
    if (f.custom !== false) {
      custom = el(doc, "input", {
        type: "text", class: "rgl-dlg-input rgl-dlg-custom", spellcheck: "false", autocomplete: "off",
        placeholder: "Başka", title: "Listede olmayan bir simge yaz", maxlength: "12",
      });
      custom.addEventListener("input", () => {
        const g = firstGrapheme(custom.value);
        if (g) {
          value = g;
          sync(true);
          listeners.forEach(fn => fn());
        }
      });
    }
    function sync(fromCustom = false) {
      const idx = opts.findIndex(o => o.value === value);
      buttons.forEach((b, i) => {
        b.setAttribute("aria-checked", String(i === idx));
        b.tabIndex = i === (idx >= 0 ? idx : 0) ? 0 : -1;
      });
      if (custom && !fromCustom) custom.value = idx >= 0 ? "" : value;
    }
    function choose(v) {
      value = v;
      sync();
      listeners.forEach(fn => fn());
    }
    grid.addEventListener("keydown", e => {
      const i = buttons.indexOf(doc.activeElement);
      if (i < 0) return;
      let n = i;
      if (e.key === "ArrowRight") n = i + 1;
      else if (e.key === "ArrowLeft") n = i - 1;
      else if (e.key === "ArrowDown") n = i + cols;
      else if (e.key === "ArrowUp") n = i - cols;
      else if (e.key === "Home") n = 0;
      else if (e.key === "End") n = buttons.length - 1;
      else return;
      e.preventDefault();
      e.stopPropagation();
      n = Math.max(0, Math.min(buttons.length - 1, n));
      choose(opts[n].value);
      buttons[n].focus();
    });
    sync();
    if (custom && opts.findIndex(o => o.value === value) < 0) custom.value = value;
    const node = el(doc, "div", { class: "rgl-dlg-field" },
      f.label ? el(doc, "span", { class: "rgl-dlg-lbl", text: f.label }) : null,
      el(doc, "div", { class: "rgl-dlg-pickrow" }, grid, custom));
    return {
      node,
      get: () => value,
      focus: () => (buttons.find(b => b.tabIndex === 0) ?? custom)?.focus(),
      valid: () => !f.required || String(value ?? "") !== "",
      onChange: fn => listeners.push(fn),
    };
  }

  function show(spec) {
    ensureSheet();
    return new Promise(resolve => {
      const prevFocus = doc.activeElement;
      const fields = (spec.fields ?? []).map(f => ({ spec: f }));
      let done = false;

      const title = el(doc, "h2", { class: "rgl-dlg-title", id: "rigel-dialog-title", text: spec.title ?? "" });
      const msg = spec.message ? el(doc, "p", { class: "rgl-dlg-msg", text: spec.message }) : null;
      const body = el(doc, "div", { class: "rgl-dlg-fields" });
      const cancelBtn = el(doc, "button", {
        type: "button", class: "rgl-dlg-btn cancel", onclick: () => finish(spec.fields ? null : false),
      }, spec.cancelLabel ?? "Vazgeç", el(doc, "kbd", { text: "Esc" }));
      const okBtn = el(doc, "button", {
        type: "button", class: "rgl-dlg-btn ok" + (spec.danger ? " danger" : ""), onclick: () => submit(),
      }, spec.okLabel ?? "Tamam", el(doc, "kbd", { text: "↵" }));
      const card = el(doc, "div", {
        class: "rgl-dlg", role: spec.danger ? "alertdialog" : "dialog", "aria-modal": "true",
        "aria-labelledby": "rigel-dialog-title",
      }, title, msg, body, el(doc, "div", { class: "rgl-dlg-foot" }, cancelBtn, okBtn));
      const root = el(doc, "div", { id: "rigel-dialog" }, card);

      const refresh = () => {
        okBtn.disabled = !fields.every(f => f.ctl.valid());
      };
      for (const f of fields) {
        f.ctl = buildField(f.spec, submit);
        f.ctl.onChange(refresh);
        body.append(f.ctl.node);
      }
      if (!fields.length) body.hidden = true;
      refresh();

      function result() {
        if (!spec.fields) return true;
        return Object.fromEntries(fields.map(f => [f.spec.key, f.ctl.get()]));
      }
      function submit() {
        if (okBtn.disabled) return;
        finish(result());
      }
      function finish(value) {
        if (done) return;
        done = true;
        win.removeEventListener("keydown", trap, true);
        root.remove();
        current = null;
        // Odak: açılmadan önceki öğeye; o gittiyse sayfaya.
        try {
          if (prevFocus?.isConnected && prevFocus.focus) prevFocus.focus();
          else win.gBrowser?.selectedBrowser?.focus();
        } catch {}
        resolve(value);
      }

      // Odak kartta kalsın; Esc iptal, Enter onay. Palet/çekmece kısayolları kutuyu bozmasın diye yakalama aşamasında.
      function focusables() {
        return [...card.querySelectorAll("input, button")].filter(n => !n.disabled && n.tabIndex >= 0 && n.getClientRects().length);
      }
      function trap(e) {
        if (!root.isConnected) return;
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          finish(spec.fields ? null : false);
        } else if (e.key === "Enter" && !e.isComposing) {
          const focused = doc.activeElement;
          if (focused === cancelBtn) return; // düğmenin kendi tıklaması
          if (focused?.classList?.contains("rgl-dlg-opt")) focused.click(); // odaktaki simge seçilir
          e.preventDefault();
          e.stopPropagation();
          submit();
        } else if (e.key === "Tab") {
          const list = focusables();
          if (!list.length) return;
          const i = list.indexOf(doc.activeElement);
          const next = e.shiftKey ? (i <= 0 ? list.length - 1 : i - 1) : (i < 0 || i === list.length - 1 ? 0 : i + 1);
          e.preventDefault();
          e.stopPropagation();
          list[next].focus();
        }
      }
      // Tek tuş kısayolları yazmayı bölmesin (kısayol işleyicileri üst katmanda dinler).
      root.addEventListener("keydown", e => {
        if (!e.ctrlKey && !e.altKey && !e.metaKey) e.stopPropagation();
      });
      win.addEventListener("keydown", trap, true);
      root.addEventListener("mousedown", e => {
        if (e.target === root) {
          e.preventDefault();
          finish(spec.fields ? null : false);
        }
      });

      current = { close: v => finish(v) };
      win.Rigel?.palette?.close?.({ restoreFocus: false });
      doc.documentElement.append(root);
      // Başlangıç odağı: ilk alan; alan yoksa onay düğmesi (tehlikeliyse iptal).
      (fields[0]?.ctl.focus ?? (() => (spec.danger ? cancelBtn : okBtn).focus()))();
    });
  }

  const api = {
    form: spec => open({ ...spec, fields: spec.fields ?? [] }),
    prompt: ({ title = "", label = "", value = "", placeholder = "", message, okLabel, cancelLabel, required = false } = {}) =>
      open({
        title, message, okLabel, cancelLabel,
        fields: [{ key: "value", type: "text", label, value, placeholder, required }],
      }).then(r => (r ? r.value : null)),
    confirm: ({ title = "", message = "", okLabel, cancelLabel, danger = false } = {}) =>
      open({ title, message, okLabel, cancelLabel, danger }).then(Boolean),
    pick: ({ title = "", label = "", options = [], value, columns, custom, message, okLabel, cancelLabel } = {}) =>
      open({
        title, message, okLabel, cancelLabel,
        fields: [{ key: "value", type: "pick", label, options, value, columns, custom, required: true }],
      }).then(r => (r ? r.value : null)),
    /** Açık kutuyu iptal ederek kapatır. */
    close: () => current?.close(null),
    isOpen: () => !!current,
  };
  return api;
}
