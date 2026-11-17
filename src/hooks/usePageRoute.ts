import { useCallback, useEffect, useRef, useState } from "react";
import type { CategoryId } from "../lib/settings";

export type PageRoute = CategoryId | "admin" | "404";

const KNOWN_ROUTES: Record<string, PageRoute> = {
  "01_dept": "01_dept",
  "02_dept": "02_dept",
  admin: "admin",
  "404": "404",
};

const LEGACY_HASH_ROUTES: Record<string, PageRoute> = {
  "01_dept": "01_dept",
  "02_dept": "02_dept",
  construction: "01_dept",
  joinery: "02_dept",
  admin: "admin",
  "404": "404",
};

function normalizeBase(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "/" || trimmed === "." || trimmed === "./") return "";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.replace(/\/+$/, "");
}

/**
 * Определяет базовую подпапку сайта (например, "/spisanie" на GitHub Pages
 * или "" на корневом домене / localhost).
 */
export function detectBasePath(): string {
  const envBase = import.meta.env.VITE_BASE_PATH as string | undefined;
  if (typeof envBase === "string") return normalizeBase(envBase);

  const viteBase = import.meta.env.BASE_URL;
  if (viteBase && viteBase !== "/" && viteBase !== "./") return normalizeBase(viteBase);

  if (typeof window === "undefined") return "";
  const { protocol, hostname, pathname } = window.location;
  if (protocol !== "http:" && protocol !== "https:") return "";

  if (/\/index\.html$/i.test(pathname)) {
    return normalizeBase(pathname.replace(/\/index\.html$/i, ""));
  }

  const segments = pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);

  // На GitHub Pages (username.github.io/REPO/...) первый сегмент — имя репозитория
  if (/\.github\.io$/i.test(hostname) && segments.length > 0) {
    const first = segments[0];
    if (!(first.toLowerCase() in KNOWN_ROUTES)) {
      return `/${first}`;
    }
  }

  // Поддержка произвольной подпапки вида /REPO/01_dept, /REPO/02_dept, /REPO/admin, /REPO/404
  if (
    segments.length === 2 &&
    !(segments[0].toLowerCase() in KNOWN_ROUTES) &&
    segments[1].toLowerCase() in KNOWN_ROUTES
  ) {
    return `/${segments[0]}`;
  }

  return "";
}

function stripBase(pathname: string, basePath: string): string {
  let rest = pathname || "/";
  if (basePath && (rest === basePath || rest.startsWith(`${basePath}/`))) {
    rest = rest.slice(basePath.length) || "/";
  }
  rest = rest.replace(/\/index\.html$/i, "") || "/";
  return rest.startsWith("/") ? rest : `/${rest}`;
}

/**
 * Разбирает путь относительно basePath:
 * - "/" -> null (корень сайта — открываем страницу отдела по умолчанию);
 * - "/01_dept" | "/02_dept" | "/admin" | "/404" -> соответствующая страница;
 * - любой другой путь -> "404".
 */
export function resolvePathname(pathname: string, basePath = ""): PageRoute | null {
  const relative = stripBase(pathname, basePath).replace(/^\/+|\/+$/g, "");
  if (!relative) return null;
  const parts = relative.split("/");
  if (parts.length > 1) return "404";
  return KNOWN_ROUTES[parts[0].toLowerCase()] ?? "404";
}

export function pagePath(route: PageRoute, basePath = ""): string {
  return `${basePath}/${route}`;
}

function parseLegacyHash(hash: string): PageRoute | null {
  if (!hash.startsWith("#/")) return null;
  const clean = hash.slice(2).split(/[?#]/)[0].replace(/^\/+|\/+$/g, "");
  if (!clean) return null;
  const parts = clean.split("/");
  if (parts.length > 1) return "404";
  return LEGACY_HASH_ROUTES[parts[0].toLowerCase()] ?? "404";
}

/** Чистые адреса с поддержкой подпапки GitHub Pages и страницы 404 для неверных путей */
export function usePageRoute(defaultPage: CategoryId) {
  const [basePath] = useState(detectBasePath);
  const initialPage = useRef(defaultPage);
  const [route, setRoute] = useState<PageRoute>(() => {
    if (typeof window === "undefined") return defaultPage;
    const fromPath = resolvePathname(window.location.pathname, basePath);
    if (fromPath) return fromPath;
    const fromHash = parseLegacyHash(window.location.hash);
    return fromHash ?? defaultPage;
  });

  // Канонизация корня, завершающих слэшей и старых hash-ссылок
  useEffect(() => {
    const fromPath = resolvePathname(window.location.pathname, basePath);
    const hasLegacyHash = window.location.hash.startsWith("#/");
    const fromHash = parseLegacyHash(window.location.hash);

    if (fromPath === null) {
      const target = fromHash ?? initialPage.current;
      const cleanUrl = pagePath(target, basePath) + window.location.search;
      if (window.location.pathname !== pagePath(target, basePath) || hasLegacyHash) {
        window.history.replaceState(null, "", cleanUrl);
      }
      setRoute(target);
      return;
    }

    if (fromPath !== "404") {
      const canonical = pagePath(fromPath, basePath);
      if (window.location.pathname !== canonical) {
        window.history.replaceState(null, "", canonical + window.location.search + window.location.hash);
      }
    }
    setRoute(fromPath);
  }, [basePath]);

  useEffect(() => {
    const onPopState = () => {
      const next = resolvePathname(window.location.pathname, basePath) ?? initialPage.current;
      setRoute(next);
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [basePath]);

  // Если ссылку с #/ вставили в уже открытый сайт, перенаправляем на чистый URL
  useEffect(() => {
    const onHashChange = () => {
      if (!window.location.hash.startsWith("#/")) return;
      const target = parseLegacyHash(window.location.hash) ?? initialPage.current;
      const cleanPath = pagePath(target, basePath);
      window.history.replaceState(null, "", cleanPath + window.location.search);
      setRoute(target);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [basePath]);

  const navigate = useCallback(
    (next: PageRoute) => {
      const path = pagePath(next, basePath);
      if (window.location.pathname !== path || window.location.hash) {
        window.history.pushState(null, "", path + window.location.search);
      }
      setRoute(next);
      window.scrollTo(0, 0);
    },
    [basePath],
  );

  const replace = useCallback(
    (next: PageRoute) => {
      const path = pagePath(next, basePath);
      if (window.location.pathname !== path || window.location.hash) {
        window.history.replaceState(null, "", path + window.location.search);
      }
      setRoute(next);
    },
    [basePath],
  );

  return { route, navigate, replace, basePath } as const;
}
