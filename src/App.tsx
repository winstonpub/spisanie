import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import SettingsButton from "./components/SettingsButton";
import { usePageRoute } from "./hooks/usePageRoute";
import { useSheetData } from "./hooks/useSheetData";
import { makeRow } from "./lib/rows";
import type { Row } from "./lib/rows";
import { fetchLogRows } from "./lib/logSheet";
import { fetchRemoteScriptUrl } from "./lib/remoteConfig";
import { CATEGORIES, getCategory, loadSettings, logGidOf, saveSettings, SETTINGS_STORAGE_KEY } from "./lib/settings";
import type { CategoryId, Settings } from "./lib/settings";
import AdminPage from "./pages/AdminPage";
import NotFoundPage from "./pages/NotFoundPage";
import Page01Dept from "./pages/01_dept";
import Page02Dept from "./pages/02_dept";

const APP_TITLE = "Списание";
type RowsByCategory = Record<CategoryId, Row[]>;
type FlagsByCategory = Record<CategoryId, boolean>;

const initialRows = (): RowsByCategory => ({
  "01_dept": [makeRow()],
  "02_dept": [makeRow()],
});
const byCategory = <T,>(make: () => T): Record<CategoryId, T> =>
  Object.fromEntries(CATEGORIES.map((c) => [c.id, make()])) as Record<CategoryId, T>;

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const { route, navigate, replace, basePath } = usePageRoute(settings.active);
  const [rowsByCategory, setRowsByCategory] = useState<RowsByCategory>(initialRows);
  const [logReady, setLogReady] = useState<FlagsByCategory>(() => byCategory(() => false));

  const updateSettings = useCallback((next: Settings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  const page: CategoryId | "admin" = route === null || route === "notfound" ? settings.active : route;
  const activeId: CategoryId = page === "admin" ? settings.active : page;
  const category = getCategory(activeId);
  const { data, loading, refresh, acceptProduct } = useSheetData(settings.links[activeId]);

  useEffect(() => {
    if (page !== "admin" && settings.active !== page) updateSettings({ ...settings, active: page });
  }, [page, settings, updateSettings]);

  // При первом запуске подгружаем URL скрипта и записи из листов отделов
  useEffect(() => {
    void fetchRemoteScriptUrl().then((remoteUrl) => {
      if (remoteUrl) {
        setSettings((prev) => {
          if (prev.logScriptUrl !== remoteUrl) {
            const updated = { ...prev, logScriptUrl: remoteUrl };
            saveSettings(updated);
            return updated;
          }
          return prev;
        });
      }
    });
    for (const c of CATEGORIES) {
      const gid = c.logGid;
      if (!gid) {
        setLogReady((prev) => (prev[c.id] ? prev : { ...prev, [c.id]: true }));
        continue;
      }
      void fetchLogRows(gid).then((entries) => {
        if (entries.length > 0) {
          setRowsByCategory((prev) => {
            const current = prev[c.id];
            const pristine = current.length === 1 && !current[0].input && !current[0].qty;
            if (!pristine) return prev;
            return { ...prev, [c.id]: entries.map((e) => makeRow(e.sku, e.qty)) };
          });
        }
        setLogReady((prev) => ({ ...prev, [c.id]: true }));
      });
    }
  }, []);

  useEffect(() => {
    if (route === null) replace(page);
  }, [route, page, replace]);

  const rows = rowsByCategory[activeId];
  const setRows: Dispatch<SetStateAction<Row[]>> = useCallback(
    (updater) => {
      setRowsByCategory((prev) => {
        const current = prev[activeId];
        const next = typeof updater === "function" ? (updater as (value: Row[]) => Row[])(current) : updater;
        if (next === current) return prev;
        return { ...prev, [activeId]: next };
      });
    },
    [activeId]
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SETTINGS_STORAGE_KEY) setSettings(loadSettings());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    document.title =
      route === "notfound"
        ? `Страница не найдена (404) · ${APP_TITLE}`
        : page === "admin"
          ? `Настройки · ${APP_TITLE}`
          : `${category.title} · ${APP_TITLE}`;
  }, [route, page, category.title]);

  if (route === "notfound") {
    return <NotFoundPage basePath={basePath} onHome={() => navigate(settings.active)} />;
  }

  if (page === "admin") {
    return <AdminPage settings={settings} onChange={updateSettings} onBack={() => navigate(settings.active)} />;
  }
  const DepartmentPage = activeId === "01_dept" ? Page01Dept : Page02Dept;

  return (
    <>
      <DepartmentPage
        key={activeId}
        rows={rows}
        setRows={setRows}
        data={data}
        loading={loading}
        onRefresh={refresh}
        onOpenSettings={() => navigate("admin")}
        basePath={basePath}
        logGid={logGidOf(settings.logLinks[activeId])}
        catalogUrl={settings.links[activeId]}
        onProductAdded={acceptProduct}
        logScriptUrl={settings.logScriptUrl}
        prefillReady={logReady[activeId]}
      />
      <SettingsButton onClick={() => navigate("admin")} />
    </>
  );
}
