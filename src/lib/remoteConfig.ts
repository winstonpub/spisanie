import Papa from "papaparse";

export const DEFAULT_SCRIPT_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1lPe5aSe2SG9ZXDTF7hKNlqAU9dS34IgJXwteSZVGsZ4/edit?gid=37870238#gid=37870238";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/1lPe5aSe2SG9ZXDTF7hKNlqAU9dS34IgJXwteSZVGsZ4/export?format=csv&gid=37870238";

// Встроенный fallback на случай проблем со связью
const FALLBACK_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyUFRa8gH8ptm330rZXgQStYAlkdB97vqn91ie3PBxqM7Yoh_0uonaLwwPgOJi0lrYo/exec";

const CACHE_KEY = "barcode-app:remote-script-url:v1";

/**
 * Читает ячейку A1 из листа gid=37870238
 */
export async function fetchRemoteScriptUrl(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${CSV_URL}&_=${Date.now()}`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
    const firstCell = parsed.data?.[0]?.[0]?.trim();
    if (firstCell && /^https:\/\/script\.google\.com\/macros\/s\/\S+\/exec/.test(firstCell)) {
      try {
        localStorage.setItem(CACHE_KEY, firstCell);
      } catch {}
      return firstCell;
    }
    return null;
  } catch {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached && /^https:\/\/script\.google\.com\/macros\/s\/\S+\/exec/.test(cached)) {
        return cached;
      }
    } catch {}
    return FALLBACK_SCRIPT_URL;
  }
}

export function getCachedRemoteScriptUrl(): string {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached && /^https:\/\/script\.google\.com\/macros\/s\/\S+\/exec/.test(cached)) {
      return cached;
    }
  } catch {}
  return FALLBACK_SCRIPT_URL;
}
