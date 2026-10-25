import Papa from "papaparse";

const SHEET_ID = "1lPe5aSe2SG9ZXDTF7hKNlqAU9dS34IgJXwteSZVGsZ4";

export interface LogEntry {
  /** Артикул из столбца A */
  sku: string;
  /** Количество из столбца B */
  qty: string;
}

/**
 * Читает записи листа отдела: столбец A — артикул, B — количество.
 * При любой ошибке возвращает пустой список (сайт просто покажет одну пустую строку).
 */
export async function fetchLogRows(gid: string, timeoutMs = 10000): Promise<LogEntry[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(
        `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}&_=${Date.now()}`,
        { signal: controller.signal, cache: "no-store" }
      );
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return [];
    const text = await res.text();
    if (/^\s*<(!doctype|html)/i.test(text)) return [];
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
    const entries: LogEntry[] = [];
    for (const row of parsed.data) {
      const sku = (row[0] ?? "").trim();
      const qty = (row[1] ?? "").trim();
      if (sku || qty) entries.push({ sku, qty });
    }
    return entries;
  } catch {
    return [];
  }
}
