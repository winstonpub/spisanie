import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import SettingsButton from "./components/SettingsButton";
import { pagePath, usePageRoute } from "./hooks/usePageRoute";
import { useSheetData } from "./hooks/useSheetData";
import { makeRow } from "./lib/rows";
import type { Row } from "./lib/rows";
import { fetchLogRows } from "./lib/logSheet";
import { fetchRemoteScriptUrl } from "./lib/remoteConfig";
import { CATEGORIES, getCategory, loadSettings, logGidOf, saveSettings, SETTINGS_STORAGE_KEY } from "./lib/settings";
import type { CategoryId, Settings } from "./lib/settings";
import Page01Dept from "./pages/01_dept";
import Page02Dept from "./pages/02_dept";
import NotFoundPage from "./pages/404";
import AdminPage from "./pages/AdminPage";

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
  const { route, navigate, basePath } = usePageRoute(settings.active);
  const [rowsByCategory, setRowsByCategory] = useState<RowsByCategory>(initialRows);
  const [logReady, setLogReady] = useState<FlagsByCategory>(() => byCategory(() => false));

  const updateSettings = useCallback((next: Settings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  const activeId: CategoryId = route === "01_dept" || route === "02_dept" ? route : settings.active;
  const category = getCategory(activeId);
  const { data, loading, refresh, acceptProduct } = useSheetData(settings.links[activeId]);

  useEffect(() => {
    if ((route === "01_dept" || route === "02_dept") && settings.active !== route) {
      updateSettings({ ...settings, active: route });
    }
  }, [route, settings, updateSettings]);

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
    [activeId],
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SETTINGS_STORAGE_KEY) setSettings(loadSettings());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (route === "404") {
      document.title = `Страница не найдена (404) · ${APP_TITLE}`;
    } else if (route === "admin") {
      document.title = `Настройки · ${APP_TITLE}`;
    } else {
      document.title = `${category.title} · ${APP_TITLE}`;
    }
  }, [route, category.title]);

  if (route === "404") {
    return (
      <NotFoundPage
        homeHref={pagePath(settings.active, basePath)}
        onGoHome={() => navigate(settings.active)}
      />
    );
  }

  if (route === "admin") {
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
        onSelectCategory={(id) => navigate(id)}
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
