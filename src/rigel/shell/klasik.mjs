// Klasik düzen: Firefox'un yerel yatay sekmeleri (yeniden biçimlenmiş) + altında araç çubuğu.
// Burada yalnız Rigel pencere düğmeleri eklenir; gerisini layouts/klasik.css yapar.

import { Disposer, el, windowButtons } from "./common.mjs";

export function init(win) {
  const doc = win.document;
  const d = new Disposer();
  const tabsToolbar = doc.getElementById("TabsToolbar");
  if (!tabsToolbar) return () => {};
  const wctl = el(doc, "div", { id: "rigel-klasik-wctl", class: "rigel-bar" }, windowButtons(win, d));
  tabsToolbar.append(wctl);
  d.add(() => wctl.remove());
  win.dump("[rigel] klasik hazır\n");
  return () => d.run();
}
