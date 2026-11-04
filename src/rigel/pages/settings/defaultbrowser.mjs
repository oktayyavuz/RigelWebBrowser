// Varsayılan tarayıcı (Ayarlar › Başlangıç ve kurulum sihirbazı ortak).
// Firefox'un kabuk servisi Linux'ta firefox.desktop'u ayarlar; Rigel'in girdisi rigel.desktop olduğu için
// xdg-settings (KDE'de kdeglobals'ı da yazar) kullanılır. Windows'ta "Varsayılan uygulamalar" açılır.
const DESKTOP_ID = "rigel.desktop";
export const isWin = () => Services.appinfo.OS === "WINNT";
async function run(cmd, args) {
  const { Subprocess } = ChromeUtils.importESModule("resource://gre/modules/Subprocess.sys.mjs");
  const command = await Subprocess.pathSearch(cmd);
  const proc = await Subprocess.call({ command, arguments: args, environmentAppend: true, stderr: "pipe" });
  let out = "";
  for (let chunk; (chunk = await proc.stdout.readString()); ) out += chunk;
  const { exitCode } = await proc.wait();
  return { exitCode, out: out.trim() };
}
export async function isDefaultBrowser() {
  if (isWin()) return null;
  // Önce kullanıcının mimeapps.list dosyası (KDE'nin xdg-mime sorgusu önbellekten okuyup gecikebilir).
  try {
    const dir = Services.env.get("XDG_CONFIG_HOME") || PathUtils.join(Services.env.get("HOME"), ".config");
    const text = await IOUtils.readUTF8(PathUtils.join(dir, "mimeapps.list"));
    const sec = text.split(/^\[/m).find(x => x.startsWith("Default Applications]")) ?? "";
    const m = sec.match(/^x-scheme-handler\/https=([^;\n]+)/m);
    if (m) return m[1].trim() === DESKTOP_ID;
  } catch {}
  try {
    return (await run("xdg-mime", ["query", "default", "x-scheme-handler/https"])).out === DESKTOP_ID;
  } catch {
    return null;
  }
}
const MIME_TYPES = ["x-scheme-handler/http", "x-scheme-handler/https", "text/html", "application/xhtml+xml"];
export async function makeDefaultBrowser() {
  if (isWin()) {
    await run("explorer.exe", ["ms-settings:defaultapps"]);
    return null;
  }
  // xdg-settings bazı masaüstlerinde başarısız olur; ilişkilendirmeler ve KDE ayarı ayrıca doğrudan yazılır.
  const tryRun = (cmd, args) => run(cmd, args).catch(() => null);
  await tryRun("xdg-settings", ["set", "default-web-browser", DESKTOP_ID]);
  await tryRun("xdg-mime", ["default", DESKTOP_ID, ...MIME_TYPES]);
  if (/KDE/i.test(Services.env.get("XDG_CURRENT_DESKTOP"))) {
    await tryRun("kwriteconfig6", ["--file", "kdeglobals", "--group", "General", "--key", "BrowserApplication", DESKTOP_ID]);
  }
  return isDefaultBrowser();
}
