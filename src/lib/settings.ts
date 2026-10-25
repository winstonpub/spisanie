import { getCachedRemoteScriptUrl } from "./remoteConfig";

export type CategoryId = "construction" | "joinery";

export interface Category {
  id: CategoryId;
  title: string;
  /** Ссылка на таблицу товаров (артикул, штрихкод, наименование) */
  defaultUrl: string;
  /** Лист, куда сайт записывает введённые артикулы и количество (ссылка с gid) */
  defaultLogUrl: string;
}

const SPREADSHEET = "https://docs.google.com/spreadsheets/d/1lPe5aSe2SG9ZXDTF7hKNlqAU9dS34IgJXwteSZVGsZ4/edit";

export const CATEGORIES: Category[] = [
  {
    id: "construction",
    title: "Строительные материалы",
    defaultUrl: `${SPREADSHEET}?gid=0#gid=0`,
    defaultLogUrl: `${SPREADSHEET}?gid=1410594629#gid=1410594629`,
  },
  {
    id: "joinery",
    title: "Столярные изделия",
    defaultUrl: `${SPREADSHEET}?gid=1557440748#gid=1557440748`,
    defaultLogUrl: `${SPREADSHEET}?gid=317840889#gid=317840889`,
  },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as CategoryId[];

export function isCategoryId(value: string): value is CategoryId {
  return (CATEGORY_IDS as string[]).includes(value);
}

export interface Settings {
  /** Категория, страница которой открывается по умолчанию */
  active: CategoryId;
  /** Ссылки на таблицы товаров по отделам */
  links: Record<CategoryId, string>;
  /** Ссылки на листы записи (артикул + количество) по отделам */
  logLinks: Record<CategoryId, string>;
  /** URL развёрнутого Apps Script для записи артикулов в Google Таблицу */
  logScriptUrl: string;
}

export const SETTINGS_STORAGE_KEY = "barcode-app:settings:v1";

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
      const link = parsed.links?.[c.id];
      if (typeof link === "string") links[c.id] = link.trim();
      const logLink = parsed.logLinks?.[c.id];
      if (typeof logLink === "string") logLinks[c.id] = logLink.trim();
    }
    const active = CATEGORIES.find((c) => c.id === parsed.active)?.id ?? defaults.active;
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
