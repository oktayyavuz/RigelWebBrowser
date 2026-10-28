// Betikli (kod çalıştıran) modlar için kullanıcı onayı. Hem pencere betiği (mods.uc.mjs) hem ayarlar/mağaza sayfaları kullanır.
// Güvenlik: chrome betiği tarayıcı yetkileriyle çalışır. Yerleşik ve paketle gelen mağaza modları güvenilirdir; diğerleri
// (uzak mağaza, bağlantıdan kurulan, içe aktarılan) kullanıcı onaylamadan etkinleşmez (Mods.needsConsent). Onay yoksa kapalı kalır.

/** Uyarıyı gösterir; kullanıcı izin verirse true. Rigel.dialog yoksa güvenli tarafta kalıp false döner. */
export async function confirmScript(win, meta) {
  const confirm = win?.Rigel?.dialog?.confirm;
  if (!confirm) return false;
  const ok = await confirm.call(win.Rigel.dialog, {
    title: "Bu mod kod çalıştırır",
    message: `"${meta?.name ?? "Mod"}" kendi JavaScript kodunu tarayıcının tam yetkileriyle çalıştırır: sekmelerini, geçmişini ve parolalarını görebilir. Yalnız yazarına güveniyorsan izin ver.`,
    okLabel: "Kodu çalıştırmasına izin ver",
    cancelLabel: "Vazgeç",
    danger: true,
  });
  return !!ok;
}

/** Modu açar ya da kapatır; açarken gerekirse onay ister. Döndürür: yapıldı mı. */
export async function enableWithConsent(win, Mods, id, on) {
  if (!on) { Mods.setEnabled(id, false); return true; }
  if (Mods.needsConsent(id)) {
    const meta = Mods.get(id)?.meta;
    if (!(await confirmScript(win, meta))) return false;
    await Mods.approveScript(id);
  }
  return Mods.setEnabled(id, true);
}
