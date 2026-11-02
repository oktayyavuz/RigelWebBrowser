// Yeni sekme kısayol simgeleri. Sıra: profil/rigel-icons/<alan>.ico (kısayol eklenirken bir kez indirilir) →
// Places'taki site simgesi (ziyaret edilmişse) → harf rozeti (boş dize). Ağa yalnız kullanıcı kısayol
// eklerken/düzenlerken ve yalnız o sitenin /favicon.ico adresine gidilir; çerez gönderilmez.
import { hostOf } from "./config.mjs";

const DIR = "rigel-icons";
const MAX_BYTES = 256 * 1024;
const cache = new Map();

const safeHost = url => {
  const h = hostOf(url).toLowerCase();
  return /^[a-z0-9][a-z0-9.-]{0,98}$/.test(h) ? h : "";
};
const pathFor = host => PathUtils.join(PathUtils.profileDir, DIR, `${host}.ico`);

/** Kısayol için görüntülenecek simge adresi; yoksa "" (harf rozeti gösterilir). */
export function resolveIcon(url) {
  if (!cache.has(url)) cache.set(url, lookup(url));
  return cache.get(url);
}

async function lookup(url) {
  const host = safeHost(url);
  if (host) {
    try {
      const p = pathFor(host);
      if (await IOUtils.exists(p)) return PathUtils.toFileURI(p);
    } catch {}
  }
  try {
    const { PlacesUtils } = ChromeUtils.importESModule("resource://gre/modules/PlacesUtils.sys.mjs");
    const ic = await PlacesUtils.favicons.getFaviconForPage(Services.io.newURI(url));
    if (ic) return `page-icon:${url}`;
  } catch {}
  return "";
}

/** Sitenin /favicon.ico dosyasını indirip profile kaydeder. Başarılıysa true. */
export async function fetchIcon(url) {
  const host = safeHost(url);
  if (!host) return false;
  try {
    const res = await fetch(new URL("/favicon.ico", url).href, { credentials: "omit", redirect: "follow", cache: "force-cache" });
    if (!res.ok) return false;
    const type = res.headers.get("content-type") ?? "";
    if (type && !/^image\/|octet-stream/i.test(type)) return false;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_BYTES) return false;
    await IOUtils.makeDirectory(PathUtils.join(PathUtils.profileDir, DIR), { ignoreExisting: true });
    await IOUtils.write(pathFor(host), bytes);
    cache.delete(url);
    return true;
  } catch {
    return false;
  }
}
