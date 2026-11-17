import { useCallback, useEffect, useRef, useState } from "react";
import type { CategoryId } from "../lib/settings";

export type PageRoute = CategoryId | "admin";

/** Последний сегмент: /01_dept или /REPO/01_dept — без решётки */
export function parsePagePath(path: string): PageRoute | null {
  const segment = path.replace(/\/+$/, "").split("/").pop() ?? "";
  if (segment === "01_dept" || segment === "02_dept" || segment === "admin") return segment;
  return null;
}

export function pagePath(route: PageRoute, basePath = ""): string {
  return `${basePath}/${route}`;
}

/** Чистые адреса с учётом подпапки GitHub Pages (/REPO/01_dept) */
export function usePageRoute(defaultPage: CategoryId) {
  const [route, setRoute] = useState<PageRoute | null>(() => parsePagePath(window.location.pathname));
  const initialPage = useRef(defaultPage);
  const [basePath] = useState(() => new URL("./", window.location.href).pathname.replace(/\/+$/, ""));

  useEffect(() => {
    const onPopState = () => {
      setRoute(parsePagePath(window.location.pathname));
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // При первом открытии: канонический адрес; старые hash-ссылки перенаправляем на чистые
  useEffect(() => {
    const legacy = window.location.hash.match(/^#\/(construction|joinery|admin)\b/);
    const legacyMap: Record<string, PageRoute> = {
      construction: "01_dept",
      joinery: "02_dept",
      admin: "admin",
    };
    const target = parsePagePath(window.location.pathname)
      ?? (legacy ? legacyMap[legacy[1]] : initialPage.current);
    const cleanPath = pagePath(target, basePath);
    if (window.location.pathname !== cleanPath || legacy) {
      window.history.replaceState(null, "", cleanPath + window.location.search);
    }
    setRoute(target);
  }, [basePath]);

  // Если ссылку с # вставили в уже открытый сайт, тоже перенаправляем без hash
  useEffect(() => {
    const redirectLegacyHash = () => {
      const match = window.location.hash.match(/^#\/(construction|joinery|admin)\b/);
      if (!match) return;
      const target: PageRoute = match[1] === "construction" ? "01_dept" : match[1] === "joinery" ? "02_dept" : "admin";
      const cleanPath = pagePath(target, basePath);
      window.history.replaceState(null, "", cleanPath + window.location.search);
      setRoute(target);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", redirectLegacyHash);
    return () => window.removeEventListener("hashchange", redirectLegacyHash);
  }, [basePath]);

  const navigate = useCallback((next: PageRoute) => {
    const path = pagePath(next, basePath);
    if (window.location.pathname !== path) window.history.pushState(null, "", path + window.location.search);
    setRoute(next);
    window.scrollTo(0, 0);
  }, [basePath]);

  const replace = useCallback((next: PageRoute) => {
    const path = pagePath(next, basePath);
    if (window.location.pathname !== path) window.history.replaceState(null, "", path + window.location.search);
    setRoute(next);
  }, [basePath]);

  return { route, navigate, replace, basePath } as const;
}
