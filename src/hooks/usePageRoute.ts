import { useCallback, useEffect, useRef, useState } from "react";
import type { CategoryId } from "../lib/settings";

export type PageRoute = CategoryId | "admin";
export type ResolvedRoute = PageRoute | "notfound";

function stripBase(pathname: string, basePath: string): string {
  if (basePath && (pathname === basePath || pathname.startsWith(`${basePath}/`))) {
    return pathname.slice(basePath.length) || "/";
  }
  return pathname;
}

/** Относительный путь: /01_dept, /02_dept, /admin — без решётки; неизвестный — notfound */
export function parsePagePath(pathname: string, basePath = ""): PageRoute | "notfound" | null {
  const segment = stripBase(pathname, basePath)
    .replace(/^\/+|\/+$/g, "")
    .split("/")[0];
  if (!segment) return null;
  if (segment === "01_dept" || segment === "02_dept" || segment === "admin") return segment;
  return "notfound";
}

export function pagePath(route: PageRoute, basePath = ""): string {
  return `${basePath}/${route}`;
}

/** Чистые адреса с учётом подпапки GitHub Pages (/REPO/01_dept) */
export function usePageRoute(defaultPage: CategoryId) {
  const [basePath] = useState(() => new URL("./", window.location.href).pathname.replace(/\/+$/, ""));
  const [route, setRoute] = useState<PageRoute | "notfound" | null>(() =>
    parsePagePath(window.location.pathname, new URL("./", window.location.href).pathname.replace(/\/+$/, "")),
  );
  const initialPage = useRef(defaultPage);

  useEffect(() => {
    const onPopState = () => {
      setRoute(parsePagePath(window.location.pathname, basePath));
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [basePath]);

  // При первом открытии: канонический адрес; старые hash-ссылки перенаправляем на чистые.
  // Неизвестный адрес не трогаем — показываем страницу 404 на нём же.
  useEffect(() => {
    const legacy = window.location.hash.match(/^#\/(construction|joinery|admin)\b/);
    const legacyMap: Record<string, PageRoute> = {
      construction: "01_dept",
      joinery: "02_dept",
      admin: "admin",
    };
    if (legacy) {
      const target = legacyMap[legacy[1]];
      window.history.replaceState(null, "", pagePath(target, basePath) + window.location.search);
      setRoute(target);
      return;
    }
    const parsed = parsePagePath(window.location.pathname, basePath);
    if (parsed === "notfound") {
      setRoute("notfound");
      return;
    }
    if (parsed) {
      setRoute(parsed);
      return;
    }
    const cleanPath = pagePath(initialPage.current, basePath);
    if (window.location.pathname !== cleanPath) {
      window.history.replaceState(null, "", cleanPath + window.location.search);
    }
    setRoute(initialPage.current);
  }, [basePath]);

  // Если ссылку с # вставили в уже открытый сайт, тоже перенаправляем без hash
  useEffect(() => {
    const redirectLegacyHash = () => {
      const match = window.location.hash.match(/^#\/(construction|joinery|admin)\b/);
      if (!match) return;
      const target: PageRoute =
        match[1] === "construction" ? "01_dept" : match[1] === "joinery" ? "02_dept" : "admin";
      const cleanPath = pagePath(target, basePath);
      window.history.replaceState(null, "", cleanPath + window.location.search);
      setRoute(target);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", redirectLegacyHash);
    return () => window.removeEventListener("hashchange", redirectLegacyHash);
  }, [basePath]);

  const navigate = useCallback(
    (next: PageRoute) => {
      const path = pagePath(next, basePath);
      if (window.location.pathname !== path) window.history.pushState(null, "", path + window.location.search);
      setRoute(next);
      window.scrollTo(0, 0);
    },
    [basePath],
  );

  const replace = useCallback(
    (next: PageRoute) => {
      const path = pagePath(next, basePath);
      if (window.location.pathname !== path)
        window.history.replaceState(null, "", path + window.location.search);
      setRoute(next);
    },
    [basePath],
  );

  return { route, navigate, replace, basePath } as const;
}
