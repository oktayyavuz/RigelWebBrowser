// Helium (net.imput.helium) içe aktarıcısı: Firefox'un Chromium aktarıcısının bir alt sınıfı.
// Firefox aktarıcı listesini modül içinde tutar; biz yalnız herkese açık iki girişi
// (MigrationUtils.availableMigratorKeys ve getMigrator) genişletiriz. Uygulama başına bir kez kurulur.

import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";
import { FileUtils } from "resource://gre/modules/FileUtils.sys.mjs";
import { ChromeProfileMigrator } from "resource:///modules/ChromeProfileMigrator.sys.mjs";
import { ChromeMigrationUtils } from "resource:///modules/ChromeMigrationUtils.sys.mjs";
import { MigrationUtils } from "resource:///modules/MigrationUtils.sys.mjs";

const KEY = "helium";

// Helium'un kullanıcı verisi klasörü (Chromium "User Data" karşılığı).
function heliumDataPaths() {
  const d = (k, ...p) => {
    try {
      return PathUtils.join(Services.dirsvc.get(k, Ci.nsIFile).path, ...p);
    } catch {
      return null;
    }
  };
  switch (AppConstants.platform) {
    case "win":
      return [d("LocalAppData", "imput", "Helium", "User Data")];
    case "macosx":
      return [d("ULibDir", "Application Support", "net.imput.helium")];
    default:
      return [d("Home", ".config", "net.imput.helium")];
  }
}

// Kurulu Helium'un kendi ikonu (yalnız yerelde gösterilir, depoya kopyalanmaz).
const ICONS = [
  "/usr/share/icons/hicolor/256x256/apps/helium-browser.png",
  "/opt/helium-browser-bin/product_logo_256.png",
  "/usr/share/pixmaps/helium-browser.png",
];
let brandImage = "chrome://browser/content/migration/brands/chromium.png";
for (const p of ICONS) {
  try {
    const f = new FileUtils.File(p);
    if (f.exists()) {
      brandImage = Services.io.newFileURI(f).spec;
      break;
    }
  } catch {}
}

export class HeliumProfileMigrator extends ChromeProfileMigrator {
  static get key() {
    return KEY;
  }
  static get displayNameL10nID() {
    // l10n/overrides.mjs bu kimliği migrationWizard.ftl'e ekler.
    return "migration-wizard-migrator-display-name-helium";
  }
  static get brandImage() {
    return brandImage;
  }
  _chromeUserDataPathSuffix = "Helium";
  _keychainServiceName = "Helium Safe Storage";
  _keychainAccountName = "Helium";
}

export function installHeliumMigrator() {
  if (MigrationUtils.__rigelHelium) return;
  MigrationUtils.__rigelHelium = true;

  // ChromeMigrationUtils.getDataPath("Helium") → Helium klasörü.
  const origPath = ChromeMigrationUtils.getDataPath.bind(ChromeMigrationUtils);
  ChromeMigrationUtils.getDataPath = async function (name = "Chrome") {
    if (name !== "Helium") return origPath(name);
    for (const p of heliumDataPaths()) {
      if (p && (await IOUtils.exists(PathUtils.join(p, "Local State")))) return p;
    }
    return null;
  };

  // Aktarım sırasında Firefox, kaynak adına göre bir Glean ölçümü arar; "helium" için boş bir yer tutucu.
  try {
    const usage = Glean.browserMigration.usage;
    if (!usage[KEY]) Object.defineProperty(usage, KEY, { value: { accumulateSingleSample() {} }, configurable: true });
  } catch (e) {
    console.warn("[rigel] Helium: Glean yer tutucu eklenemedi", e);
  }

  const helium = new HeliumProfileMigrator();
  const proto = Object.getPrototypeOf(MigrationUtils);
  const keysDesc = Object.getOwnPropertyDescriptor(proto, "availableMigratorKeys");
  Object.defineProperty(MigrationUtils, "availableMigratorKeys", {
    configurable: true,
    get() {
      const keys = keysDesc.get.call(this);
      return keys.includes(KEY) ? keys : [KEY, ...keys];
    },
  });
  const origGet = MigrationUtils.getMigrator.bind(MigrationUtils);
  MigrationUtils.getMigrator = async function (key) {
    if (key !== KEY) return origGet(key);
    try {
      return (await helium.isSourceAvailable()) ? helium : null;
    } catch (e) {
      console.error(e);
      return null;
    }
  };
}
