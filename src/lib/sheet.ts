import Papa from "papaparse";
import constructionCsv from "../data/construction.csv?raw";

export interface Product {
  sku: string;
  barcode: string;
  name: string;
}

export type ProductMap = Map<string, Product>;

/**
 * live     — свежие данные, только что загруженные из Google Таблицы
 * cache    — копия последней успешной загрузки (localStorage)
 * fallback — копия, встроенная в сайт при сборке
 * none     — данных нет
 */
export type DataSource = "live" | "cache" | "fallback" | "none";

export interface SheetData {
  products: ProductMap;
  count: number;
  source: DataSource;
  loadedAt: Date | null;
  error?: string;
}

export interface SheetRef {
  id: string;
  gid: string;
  published: boolean;
}

/** Разбирает ссылку на Google Таблицу: id документа и gid листа */
export function parseSheetUrl(url: string): SheetRef | null {
  const value = url.trim();
  if (!value) return null;
  const gid = value.match(/[?#&]gid=(\d+)/)?.[1] ?? "0";
  // Ссылка «Опубликовать в интернете»: /spreadsheets/d/e/<id>/pubhtml
  const published = value.match(/\/spreadsheets\/d\/e\/([\w-]+)/);
  if (published) return { id: published[1], gid, published: true };
  const regular = value.match(/\/spreadsheets\/d\/([\w-]+)/);
  if (regular) return { id: regular[1], gid, published: false };
  return null;
}

export function sheetKey(ref: SheetRef): string {
  return `${ref.published ? "pub:" : ""}${ref.id}:${ref.gid}`;
}

function csvUrl(ref: SheetRef): string {
  return ref.published
    ? `https://docs.google.com/spreadsheets/d/e/${ref.id}/pub?gid=${ref.gid}&single=true&output=csv`
    : `https://docs.google.com/spreadsheets/d/${ref.id}/export?format=csv&gid=${ref.gid}`;
}

export function normalizeSku(value: string): string {
  return value.trim().replace(/\s+/g, "").toLowerCase();
}

/** Штрихкоды сравниваем без пробелов, дефисов и других разделителей */
export function normalizeBarcode(value: string): string {
  return value.trim().replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

function parseCsv(csv: string): ProductMap {
  const result = Papa.parse<string[]>(csv, { skipEmptyLines: true });
  const map: ProductMap = new Map();
  for (const row of result.data) {
    const [skuRaw = "", barcodeRaw = "", nameRaw = ""] = row;
    const sku = String(skuRaw).trim();
    if (!sku) continue;
    // Пропускаем возможную строку заголовка
    if (/^(артикул|sku)$/i.test(sku)) continue;
    const key = normalizeSku(sku);
    if (!map.has(key)) {
      map.set(key, {
        sku,
        barcode: String(barcodeRaw).trim(),
        name: String(nameRaw).trim(),
      });
    }
  }
  return map;
}

/* ---------- Встроенные копии (на случай отсутствия связи с Google) ---------- */

const EMBEDDED: Record<string, string> = {
  "1lPe5aSe2SG9ZXDTF7hKNlqAU9dS34IgJXwteSZVGsZ4:0": constructionCsv,
};

/* ---------- Кэш последней успешной загрузки ---------- */

const CACHE_PREFIX = "barcode-app:sheet-cache:";

interface CacheEntry {
  csv: string;
  savedAt: number;
}

function readCache(key: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    return typeof parsed?.csv === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, csv: string) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ csv, savedAt: Date.now() }));
  } catch {
    /* хранилище переполнено или недоступно — не критично */
  }
}

function build(csv: string, source: DataSource, loadedAt: Date | null, error?: string): SheetData {
  const products = parseCsv(csv);
  return { products, count: products.size, source, loadedAt, error };
}

/** Данные без обращения к сети: сохранённая или встроенная копия */
export function getOfflineData(ref: SheetRef, error?: string): SheetData | null {
  const key = sheetKey(ref);
  const cached = readCache(key);
  if (cached) return build(cached.csv, "cache", new Date(cached.savedAt), error);
  const embedded = EMBEDDED[key];
  if (embedded !== undefined) return build(embedded, "fallback", null, error);
  return null;
}

export function cacheConfirmedProducts(ref: SheetRef, products: ProductMap) {
  writeCache(sheetKey(ref), Papa.unparse(Array.from(products.values(), (p) => [p.sku, p.barcode, p.name])));
}

async function fetchCsv(ref: SheetRef): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    let res: Response;
    try {
      res = await fetch(`${csvUrl(ref)}&_=${Date.now()}`, {
        signal: controller.signal,
        cache: "no-store",
      });
    } catch {
      if (controller.signal.aborted) throw new Error("Google не ответил вовремя");
      throw new Error(
        "Нет доступа к таблице. Проверьте интернет и что доступ открыт для всех, у кого есть ссылка"
      );
    }
    if (res.status === 400) throw new Error("Лист не найден — проверьте gid в ссылке");
    if (res.status === 404) throw new Error("Таблица не найдена — проверьте ссылку");
    if (res.status === 401 || res.status === 403)
      throw new Error("Таблица закрыта. Откройте доступ «Все, у кого есть ссылка»");
    if (!res.ok) throw new Error(`Google вернул ошибку (HTTP ${res.status})`);
    const text = await res.text();
    if (/^\s*<(!doctype|html)/i.test(text))
      throw new Error("Таблица закрыта. Откройте доступ «Все, у кого есть ссылка»");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/** Загружает актуальные данные; при ошибке — возвращает сохранённую/встроенную копию */
export async function loadSheet(ref: SheetRef): Promise<SheetData> {
  try {
    const csv = await fetchCsv(ref);
    writeCache(sheetKey(ref), csv);
    return build(csv, "live", new Date());
  } catch (e) {
    const error = e instanceof Error ? e.message : "Не удалось загрузить таблицу";
    return (
      getOfflineData(ref, error) ?? {
        products: new Map(),
        count: 0,
        source: "none",
        loadedAt: null,
        error,
      }
    );
  }
}
