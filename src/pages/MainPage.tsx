import { useEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent, Dispatch, KeyboardEvent, SetStateAction } from "react";
import { flushSync } from "react-dom";
import Barcode from "../components/Barcode";
import BarcodeScannerModal from "../components/BarcodeScannerModal";
import NewProductModal from "../components/NewProductModal";
import {
  AlertIcon,
  BarcodeLogo,
  CameraIcon,
  CheckIcon,
  PlusIcon,
  PrinterIcon,
  RefreshIcon,
  SpinnerIcon,
  TrashIcon,
  XIcon,
} from "../components/icons";
import { formatCount, formatDate, formatTime } from "../lib/format";
import { makeRow } from "../lib/rows";
import type { Row } from "../lib/rows";
import { CATEGORIES } from "../lib/settings";
import type { Category, CategoryId } from "../lib/settings";
import { normalizeBarcode, normalizeSku } from "../lib/sheet";
import type { Product, SheetData } from "../lib/sheet";
import { clearRows, isScriptConfigured, sendRows } from "../lib/sync";
import type { SyncState } from "../lib/sync";
import { cn } from "../utils/cn";

type Field = "input" | "qty";
type LookupStatus = "empty" | "found" | "missing";

interface Resolved {
  row: Row;
  status: LookupStatus;
  product?: Product;
  /** Номер строки на печати; null — пустая строка, на печать не выводится */
  printNo: number | null;
}

interface ScanFeedback {
  rowId: number;
  barcode: string;
  message: string;
}

interface NewProductRequest {
  rowId: number;
  sku: string;
  catalogUrl: string;
  scriptUrl: string;
}

interface PasteEntry {
  input: string;
  qty?: string;
}

/**
 * Разбор вставки из буфера обмена.
 *
 * Поддерживаются пары «артикул → Tab → количество → Shift+Enter → …»:
 * Shift+Enter даёт перевод строки, Tab — разделитель столбцов, поэтому текст
 * выглядит как «12707791\t5\n82342710\t2». Так же разбирается обычное копирование
 * двух столбцов из Excel / Google Таблиц.
 *
 * Одна строка через «;» или «,» — список артикулов без количества.
 * Возвращает null для обычной вставки одного значения.
 */
