/**
 * Синхронизация введённых артикулов и количества с Google Таблицей через Apps Script.
 *
 * Apps Script разворачивается как веб-приложение «Все, даже анонимные»
 * и принимает POST-запросы с JSON:
 *   - { cmd: "log", gid: 1410594629, rows: [{ sku: "12707791", qty: "5" }, ...] }
 *   - { cmd: "clear", gid: 1410594629 }
 *
 * Артикул пишется в столбец A, количество — в столбец B выбранного листа.
 * Сайт не знает и не требует OAuth-токена — авторизацией владеет сам Apps Script.
 */

export interface SyncRow {
  sku: string;
  qty: string;
}

export type SyncState =
  | { kind: "idle" }
  | { kind: "disabled" }
  | { kind: "syncing" }
  | { kind: "ok"; count: number; at: Date }
  | { kind: "error"; message: string };

interface LogResult {
  ok: boolean;
  count?: number;
  error?: string;
  version?: number;
}

async function callScript(url: string, payload: unknown, timeoutMs = 12000): Promise<LogResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      // Тело без явного Content-Type остаётся простым CORS-запросом. Apps Script
      // отвечает с Access-Control-Allow-Origin, поэтому можно прочитать ошибку
      // и не показывать ложное «Сохранено» при старой версии скрипта.
      body: JSON.stringify(payload),
      mode: "cors",
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const result = (await res.json()) as LogResult;
    if (typeof result?.ok !== "boolean") {
      return { ok: false, error: "Apps Script вернул некорректный ответ" };
    }
    return result;
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка сети" };
  }
}

export async function sendRows(scriptUrl: string, gid: string, rows: SyncRow[]): Promise<LogResult> {
  const result = await callScript(scriptUrl, {
    cmd: "log",
    gid: Number(gid),
    rows,
    // Поля оставлены для совместимости со старым скриптом. Новый скрипт
    // использует rows и записывает обе колонки; старый хотя бы получит SKU.
    skus: rows.map((row) => row.sku),
    quantities: rows.map((row) => row.qty),
  });
  if (result.ok && !(Number(result.version) >= 2)) {
    return {
      ok: false,
      error: "В Apps Script установлена старая версия. Обновите код и разверните новую версию.",
    };
  }
  return result;
}

export async function clearRows(scriptUrl: string, gid: string): Promise<LogResult> {
  const result = await callScript(scriptUrl, { cmd: "clear", gid: Number(gid) });
  if (result.ok && !(Number(result.version) >= 2)) {
    return {
      ok: false,
      error: "В Apps Script установлена старая версия. Обновите код и разверните новую версию.",
    };
  }
  return result;
}

export function isScriptConfigured(url: string | undefined): url is string {
  return typeof url === "string" && /^https:\/\/script\.google\.com\/macros\/s\/\S+\/exec/.test(url.trim());
}
