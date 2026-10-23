// Kapsayıcı (container) sekmeleri: her kapsayıcı için "Kapsayıcıda yeni sekme: <ad>" komutu ve
// etkin alanın varsayılan kapsayıcısını seçen komutlar. İşaretler: Yan Panel/Klasik'te Firefox'un
// kendi renk çizgisi, Ada/Dock/Komuta ve sekme panelinde identity-color-* sınıfı (zen/zen.css).

export function init(win) {
  const { gBrowser } = win;
  const isPrivate = win.PrivateBrowsingUtils?.isWindowPrivate(win) ?? false;
  const CIS = win.ContextualIdentityService;
  Services.prefs.getDefaultBranch("").setBoolPref("privacy.userContext.enabled", true);

  const enabled = () => !isPrivate && !!CIS && Services.prefs.getBoolPref("privacy.userContext.enabled", false);
  const identities = () => (CIS?.getPublicIdentities() ?? []).map(i => ({
    id: i.userContextId, color: i.color, name: CIS.getUserContextLabel(i.userContextId),
  }));

  function openIn(id) {
    const tab = gBrowser.addTrustedTab(win.BROWSER_NEW_TAB_URL || "about:newtab", { userContextId: id });
    gBrowser.selectedTab = tab;
  }

  const spaceCtr = () => win.Rigel?.spaces?.current?.()?.container ?? 0;
  const setSpaceCtr = id => {
    const sp = win.Rigel?.spaces;
    if (!sp) return;
    sp.setContainer(sp.active(), id);
    const name = id ? CIS.getUserContextLabel(id) : "yok";
    win.Rigel?.toast?.(`Alanın kapsayıcısı: ${name}`);
  };

  let lastIds = [];
  function commandList() {
    if (!CIS) return [];
    const out = [];
    for (const c of identities()) {
      out.push({
        id: `zen.container.new.${c.id}`, label: `Kapsayıcıda yeni sekme: ${c.name}`, icon: "tab",
        when: enabled, run: () => openIn(c.id),
      });
      out.push({
        id: `zen.container.space.${c.id}`, label: `Alanın kapsayıcısı: ${c.name}`, icon: "layout",
        sub: () => (spaceCtr() === c.id ? "etkin" : "yeni sekmeler bu kapsayıcıda"),
        when: () => enabled() && !!win.Rigel?.spaces, run: () => setSpaceCtr(c.id),
      });
    }
    out.push({
      id: "zen.container.space.none", label: "Alanın kapsayıcısını kaldır", icon: "layout",
      when: () => enabled() && spaceCtr() > 0, run: () => setSpaceCtr(0),
    });
    return out;
  }
  function refresh() {
    const list = commandList();
    const ids = new Set(list.map(c => c.id));
    for (const id of lastIds) if (!ids.has(id)) win.Rigel?.commands?.unregister?.(id);
    lastIds = [...ids];
    win.Rigel?.zenRefreshCommands?.();
  }
  const topics = ["contextual-identity-created", "contextual-identity-updated", "contextual-identity-deleted"];
  const obs = { observe: () => win.setTimeout(refresh, 0) };
  for (const t of topics) Services.obs.addObserver(obs, t);

  return {
    commands: () => {
      const list = commandList();
      lastIds = list.map(c => c.id);
      return list;
    },
    destroy() {
      for (const t of topics) Services.obs.removeObserver(obs, t);
    },
  };
}
