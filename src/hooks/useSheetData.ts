import { useCallback, useEffect, useRef, useState } from "react";
import { cacheConfirmedProducts, getOfflineData, loadSheet, normalizeSku, parseSheetUrl } from "../lib/sheet";
import type { Product, SheetData } from "../lib/sheet";

interface State {
  data: SheetData | null;
  loading: boolean;
}

/** Как часто сайт сам перечитывает таблицу, пока страница открыта */
const AUTO_REFRESH_MS = 30000;

interface LoadOptions {
  /** Тихое обновление: не показываем индикатор загрузки в шапке */
  silent?: boolean;
}

/**
 * Загружает таблицу по ссылке: мгновенно показывает сохранённую копию,
 * затем подтягивает актуальные данные.
 *
 * Пока страница открыта, данные перечитываются автоматически — иначе товары,
 * добавленные в Google Таблицу после открытия сайта, не найдены бы.
 */
export function useSheetData(url: string) {
  const [state, setState] = useState<State>({ data: null, loading: true });
  const requestRef = useRef(0);
  const confirmedRef = useRef(new Map<string, Map<string, Product>>());

  const load = useCallback(
    async (options?: LoadOptions) => {
      const requestId = ++requestRef.current;
      const ref = parseSheetUrl(url);
      if (!ref) {
        setState({
          data: {
            products: new Map(),
            count: 0,
            source: "none",
            loadedAt: null,
            error: url.trim()
              ? "Некорректная ссылка на таблицу"
              : "Таблица товаров не задана — укажите ссылку на странице «Настройки»",
          },
          loading: false,
        });
        return;
      }
      if (!options?.silent) setState((s) => ({ ...s, loading: true }));
      const data = await loadSheet(ref);
      const confirmed = confirmedRef.current.get(url);
      // CSV export can lag behind acknowledged Apps Script writes.
      confirmed?.forEach((product, key) => {
        const received = data.products.get(key);
        if (data.source === "live" && received?.barcode === product.barcode && received.name === product.name) {
          confirmed.delete(key);
        } else {
          data.products.set(key, product);
        }
      });
      data.count = data.products.size;
      // Игнорируем устаревшие ответы (например, если категорию успели переключить)
      if (requestId === requestRef.current) setState({ data, loading: false });
    },
    [url]
  );

  // Первичная загрузка: сразу кэш/встроенная копия, затем актуальные данные
  useEffect(() => {
    const ref = parseSheetUrl(url);
    setState({ data: ref ? getOfflineData(ref) : null, loading: true });
    void load();
  }, [url, load]);

  // Автообновление: раз в 30 секунд и при возврате на вкладку браузера
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) void load({ silent: true });
    };
    const interval = window.setInterval(tick, AUTO_REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [load]);

  const refresh = useCallback(() => void load(), [load]);

  const acceptProduct = useCallback((product: Product) => {
    const ref = parseSheetUrl(url);
    if (!ref) return;
    const additions = confirmedRef.current.get(url) ?? new Map<string, Product>();
    additions.set(normalizeSku(product.sku), product);
    confirmedRef.current.set(url, additions);
    setState((previous) => {
      const base = previous.data ?? getOfflineData(ref);
      const products = new Map(base?.products);
      products.set(normalizeSku(product.sku), product);
      cacheConfirmedProducts(ref, products);
      return {
        ...previous,
        data: { products, count: products.size, source: base?.source ?? "live", loadedAt: base?.loadedAt ?? new Date(), error: base?.error },
      };
    });
  }, [url]);

  return { ...state, refresh, acceptProduct };
}
