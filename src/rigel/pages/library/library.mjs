// Kitaplık: sol gezinme + #gecmis | #yer-imleri[/klasör] | #indirmeler yönlendirmesi.
import { h, icon, logo, chromeWin } from "./ui.mjs";

const VIEWS = [
  { id: "gecmis", title: "Geçmiş", icon: "history", native: "History", load: () => import("./history.mjs") },
  { id: "yer-imleri", title: "Yer imleri", icon: "bookmark", native: "AllBookmarks", load: () => import("./bookmarks.mjs") },
  { id: "indirmeler", title: "İndirmeler", icon: "download", native: "Downloads", load: () => import("./downloads.mjs") },
];

const nav = document.getElementById("nav");
const main = document.getElementById("main");
let current = null; // { id, dispose }
let seq = 0;

const links = h("div", { class: "links" }, VIEWS.map(v => {
  const a = h("a", { href: "#" + v.id }, icon(v.icon), v.title);
  a.dataset.id = v.id;
  return a;
}));
let view = VIEWS[0];
nav.append(
  h("header", {}, logo(24), h("h1", { text: "Kitaplık" })),
  links,
  h("div", { class: "foot" },
    h("a", {
      href: "#", class: "adv", title: "Firefox'un kendi Kitaplık penceresi",
      onclick: e => { e.preventDefault(); chromeWin()?.Rigel?.library?.openNative(view.native); },
    }, icon("external", 15), "Firefox kitaplığı")));

async function route() {
  const [id, param = ""] = decodeURIComponent(location.hash.slice(1)).split("/");
  view = VIEWS.find(v => v.id === id) ?? VIEWS[0];
  for (const a of links.children) {
    const on = a.dataset.id === view.id;
    a.classList.toggle("on", on);
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  }
  document.title = `${view.title} · Kitaplık`;
  // Aynı görünüm içinde yalnız parametre değiştiyse (klasör) görünüme bildir.
  if (current?.id === view.id && current.setParam) { current.setParam(param); return; }
  const mine = ++seq;
  current?.dispose?.();
  current = null;
  main.replaceChildren();
  const mod = await view.load();
  if (mine !== seq) return;
  const box = h("div", { class: "view" });
  main.replaceChildren(box);
  const api = mod.mount(box, { param, setTitle: t => (document.title = `${t} · Kitaplık`) });
  current = { id: view.id, dispose: api?.dispose, setParam: api?.setParam };
  window.scrollTo(0, 0);
}

addEventListener("hashchange", route);
addEventListener("unload", () => current?.dispose?.());
route().catch(e => {
  console.error("[rigel-library]", e);
  main.replaceChildren(h("p", { class: "hint", text: "Kitaplık yüklenemedi: " + e }));
});
