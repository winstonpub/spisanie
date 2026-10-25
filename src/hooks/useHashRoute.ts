import { useCallback, useEffect, useState } from "react";
import { isCategoryId } from "../lib/settings";
import type { CategoryId } from "../lib/settings";

export type PageRoute = CategoryId | "admin";

/** Разбирает адрес: #/construction, #/joinery, #/admin. Неизвестный адрес — null. */
export function parseRoute(hash: string): PageRoute | null {
  const segment = hash.replace(/^#\/?/, "").split(/[/?]/)[0];
  if (segment === "admin") return "admin";
  if (isCategoryId(segment)) return segment;
  return null;
}

/** Адреса страниц: у каждого отдела своя ссылка, плюс страница настроек. */
export function routeHash(route: PageRoute): string {
  return `#/${route}`;
}

/** Простая маршрутизация через хэш: работает в собранном одностраничном файле */
export function useHashRoute() {
  const [route, setRoute] = useState<PageRoute | null>(() => parseRoute(window.location.hash));

  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((next: PageRoute) => {
    const hash = routeHash(next);
    if (window.location.hash === hash) return;
    window.location.hash = hash;
    window.scrollTo(0, 0);
  }, []);

  /** Заменяет адрес без записи в историю (для канонического вида ссылки) */
  const replace = useCallback((next: PageRoute) => {
    if (window.location.hash !== routeHash(next)) {
      window.history.replaceState(null, "", routeHash(next));
    }
  }, []);

  return { route, navigate, replace } as const;
}
