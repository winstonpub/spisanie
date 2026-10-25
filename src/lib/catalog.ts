import { normalizeSku, parseSheetUrl } from "./sheet";
import type { Product } from "./sheet";
import { isScriptConfigured } from "./sync";

export type ProductCommand = "product.begin" | "product.barcode" | "product.name" | "product.cancel";

export interface ProductOperation {
  operationId: string;
  sku: string;
  catalogUrl: string;
  scriptUrl: string;
}

export interface ProductReply {
  ok: true;
  product: Product;
  row: number;
  status: "draft" | "complete" | "cancelled";
  exists?: boolean;
}

const UPDATE_SCRIPT_MESSAGE =
  "Обновите Apps Script кодом из google-apps-script/Code.gs и разверните новую версию. Текущий скрипт не поддерживает добавление товаров.";

export async function writeCatalogStep(
  operation: ProductOperation,
  cmd: ProductCommand,
  fields: { barcode?: string; name?: string } = {},
): Promise<ProductReply> {
  if (!isScriptConfigured(operation.scriptUrl)) {
    throw new Error("URL развёрнутого скрипта не задан. Проверьте страницу «Настройки».");
  }
  const target = parseSheetUrl(operation.catalogUrl);
  if (!target || target.published) {
    throw new Error("Укажите в настройках обычную ссылку на базу товаров, а не ссылку публикации.");
  }
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(operation.scriptUrl.trim(), {
      method: "POST",
      mode: "cors",
      redirect: "follow",
      credentials: "omit",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      signal: controller.signal,
      body: JSON.stringify({
        cmd,
        spreadsheetId: target.id,
        gid: Number(target.gid),
        operationId: operation.operationId,
        sku: operation.sku,
        ...fields,
      }),
    });
    if (!response.ok) throw new Error(`Ошибка Apps Script (HTTP ${response.status}). Проверьте доступ к веб-приложению.`);
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("Скрипт вернул не JSON. Проверьте URL, доступ «Все» и опубликованную версию Apps Script.");
    }
    if (!result || typeof result !== "object") throw new Error("Не удалось подтвердить сохранение. Повторите попытку.");
    if (Number(result.version) < 3 || /Неизвестная команда/i.test(String(result.error || ""))) {
      throw new Error(UPDATE_SCRIPT_MESSAGE);
    }
    if (result.ok !== true) throw new Error(typeof result.error === "string" ? result.error : "Не удалось сохранить товар.");
    const product = result.product;
    if (
      result.catalogVersion !== 1 || result.operationId !== operation.operationId ||
      result.spreadsheetId !== target.id || result.gid !== Number(target.gid) ||
      !product || typeof product.sku !== "string" || typeof product.barcode !== "string" ||
      typeof product.name !== "string" || normalizeSku(product.sku) !== normalizeSku(operation.sku) ||
      !Number.isInteger(result.row) || !["draft", "complete", "cancelled"].includes(result.status)
    ) {
      throw new Error("Ответ скрипта не подтверждает запись в выбранную базу. Обновите Apps Script и повторите попытку.");
    }
    if (result.status !== "cancelled" && result.row < 1) throw new Error("Скрипт не подтвердил строку товара.");
    if (result.status === "complete" && (!product.name || !product.barcode)) {
      throw new Error("Строка товара заполнена не полностью. Проверьте базу и повторите действие.");
    }
    if (cmd === "product.barcode" && result.status !== "complete" && product.barcode !== fields.barcode) {
      throw new Error("Штрихкод не сохранён. Повторите подтверждение.");
    }
    if (cmd === "product.name" && (result.status !== "complete" || !product.name || !product.barcode)) {
      throw new Error("Наименование не сохранено. Повторите подтверждение.");
    }
    return result as ProductReply;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Скрипт не ответил вовремя. Повторите действие: повторный запрос не создаст второй товар.");
    }
    if (error instanceof TypeError) {
      throw new Error("Не удалось получить подтверждение от Google. Проверьте сеть и доступ скрипта, затем повторите действие.");
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}