function parseClipboard(text: string): PasteEntry[] | null {
  const lines = text.split(/\r\n|\r|\n/).filter((line) => line.trim());
  if (lines.length > 1 || text.includes("\t")) {
    const entries = lines
      .map((line) => {
        const cells = line.split("\t").map((cell) => cell.trim());
        const input = (cells[0] ?? "").trim();
        const qty = (cells[1] ?? "").trim();
        return { input, qty: qty || undefined };
      })
      .filter((entry) => entry.input || entry.qty);
    return entries.length ? entries : null;
  }
  const parts = text
    .split(/[;,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts.map((input) => ({ input })) : null;
}

/** Безопасное число строк на одном листе A4: штрихкоды и длинные названия не разрываются. */
const PRINT_ROWS_PER_PAGE = 12;

interface MainPageProps {
  rows: Row[];
  setRows: Dispatch<SetStateAction<Row[]>>;
  data: SheetData | null;
  loading: boolean;
  onRefresh: () => void;
  category: Category;
  /** gid листа записи (артикул + количество); пустая строка — запись выключена */
  logGid: string;
  onOpenSettings: () => void;
  logScriptUrl: string;
  /** Завершена ли первичная подгрузка записей из листа отдела */
  prefillReady: boolean;
  catalogUrl: string;
  onProductAdded: (product: Product) => void;
}

export default function MainPage({
  rows,
  setRows,
  data,
  loading,
  onRefresh,
  category,
  logGid,
  onOpenSettings,
  logScriptUrl,
  prefillReady,
  catalogUrl,
  onProductAdded,
}: MainPageProps) {
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const [printDate, setPrintDate] = useState(() => new Date());
  const [scannerRowId, setScannerRowId] = useState<number | null>(null);
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback | null>(null);
  const [newProduct, setNewProduct] = useState<NewProductRequest | null>(null);
  const [enteredSku, setEnteredSku] = useState<{ rowId: number; sku: string } | null>(null);
  const offeredSkus = useRef(new Map<number, string>());

  const refKey = (id: number, field: Field) => `${id}:${field}`;

  // Only user input can open the dialog; restored rows and background refreshes cannot.
  useEffect(() => {
    if (!enteredSku || newProduct || scannerRowId !== null || loading || !prefillReady || data?.source !== "live") return;
    const key = normalizeSku(enteredSku.sku);
    if (!key || data.products.has(key) || offeredSkus.current.get(enteredSku.rowId) === key) return;
    if (!rows.some((row) => row.id === enteredSku.rowId && normalizeSku(row.input) === key)) return;
    const timer = window.setTimeout(() => {
      offeredSkus.current.set(enteredSku.rowId, key);
      setNewProduct({ ...enteredSku, sku: enteredSku.sku.trim(), catalogUrl, scriptUrl: logScriptUrl });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [enteredSku, newProduct, scannerRowId, loading, prefillReady, data, rows, catalogUrl, logScriptUrl]);

  // Синхронизация артикулов и количества с листом выбранного отдела
  const [syncState, setSyncState] = useState<SyncState>({ kind: "idle" });
  const syncTimer = useRef<number | undefined>(undefined);
  const lastSynced = useRef<{ key: string; categoryId: CategoryId } | null>(null);
  const skipNextSync = useRef(false);
  const syncActive = isScriptConfigured(logScriptUrl) && !!logGid;

  useEffect(() => {
    window.clearTimeout(syncTimer.current);
    // Пока отправка невозможна (нет URL или идёт первичная подгрузка) — только
    // запоминаем начальное состояние один раз. Тогда данные, введённые до
    // готовности, отправятся при первой возможности, а пустая форма при этом
    // никогда не затрут содержимое листа.
    if (!syncActive) {
      if (lastSynced.current === null) {
        lastSynced.current = { key: JSON.stringify(rows), categoryId: category.id };
      }
      setSyncState({ kind: "disabled" });
      return;
    }
    if (!prefillReady) {
      if (lastSynced.current === null) {
        lastSynced.current = { key: JSON.stringify(rows), categoryId: category.id };
      }
      return;
    }
    // При первом открытии и переключении без изменений не перезаписываем чужой лист.
    if (skipNextSync.current) {
      skipNextSync.current = false;
      lastSynced.current = { key: JSON.stringify(rows), categoryId: category.id };
      return;
    }
    const current = { key: JSON.stringify(rows), categoryId: category.id };
    // Самый первый запуск страницы: не отправляем пустой список и не стираем лист.
    if (lastSynced.current === null) {
      lastSynced.current = current;
      return;
    }
    if (lastSynced.current.key === current.key && lastSynced.current.categoryId === current.categoryId) return;
    lastSynced.current = current;

    const payload = rows
      .map((r) => ({ sku: r.input.trim(), qty: r.qty.trim() }))
      .filter((r) => r.sku || r.qty);
    setSyncState({ kind: "syncing" });
    syncTimer.current = window.setTimeout(async () => {
      const res = await sendRows(logScriptUrl, logGid, payload);
      setSyncState(
        res.ok
          ? { kind: "ok", count: res.count ?? payload.length, at: new Date() }
          : { kind: "error", message: res.error ?? "Не удалось записать" }
      );
    }, 800);
    return () => window.clearTimeout(syncTimer.current);
  }, [rows, syncActive, logScriptUrl, category.id, logGid, prefillReady]);

  // Фокус на поле ввода при открытии страницы
  useEffect(() => {
    const first = rows[0];
    if (rows.length === 1 && first && !first.input) inputRefs.current.get(refKey(first.id, "input"))?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Перед печатью: актуальная дата и заголовок документа (он же — имя файла при сохранении в PDF)
  useEffect(() => {
    let savedTitle = document.title;
    const onBeforePrint = () => {
      const now = new Date();
      flushSync(() => setPrintDate(now));
      savedTitle = document.title;
      document.title = `${category.title} ${formatDate(now)}`;
    };
    const onAfterPrint = () => {
      document.title = savedTitle;
    };
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, [category.title]);

  const resolved: Resolved[] = useMemo(() => {
    let printNo = 0;
    return rows.map((row) => {
      const key = normalizeSku(row.input);
      const isBlank = !key && !row.qty.trim();
      const no = isBlank ? null : ++printNo;
      if (!key) return { row, status: "empty" as const, printNo: no };
      const product = data?.products.get(key);
      return product
        ? { row, status: "found" as const, product, printNo: no }
        : { row, status: "missing" as const, printNo: no };
    });
  }, [rows, data]);

  const stats = useMemo(() => {
    const filled = resolved.filter((r) => r.status !== "empty").length;
    const found = resolved.filter((r) => r.status === "found").length;
    return { filled, found, missing: filled - found };
  }, [resolved]);

  // Обратный индекс: от считанного штрихкода к товару из текущей таблицы
  const productsByBarcode = useMemo(() => {
    const result = new Map<string, Product>();
    data?.products.forEach((product) => {
      const key = normalizeBarcode(product.barcode);
      if (key && !result.has(key)) result.set(key, product);
    });
    return result;
  }, [data]);

  const focusField = (index: number, field: Field) => {
    const row = rows[index];
    if (row) inputRefs.current.get(refKey(row.id, field))?.focus();
  };

  const focusLater = (id: number) =>
    requestAnimationFrame(() => inputRefs.current.get(refKey(id, "input"))?.focus());

  const updateRow = (id: number, patch: Partial<Omit<Row, "id">>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const changeSku = (rowId: number, input: string) => {
    updateRow(rowId, { input });
    if (offeredSkus.current.get(rowId) !== normalizeSku(input)) offeredSkus.current.delete(rowId);
    setEnteredSku({ rowId, sku: input });
  };

  const offerProduct = (row: Row) => {
    const sku = row.input.trim();
    if (!sku || loading || data?.source !== "live" || data.products.has(normalizeSku(sku))) return false;
    offeredSkus.current.set(row.id, normalizeSku(sku));
    setNewProduct({ rowId: row.id, sku, catalogUrl, scriptUrl: logScriptUrl });
    return true;
  };

  const productAdded = (product: Product) => {
    if (!newProduct) return;
    const rowId = newProduct.rowId;
    if (newProduct.catalogUrl === catalogUrl) {
      onProductAdded(product);
      updateRow(rowId, { input: product.sku });
    }
    setNewProduct(null);
    setEnteredSku(null);
    setScanFeedback(null);
    onRefresh();
    requestAnimationFrame(() => inputRefs.current.get(refKey(rowId, "qty"))?.focus());
  };

  const openScanner = (rowId: number) => {
    setScanFeedback(null);
    setScannerRowId(rowId);
  };

  const handleBarcodeDetected = (barcode: string) => {
    const rowId = scannerRowId;
    const product = productsByBarcode.get(normalizeBarcode(barcode));
    setScannerRowId(null);
    if (rowId === null) return;

    if (product) {
      // Артикул запускает штатный поиск: штрихкод и наименование появятся в строке сами
      updateRow(rowId, { input: product.sku });
      focusLater(rowId);
    } else {
      setScanFeedback({
        rowId,
        barcode,
        message: "Штрихкод считан, но товара с таким кодом нет в текущей таблице",
      });
    }
  };

  const addRow = () => {
    const row = makeRow();
    setRows((prev) => [...prev, row]);
    focusLater(row.id);
  };

  const removeRow = (id: number) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : [makeRow()]));
  };

  const clearAll = async () => {
    if (syncActive && isScriptConfigured(logScriptUrl)) {
      setSyncState({ kind: "syncing" });
      const res = await clearRows(logScriptUrl, logGid);
      setSyncState(
        res.ok ? { kind: "ok", count: 0, at: new Date() } : { kind: "error", message: res.error ?? "Не удалось очистить" }
      );
      // Очистка уже отправлена — не дублируем её отложенной синхронизацией
      skipNextSync.current = true;
    }
    const row = makeRow();
    setRows([row]);
    focusLater(row.id);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number, field: Field) => {
    // Shift+Enter работает как Enter — переход к следующей строке
    if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[index];
      if (field === "input" && row && offerProduct(row)) return;
      if (index < rows.length - 1) focusField(index + 1, "input");
      else if (row && (row.input.trim() || row.qty.trim())) addRow();
    } else if (e.key === "Tab" && field === "qty" && !e.shiftKey) {
      // Tab из «Количества» — сразу к артикулу следующей строки
      e.preventDefault();
      if (index < rows.length - 1) focusField(index + 1, "input");
      else if (rows[index]?.input.trim() || rows[index]?.qty.trim()) addRow();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      focusField(index + 1, field);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusField(index - 1, field);
    }
  };

  /**
   * Вставка списка в таблицу, начиная с текущей строки.
   * Артикулы всегда попадают в столбец «Артикул», количества — в «Количество».
   * В той ячейке, куда вставляли, при отсутствии своего значения остаётся прежнее.
   */
  const handlePaste = (e: ClipboardEvent<HTMLInputElement>, index: number, anchor: Field) => {
    const entries = parseClipboard(e.clipboardData.getData("text"));
    if (!entries) return;
    e.preventDefault();
    if (rows[index]) setEnteredSku({ rowId: rows[index].id, sku: entries[0].input });
    setRows((prev) => {
      const next = [...prev];
      entries.forEach((entry, i) => {
        const pos = index + i;
        const first = i === 0;
        const base = next[pos] ?? makeRow();
        const qty = entry.qty ?? (first ? base.qty : "");
        const input = entry.input || (first ? base.input : "");
        next[pos] = { ...base, input, qty };
      });
      return next;
    });
    requestAnimationFrame(() => {
      const target = rows[index + entries.length];
      if (target) inputRefs.current.get(refKey(target.id, anchor))?.focus();
    });
  };

  const showNotice = !!data && !loading && data.count === 0;

  return (
    <>
      <div className="min-h-screen bg-slate-50 text-slate-900 print:hidden">
      {/* Шапка */}
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <a href="#/" className="flex items-center gap-2.5" aria-label="Списание — на главную">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                <BarcodeLogo className="h-6 w-6" />
              </span>
              <span className="text-base font-semibold tracking-tight">Списание</span>
            </a>
            <span className="hidden h-6 w-px bg-slate-200 sm:block" />
            <nav aria-label="Страницы отделов" className="flex flex-wrap items-center gap-1">
              {CATEGORIES.map((c) => (
                <a
                  key={c.id}
                  href={`#/${c.id}`}
                  aria-current={c.id === category.id ? "page" : undefined}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition",
                    c.id === category.id
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  {c.title}
                </a>
              ))}
            </nav>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <DataStatus data={data} loading={loading} />
            <button
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshIcon className={cn("h-4 w-4", loading && "animate-spin")} />
              Обновить
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 print:max-w-none print:px-0 print:py-0">
        <div className="mb-4 print:hidden">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{category.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Страница отдела: артикулы, штрихкоды и наименования товаров
          </p>
        </div>

        {showNotice && (
          <div
            className={cn(
              "mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm print:hidden",
              data.source === "none"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            )}
          >
            <span className="flex items-center gap-2">
              <AlertIcon className="h-4 w-4 shrink-0" />
              {data.source === "none" ? (
                <>
                  Не удалось загрузить таблицу «{category.title}». {data.error}
                </>
              ) : (
                <>Таблица «{category.title}» пока пуста — заполните её или укажите другую ссылку.</>
              )}
            </span>
            <button onClick={onOpenSettings} className="font-medium underline underline-offset-2 hover:no-underline">
              Открыть настройки
            </button>
          </div>
        )}

        {/* Панель действий */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Chip label="Заполнено" value={stats.filled} tone="slate" />
            <Chip label="Найдено" value={stats.found} tone="emerald" />
            <Chip label="Не найдено" value={stats.missing} tone="rose" />
            <SyncIndicator state={syncState} active={syncActive} />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearAll}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Очистить
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              <PrinterIcon className="h-4 w-4" />
              Печать
            </button>
          </div>
        </div>

        {/* Таблица */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
          <div className="main-table-scroll overflow-x-auto print:overflow-visible">
            <table className="main-entry-table w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <th className="w-12 px-3 py-3 text-center">#</th>
                  <th className="w-52 px-4 py-3 text-center">Артикул</th>
                  <th className="w-64 px-4 py-3 text-center">Штрихкод</th>
                  <th className="px-4 py-3 text-left">Наименование</th>
                  <th className="w-36 px-4 py-3 text-center">Количество</th>
                  <th className="w-12 px-2 py-3">
                    <span className="sr-only">Удалить</span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {resolved.map(({ row, status, product }, index) => (
                  <tr
                    key={row.id}
                    className={cn(
                       "border-t border-slate-100 transition-colors",
                       status === "missing" ? "bg-rose-50/60" : "bg-white"
                    )}
                  >
                    <td
                      data-mobile-label="#"
                      className={cn(
                        "px-3 py-3 text-center align-middle tabular-nums text-slate-400"
                      )}
                    >
                      {index + 1}
                    </td>

                    {/* Артикул */}
                    <td data-mobile-label="Артикул" className="px-4 py-3 text-center align-middle">
                      <input
                        ref={(el) => {
                          if (el) inputRefs.current.set(refKey(row.id, "input"), el);
                          else inputRefs.current.delete(refKey(row.id, "input"));
                        }}
                        value={row.input}
                        onChange={(e) => changeSku(row.id, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index, "input")}
                        onPaste={(e) => handlePaste(e, index, "input")}
                        placeholder="Введите артикул"
                        aria-label={`Артикул, строка ${index + 1}`}
                        inputMode="numeric"
                        autoComplete="off"
                        spellCheck={false}
                        className={cn(
                          "w-full rounded-lg border px-3 py-2 text-center font-mono text-base outline-none transition placeholder:font-sans placeholder:text-sm",
                          "focus:ring-2 focus:ring-offset-0",
                          status === "found" &&
                            "border-emerald-300 bg-emerald-50/40 focus:border-emerald-400 focus:ring-emerald-200",
                          status === "missing" && "border-rose-300 bg-white focus:border-rose-400 focus:ring-rose-200",
                          status === "empty" && "border-slate-200 bg-white focus:border-slate-400 focus:ring-slate-200"
                        )}
                      />
                    </td>

                    {/* Штрихкод */}
                    <td data-mobile-label="Штрихкод" className="px-4 py-2 text-center align-middle">
                      <div className="flex flex-col items-center gap-2">
                        {status === "found" && product?.barcode ? (
                          <Barcode value={product.barcode} className="flex flex-col items-center" />
                        ) : status === "missing" ? (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-md bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700"
                            title="Товара нет в загруженных данных. Если он недавно добавлен в таблицу, нажмите «Обновить»"
                          >
                            <XIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                            Артикул не найден
                          </span>
                        ) : status === "found" ? (
                          <span className="text-xs text-slate-400">Штрихкод отсутствует</span>
                        ) : null}

                        {status === "missing" && (
                          <button
                            type="button"
                            onClick={() => offerProduct(row)}
                            disabled={loading || data?.source !== "live"}
                            className="text-xs font-medium text-slate-700 underline underline-offset-2 disabled:opacity-50"
                          >
                            Добавить в базу
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => openScanner(row.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                        >
                          <CameraIcon className="h-4 w-4" />
                          Открыть камеру
                        </button>

                        {scanFeedback?.rowId === row.id && (
                          <span className="max-w-48 text-xs leading-snug text-rose-600" title={scanFeedback.barcode}>
                            {scanFeedback.message}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Наименование */}
                    <td data-mobile-label="Наименование" className="px-4 py-3 align-middle">
                      {status === "found" ? (
                        <span className="text-slate-800">
                          {product?.name || <span className="text-slate-400">Без наименования</span>}
                        </span>
                      ) : status === "missing" ? (
                        <span className="text-rose-600/80">Нет данных в таблице</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Количество — свободный ввод, ни на что не влияет */}
                    <td data-mobile-label="Количество" className="px-4 py-3 text-center align-middle">
                      <input
                        ref={(el) => {
                          if (el) inputRefs.current.set(refKey(row.id, "qty"), el);
                          else inputRefs.current.delete(refKey(row.id, "qty"));
                        }}
                        value={row.qty}
                        onChange={(e) => updateRow(row.id, { qty: e.target.value })}
                        onKeyDown={(e) => handleKeyDown(e, index, "qty")}
                        onPaste={(e) => handlePaste(e, index, "qty")}
                        aria-label={`Количество, строка ${index + 1}`}
                        inputMode="decimal"
                        autoComplete="off"
                        spellCheck={false}
                        className="w-full min-w-16 rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-base tabular-nums outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                      />
                    </td>

                    <td className="px-2 py-3 text-center align-middle">
                      <button
                        onClick={() => removeRow(row.id)}
                        title="Удалить строку"
                        aria-label={`Удалить строку ${index + 1}`}
                        className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-rose-600"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>

            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3 print:hidden">
            <button
              onClick={addRow}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 hover:text-slate-900"
            >
              <PlusIcon className="h-4 w-4" /> Добавить строку
            </button>
          </div>
        </div>
      </main>
      </div>

      {scannerRowId !== null && (
        <BarcodeScannerModal
          onDetected={handleBarcodeDetected}
          onClose={() => setScannerRowId(null)}
        />
      )}

      {newProduct && (
        <NewProductModal
          key={`${newProduct.rowId}:${newProduct.sku}`}
          sku={newProduct.sku}
          categoryTitle={category.title}
          catalogUrl={newProduct.catalogUrl}
          scriptUrl={newProduct.scriptUrl}
          onComplete={productAdded}
          onClose={() => { setNewProduct(null); setEnteredSku(null); onRefresh(); }}
        />
      )}

      <PrintDocument
        items={resolved.filter((item) => item.printNo !== null)}
        category={category}
        printDate={printDate}
      />
    </>
  );
}

interface PrintDocumentProps {
  items: Resolved[];
  category: Category;
  printDate: Date;
}

/**
 * Отдельная разметка для печати: страницы собраны заранее, поэтому номер
 * «Страница X из Y» является настоящей ячейкой таблицы, а не колонтитулом браузера.
 */
function PrintDocument({ items, category, printDate }: PrintDocumentProps) {
  const pages = chunk(items, PRINT_ROWS_PER_PAGE);
  // Даже пустая таблица остаётся корректным одностраничным печатным бланком.
  const safePages = pages.length ? pages : [[]];

  return (
    <div className="print-document">
      {safePages.map((pageItems, pageIndex) => (
        <section className="print-page" key={pageIndex}>
          <table className="print-output-table">
            <colgroup>
              <col className="print-col-number" />
              <col className="print-col-sku" />
              <col className="print-col-barcode" />
              <col />
              <col className="print-col-qty" />
            </colgroup>
            <thead>
              <tr>
                <th colSpan={3} className="print-title-cell">
                  {category.title}
                </th>
                <th className="print-title-cell">{formatDate(printDate)}</th>
                <th className="print-title-cell">
                  {pageIndex + 1}/{safePages.length}
                </th>
              </tr>
              <tr className="print-column-headings">
                <th>№</th>
                <th>Артикул</th>
                <th>Штрихкод</th>
                <th>Наименование</th>
                <th>Количество</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map(({ row, status, product, printNo }) => (
                <tr key={row.id}>
                  <td className="print-cell-center">{printNo}</td>
                  <td className="print-cell-center print-sku">{row.input.trim()}</td>
                  <td className="print-cell-center print-barcode-cell">
                    {status === "found" && product?.barcode ? (
                      <Barcode value={product.barcode} height={42} className="print-barcode" />
                    ) : status === "missing" ? (
                      <span className="print-missing">Артикул не найден</span>
                    ) : status === "found" ? (
                      <span>Штрихкод отсутствует</span>
                    ) : null}
                  </td>
                  <td>{status === "found" ? product?.name || "Без наименования" : status === "missing" ? "Нет данных в таблице" : ""}</td>
                  <td className="print-cell-center">{row.qty.trim()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

function SyncIndicator({ state, active }: { state: SyncState; active: boolean }) {
  if (!active) return null;
  switch (state.kind) {
    case "syncing":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
          <SpinnerIcon className="h-3 w-3 animate-spin" />
          Сохранение…
        </span>
      );
    case "ok":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
          <CheckIcon className="h-3 w-3" strokeWidth={2.5} />
          Сохранено в таблицу ({state.count})
        </span>
      );
    case "error":
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-800"
          title={state.message}
        >
          <AlertIcon className="h-3 w-3" />
          {state.message.includes("старая версия") ? "Обновите Apps Script" : "Ошибка записи"}
        </span>
      );
    default:
      return null;
  }
}

function Chip({ label, value, tone }: { label: string; value: number; tone: "slate" | "emerald" | "rose" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-700",
    rose: "bg-rose-100 text-rose-700",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium", tones[tone])}>
      {label}
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

function DataStatus({ data, loading }: { data: SheetData | null; loading: boolean }) {
  if (!data) {
    return loading ? (
      <span className="inline-flex items-center gap-2 text-sm text-slate-500">
        <SpinnerIcon className="h-4 w-4 animate-spin" />
        Загрузка таблицы…
      </span>
    ) : null;
  }

  const dot = loading
    ? "animate-pulse bg-amber-400"
    : data.source === "live"
      ? "bg-emerald-500"
      : data.source === "none"
        ? "bg-rose-500"
        : "bg-amber-400";

  const label = loading
    ? "Обновление…"
    : data.source === "live"
      ? null
      : data.source === "none"
        ? "Нет данных"
        : "Офлайн-копия";

  const title =
    data.source === "live"
      ? "Актуальные данные"
      : data.error
        ? `Нет связи с таблицей: ${data.error}`
        : "Показана сохранённая копия";

  return (
    <div className="flex items-center gap-2 text-sm" title={title}>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", dot)} />
      <span className="text-slate-600">
        {label && <span>{label} · </span>}
        {formatCount(data.count)}
        {data.loadedAt && <span className="text-slate-400"> · {formatTime(data.loadedAt)}</span>}
      </span>
    </div>
  );
}
