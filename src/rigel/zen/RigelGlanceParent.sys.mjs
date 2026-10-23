// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Göz at (glance) üst süreç tarafı: içerikten gelen adresi pencerenin Rigel.glance'ine iletir.

export class RigelGlanceParent extends JSWindowActorParent {
  receiveMessage(message) {
    if (message.name !== "RigelGlance:Open") return;
    const browser = this.browsingContext.top.embedderElement;
    const win = browser?.documentGlobal ?? browser?.ownerGlobal;
    const glance = win?.Rigel?.glance;
    if (!glance) return;
    let url = String(message.data?.url ?? "");
    if (!url) return;
    try {
      glance.openFromBrowser(browser, url, this.manager.documentPrincipal);
    } catch (e) {
      dump(`[rigel-glance-parent] hata ${e}\n${e.stack}\n`);
    }
  }
}
