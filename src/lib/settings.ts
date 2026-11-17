import { getCachedRemoteScriptUrl } from "./remoteConfig";

export type CategoryId = "01_dept" | "02_dept";

export interface Category {
  id: CategoryId;
  title: string;
  /** Ссылка на таблицу товаров (артикул, штрихкод, наименование) */
  defaultUrl: string;
  /** Лист, куда сайт записывает введённые артикулы и количество (ссылка с gid) */
  defaultLogUrl: string;
  logGid: string;
  logUrl: string;
}

const SPREADSHEET = "https://docs.google.com/spreadsheets/d/1lPe5aSe2SG9ZXDTF7hKNlqAU9dS34IgJXwteSZVGsZ4/edit";

export const CATEGORIES: Category[] = [
  {
    id: "01_dept",
    title: "Строительные материалы",
    defaultUrl: `${SPREADSHEET}?gid=0#gid=0`,
    defaultLogUrl: `${SPREADSHEET}?gid=1410594629#gid=1410594629`,
    logGid: "1410594629",
    logUrl: `${SPREADSHEET}?gid=1410594629#gid=1410594629`,
  },
  {
    id: "02_dept",
    title: "Столярные изделия",
    defaultUrl: `${SPREADSHEET}?gid=1557440748#gid=1557440748`,
    defaultLogUrl: `${SPREADSHEET}?gid=317840889#gid=317840889`,
    logGid: "317840889",
    logUrl: `${SPREADSHEET}?gid=317840889#gid=317840889`,
  },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as CategoryId[];

export function isCategoryId(value: string): value is CategoryId {
  return (CATEGORY_IDS as string[]).includes(value);
}

export interface Settings {
  /** Категория, страница которой открывается по умолчанию */
  active: CategoryId;
  links: Record<CategoryId, string>;
  /** Ссылки на листы записи (артикул + количество) по отделам */
  logLinks: Record<CategoryId, string>;
  /** URL развёрнутого Apps Script для записи артикулов в Google Таблицу */
  logScriptUrl: string;
}

export const SETTINGS_STORAGE_KEY = "barcode-app:settings:v1";

const LEGACY_IDS: Record<string, CategoryId> = {
  construction: "01_dept",
  joinery: "02_dept",
};

function recordOf(pick: (c: Category) => string): Record<CategoryId, string> {
  return Object.fromEntries(CATEGORIES.map((c) => [c.id, pick(c)])) as Record<CategoryId, string>;
}

export function defaultSettings(): Settings {
  return {
    active: CATEGORIES[0].id,
    links: recordOf((c) => c.defaultUrl),
    logLinks: recordOf((c) => c.defaultLogUrl),
    logScriptUrl: getCachedRemoteScriptUrl(),
  };
}

export function loadSettings(): Settings {
  const defaults = defaultSettings();
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const links = { ...defaults.links };
    const logLinks = { ...defaults.logLinks };
    for (const c of CATEGORIES) {
      const oldId = Object.keys(LEGACY_IDS).find((key) => LEGACY_IDS[key] === c.id);
      const link = parsed.links?.[c.id] ?? (oldId ? parsed.links?.[oldId as CategoryId] : undefined);
      if (typeof link === "string") links[c.id] = link.trim();
      const logLink = parsed.logLinks?.[c.id] ?? (oldId ? parsed.logLinks?.[oldId as CategoryId] : undefined);
      if (typeof logLink === "string") logLinks[c.id] = logLink.trim();
    }
    const activeValue = parsed.active ?? defaults.active;
    const active = CATEGORIES.find((c) => c.id === activeValue)?.id
      ?? LEGACY_IDS[activeValue]
      ?? defaults.active;
    const logScriptUrl =
      typeof parsed.logScriptUrl === "string" ? parsed.logScriptUrl.trim() : defaults.logScriptUrl;
    return { active, links, logLinks, logScriptUrl };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* хранилище недоступно */
  }
}

export function getCategory(id: CategoryId): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}

/** gid листа записи из ссылки в настройках; пустая строка — запись выключена */
export function logGidOf(url: string): string {
  const m = url.match(/[?#&]gid=(\d+)/);
  return url.trim() && m ? m[1] : "";
}
