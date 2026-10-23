// Ayarlar sayfası: sol gezinme, #bölüm yönlendirmesi ve tüm ayarlarda arama.
import { h, icon, logo, disposeAll, chromeWin } from "./ui.mjs";
import { SECTIONS, GROUPS, fold, openAdvanced } from "./sections.mjs";

const nav = document.getElementById("nav");
const main = document.getElementById("main");
const find = id => SECTIONS.find(s => s.id === id) ?? SECTIONS[0];

const search = h("input", { type: "search", placeholder: "Ayarlarda ara", spellcheck: "false", "aria-label": "Ayarlarda ara" });
const links = h("div", { class: "links" }, Object.entries(GROUPS).flatMap(([gid, glabel]) => [
  h("div", { class: "lgroup" + (gid === "kisisel" ? " hot" : ""), text: glabel }),
  ...SECTIONS.filter(s => s.group === gid).map(s => {
    const a = h("a", { href: "#" + s.id }, icon(s.icon), s.title);
    a.dataset.id = s.id;
    return a;
  }),
]));
nav.append(
  h("header", {}, logo(24), h("h1", { text: "Ayarlar" })),
  h("label", { class: "search" }, icon("search", 15), search),
  links,
  h("div", { class: "foot" },
    h("a", { href: "#modlar", class: "store", onclick: e => { e.preventDefault(); chromeWin()?.Rigel?.mods?.openStore?.(); } }, icon("brush", 15), "Mod mağazası"),
    h("a", { href: "about:preferences", class: "adv", onclick: e => { e.preventDefault(); openAdvanced(); } }, icon("external", 15), "Gelişmiş (Firefox ayarları)")));

function renderSection(s) {
  disposeAll();
  document.title = `${s.title} · Ayarlar`;
  for (const a of links.querySelectorAll("a")) {
    a.classList.toggle("on", a.dataset.id === s.id);
    if (a.dataset.id === s.id) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  main.replaceChildren(h("header", { class: "phead" }, h("h2", { text: s.title }), h("p", { text: s.description })), ...s.build());
}

function renderSearch(q) {
  disposeAll();
  document.title = "Ayarlarda ara";
  const needle = fold(q.trim());
  const out = [];
  for (const s of SECTIONS) {
    const nodes = s.build();
    const wrap = h("div", {}, nodes);
    // Aranabilir her öğe data-keywords taşır; eşleşmeyenler gizlenir, boşalan kartlar da.
    let any = 0;
    for (const el of wrap.querySelectorAll("[data-keywords]")) {
      const ok = fold(el.dataset.keywords + " " + s.title).includes(needle);
      el.hidden = !ok;
      if (ok) any++;
    }
    for (const c of wrap.querySelectorAll(".card")) {
      if (c.querySelector("[data-keywords]:not([hidden])") == null && c.querySelector("[data-keywords]")) c.hidden = true;
    }
    // Üst satır gizlendiyse içindeki (alt) eşleşmeler görünmez; üstü eşleşen satır yeterli.
    if (!any) continue;
    out.push(h("div", { class: "group" }, h("a", { class: "gtitle", href: "#" + s.id }, icon(s.icon, 15), s.title), wrap));
  }
  main.replaceChildren(h("header", { class: "phead" }, h("h2", { text: "Arama sonuçları" })),
    ...(out.length ? out : [h("p", { class: "hint", text: `"${q.trim()}" için ayar bulunamadı.` })]));
}

function route() {
  const id = decodeURIComponent(location.hash.slice(1)).split("/")[0];
  if (search.value) search.value = "";
  renderSection(find(id));
  window.scrollTo(0, 0);
}

search.addEventListener("input", () => (search.value.trim() ? renderSearch(search.value) : route()));
search.addEventListener("keydown", e => {
  if (e.key === "Escape" && search.value) { search.value = ""; route(); }
});
addEventListener("hashchange", route);
addEventListener("keydown", e => {
  if ((e.ctrlKey && e.key === "f") || (e.key === "/" && !/^(input|select|textarea)$/i.test(e.target.tagName))) {
    e.preventDefault();
    search.focus();
  }
});
route();
