import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import SettingsButton from "./components/SettingsButton";
import { useHashRoute } from "./hooks/useHashRoute";
import { useSheetData } from "./hooks/useSheetData";
import { makeRow } from "./lib/rows";
import type { Row } from "./lib/rows";
import { fetchLogRows } from "./lib/logSheet";
import { fetchRemoteScriptUrl } from "./lib/remoteConfig";
import {
  CATEGORIES,
  getCategory,
  loadSettings,
  logGidOf,
  saveSettings,
  SETTINGS_STORAGE_KEY,
} from "./lib/settings";
import type { CategoryId, Settings } from "./lib/settings";
import AdminPage from "./pages/AdminPage";
import MainPage from "./pages/MainPage";

const APP_TITLE = "Списание";

type RowsByCategory = Record<CategoryId, Row[]>;
type FlagsByCategory = Record<CategoryId, boolean>;

const byCategory = <T,>(make: () => T): Record<CategoryId, T> =>
  Object.fromEntries(CATEGORIES.map((c) => [c.id, make()])) as Record<CategoryId, T>;

export default function App() {
  const { route, navigate, replace } = useHashRoute();
  const [settings, setSettings] = useState<Settings>(loadSettings);
  // У каждой страницы-отдела свой список строк
  const [rowsByCategory, setRowsByCategory] = useState<RowsByCategory>(() => byCategory(() => [makeRow()]));
  // Загрузка записей из листов отделов завершена (по каждому отделу отдельно)
  const [logReady, setLogReady] = useState<FlagsByCategory>(() => byCategory(() => false));

  const updateSettings = useCallback((next: Settings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  // Текущая страница: из адреса, иначе — последний выбранный отдел
  const page: CategoryId | "admin" = route ?? settings.active;
  const activeId: CategoryId = page === "admin" ? settings.active : page;
  const category = getCategory(activeId);
  const logGid = logGidOf(settings.logLinks[activeId]);

  const { data, loading, refresh, acceptProduct } = useSheetData(settings.links[activeId]);

  // Открытый адрес отдела делает его активным (важно для прямой ссылки и «Назад»)
  useEffect(() => {
    if (page !== "admin" && settings.active !== page) {
      updateSettings({ ...settings, active: page });
    }
  }, [page, settings, updateSettings]);

  // При открытии сайта обновляем URL скрипта из таблицы
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
  }, []);

  // При открытии сайта подгружаем записи из листов отделов (A — артикул, B — количество).
  // Делается один раз для каждого отдела; если лист не задан — отдел сразу готов.
  useEffect(() => {
    for (const c of CATEGORIES) {
      const gid = logGidOf(settings.logLinks[c.id]);
      if (!gid) {
        setLogReady((prev) => (prev[c.id] ? prev : { ...prev, [c.id]: true }));
        continue;
      }
      void fetchLogRows(gid).then((entries) => {
        if (entries.length > 0) {
          setRowsByCategory((prev) => {
            const current = prev[c.id];
            // Пользователь уже начал ввод до окончания загрузки — не затираем
            const pristine = current.length === 1 && !current[0].input && !current[0].qty;
            if (!pristine) return prev;
            return { ...prev, [c.id]: entries.map((e) => makeRow(e.sku, e.qty)) };
          });
        }
        setLogReady((prev) => ({ ...prev, [c.id]: true }));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // При заходе на корень подставляем адрес активной страницы, не добавляя историю
  useEffect(() => {
    if (route === null) replace(page);
  }, [route, page, replace]);

  // Строки активной страницы
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

  // Синхронизация настроек между открытыми вкладками
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SETTINGS_STORAGE_KEY) setSettings(loadSettings());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    document.title = page === "admin" ? `Настройки · ${APP_TITLE}` : `${category.title} · ${APP_TITLE}`;
  }, [page, category.title]);

  if (page === "admin") {
    return (
      <AdminPage
        settings={settings}
        onChange={updateSettings}
        onBack={() => navigate(settings.active)}
      />
    );
  }

  return (
    <>
      <MainPage
        key={activeId}
        rows={rows}
        setRows={setRows}
        data={data}
        loading={loading}
        onRefresh={refresh}
        category={category}
        logGid={logGid}
        onOpenSettings={() => navigate("admin")}
        logScriptUrl={settings.logScriptUrl}
        prefillReady={logReady[activeId]}
        catalogUrl={settings.links[activeId]}
        onProductAdded={acceptProduct}
      />
      <SettingsButton onClick={() => navigate("admin")} />
    </>
  );
}
