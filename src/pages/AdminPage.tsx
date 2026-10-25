import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertIcon,
  ArrowLeftIcon,
  CheckIcon,
  ExternalLinkIcon,
  GearIcon,
  LinkIcon,
  RefreshIcon,
  SpinnerIcon,
} from "../components/icons";
import { formatCount } from "../lib/format";
import { fetchRemoteScriptUrl } from "../lib/remoteConfig";
import { CATEGORIES } from "../lib/settings";
import type { CategoryId, Settings } from "../lib/settings";
import { loadSheet, parseSheetUrl } from "../lib/sheet";
import { cn } from "../utils/cn";

interface AdminPageProps {
  settings: Settings;
  onChange: (next: Settings) => void;
  onBack: () => void;
}

export default function AdminPage({ settings, onChange, onBack }: AdminPageProps) {
  const saveLink = (id: CategoryId, url: string) =>
    onChange({ ...settings, links: { ...settings.links, [id]: url } });
  const saveLogLink = (id: CategoryId, url: string) =>
    onChange({ ...settings, logLinks: { ...settings.logLinks, [id]: url } });

  const [scriptUrl, setScriptUrl] = useState(settings.logScriptUrl || "");
  const [scriptSaved, setScriptSaved] = useState(false);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [remoteError, setRemoteError] = useState(false);
  const scriptTimer = useRef<number | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  /** Записывает значение из таблицы в поле и в настройки */
  const applyRemote = useCallback(
    (remote: string, markSaved: boolean) => {
      setScriptUrl(remote);
      setRemoteError(false);
      if (settingsRef.current.logScriptUrl !== remote) {
        onChange({ ...settingsRef.current, logScriptUrl: remote });
      }
      if (markSaved) {
        setScriptSaved(true);
        window.clearTimeout(scriptTimer.current);
        scriptTimer.current = window.setTimeout(() => setScriptSaved(false), 3000);
      }
    },
    [onChange]
  );

  /** Читает ячейку A1 листа с URL и подставляет значение в поле */
  const syncFromTable = useCallback(
    async (markSaved = false) => {
      setLoadingRemote(true);
      const remote = await fetchRemoteScriptUrl();
      setLoadingRemote(false);
      setLastChecked(new Date());
      // Если пользователь правит поле в этот момент — не перезатираем ввод
      if (document.activeElement === inputRef.current) return;
      if (remote) applyRemote(remote, markSaved);
      else setRemoteError(true);
    },
    [applyRemote]
  );

  // Всегда держим значение актуальным: сразу при открытии и затем раз в 20 секунд
  useEffect(() => {
    void syncFromTable(false);
    const interval = window.setInterval(() => void syncFromTable(false), 20000);
    const onVisible = () => {
      if (!document.hidden) void syncFromTable(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearTimeout(scriptTimer.current);
    };
  }, [syncFromTable]);

  const saveScriptUrl = () => {
    const trimmed = scriptUrl.trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/\S+\/exec$/.test(trimmed) && trimmed !== "") {
      return;
    }
    onChange({ ...settings, logScriptUrl: trimmed });
    setScriptSaved(true);
    window.clearTimeout(scriptTimer.current);
    scriptTimer.current = window.setTimeout(() => setScriptSaved(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 sm:px-6">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Назад
          </button>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
              <GearIcon className="h-5 w-5" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">Настройки</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">Таблицы отделов</h2>
            <p className="mt-1 text-sm text-slate-500">
              Для каждого отдела: таблица товаров (A — артикул, B — штрихкод, C — наименование) и лист
              для записи (A — артикул, B — количество).
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {CATEGORIES.map((category) => (
              <div key={category.id} className="px-5 py-5">
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-slate-900" />
                  <span className="text-sm font-semibold text-slate-800">{category.title}</span>
                </div>
                <div className="space-y-4 lg:pl-4.5">
                  <LinkRow
                    label="Таблица товаров"
                    savedUrl={settings.links[category.id]}
                    defaultUrl={category.defaultUrl}
                    mode="products"
                    onSave={(url) => saveLink(category.id, url)}
                  />
                  <LinkRow
                    label="Лист для записи"
                    savedUrl={settings.logLinks[category.id]}
                    defaultUrl={category.defaultLogUrl}
                    mode="log"
                    onSave={(url) => saveLogLink(category.id, url)}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold">Запись артикулов в Google Таблицу</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Артикулы и количество сохраняются в лист для записи выбранного отдела.
            </p>
          </div>
          <div className="flex flex-col gap-3 px-5 py-5 lg:flex-row lg:items-start lg:gap-5">
            <div className="flex w-full shrink-0 items-center gap-2.5 lg:w-80 lg:pt-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-slate-300" />
              <span className="text-sm font-semibold text-slate-800">URL развёрнутого скрипта</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={inputRef}
                    value={scriptUrl}
                    onChange={(e) => setScriptUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveScriptUrl();
                    }}
                    placeholder="https://script.google.com/macros/s/…/exec"
                    spellCheck={false}
                    autoComplete="off"
                    className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  />
                </div>
                <button
                  type="button"
                  onClick={saveScriptUrl}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium shadow-sm transition",
                    scriptSaved
                      ? "bg-emerald-600 text-white hover:bg-emerald-600"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  )}
                >
                  {scriptSaved && <CheckIcon className="h-4 w-4" strokeWidth={2.5} />}
                  {scriptSaved ? "Сохранено" : "Сохранить"}
                </button>
              </div>
              <div className="mt-2 flex min-h-5 flex-wrap items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  {scriptUrl.trim() && !/^https:\/\/script\.google\.com\/macros\/s\/\S+\/exec$/.test(scriptUrl.trim()) ? (
                    <span className="inline-flex items-center gap-1.5 text-rose-600">
                      <AlertIcon className="h-3.5 w-3.5" />
                      URL должен начинаться с https://script.google.com/macros/s/ и заканчиваться на /exec
                    </span>
                  ) : remoteError ? (
                    <span className="inline-flex items-center gap-1.5 text-amber-600">
                      <AlertIcon className="h-3.5 w-3.5" />
                      Не удалось прочитать ячейку A1 — показано последнее известное значение
                    </span>
                  ) : scriptUrl.trim() ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-600">
                      <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                      URL из таблицы (ячейка A1) — обновляется автоматически
                      {lastChecked && (
                        <span className="text-slate-400">
                          · проверено в{" "}
                          {lastChecked.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void syncFromTable(true)}
                  disabled={loadingRemote}
                  className="inline-flex shrink-0 items-center gap-1 font-medium text-slate-500 transition hover:text-slate-800 disabled:opacity-50"
                >
                  <RefreshIcon className={cn("h-3.5 w-3.5", loadingRemote && "animate-spin")} />
                  Обновить
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

type CheckState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; count: number }
  | { kind: "error"; message: string };

interface LinkRowProps {
  label: string;
  savedUrl: string;
  defaultUrl: string;
  /** products — проверяем, что таблица товаров читается; log — лист записи, может быть пустым */
  mode: "products" | "log";
  onSave: (url: string) => void;
}

function LinkRow({ label, savedUrl, defaultUrl, mode, onSave }: LinkRowProps) {
  const [value, setValue] = useState(savedUrl);
  const [invalid, setInvalid] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [check, setCheck] = useState<CheckState>({ kind: "idle" });
  const requestRef = useRef(0);
  const savedTimer = useRef<number | undefined>(undefined);

  const runCheck = useCallback(
    async (url: string) => {
      const requestId = ++requestRef.current;
      if (!url.trim()) {
        setCheck({ kind: "idle" });
        return;
      }
      const ref = parseSheetUrl(url);
      if (!ref) {
        setCheck({ kind: "error", message: "Некорректная ссылка" });
        return;
      }
      setCheck({ kind: "checking" });
      const data = await loadSheet(ref);
      if (requestId !== requestRef.current) return;
      setCheck(
        data.source === "live"
          ? { kind: "ok", count: data.count }
          : { kind: "error", message: data.error ?? "Не удалось загрузить таблицу" }
      );
    },
    []
  );

  // Проверяем сохранённую ссылку при открытии страницы
  useEffect(() => {
    void runCheck(savedUrl);
    return () => window.clearTimeout(savedTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = value.trim() !== savedUrl;

  const commit = (url: string) => {
    setValue(url);
    setInvalid(false);
    onSave(url);
    setJustSaved(true);
    window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setJustSaved(false), 3000);
    void runCheck(url);
  };

  const save = () => {
    const url = value.trim();
    // Пустая ссылка допустима: для товаров — таблица не задана, для записи — запись выключена
    if (url && !parseSheetUrl(url)) {
      setInvalid(true);
      return;
    }
    commit(url);
  };

  const validForOpen = parseSheetUrl(value) ? value.trim() : null;

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:gap-5">
      <div className="w-full shrink-0 text-sm text-slate-600 lg:w-[16.5rem] lg:pt-2.5">{label}</div>

      <div className="min-w-0 flex-1">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setInvalid(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
              }}
              placeholder="https://docs.google.com/spreadsheets/d/…?gid=…"
              spellCheck={false}
              autoComplete="off"
              className={cn(
                "w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm outline-none transition focus:ring-2",
                invalid
                  ? "border-rose-300 focus:border-rose-400 focus:ring-rose-200"
                  : "border-slate-200 focus:border-slate-400 focus:ring-slate-200"
              )}
            />
          </div>
          <button
            type="button"
            onClick={save}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium shadow-sm transition",
              justSaved && !dirty
                ? "bg-emerald-600 text-white hover:bg-emerald-600"
                : "bg-slate-900 text-white hover:bg-slate-800"
            )}
          >
            {justSaved && !dirty && <CheckIcon className="h-4 w-4" strokeWidth={2.5} />}
            {justSaved && !dirty ? "Сохранено" : "Сохранить"}
          </button>
        </div>

        <div className="mt-2 flex min-h-5 flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <StatusLine invalid={invalid} dirty={dirty} check={check} mode={mode} empty={!value.trim()} />
          <div className="ml-auto flex items-center gap-4">
            {validForOpen && (
              <a
                href={validForOpen}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-slate-800"
              >
                Открыть таблицу <ExternalLinkIcon className="h-3 w-3" />
              </a>
            )}
            {defaultUrl && savedUrl !== defaultUrl && (
              <button
                type="button"
                onClick={() => commit(defaultUrl)}
                className="font-medium text-slate-500 hover:text-slate-800"
              >
                Вернуть ссылку по умолчанию
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusLine({
  invalid,
  dirty,
  check,
  mode,
  empty,
}: {
  invalid: boolean;
  dirty: boolean;
  check: CheckState;
  mode: "products" | "log";
  empty: boolean;
}) {
  if (invalid) {
    return (
      <span className="inline-flex items-center gap-1.5 text-rose-600">
        <AlertIcon className="h-3.5 w-3.5" />
        Некорректная ссылка — нужна ссылка вида https://docs.google.com/spreadsheets/d/…
      </span>
    );
  }
  if (dirty) {
    return <span className="text-amber-600">Изменения не сохранены</span>;
  }
  if (empty) {
    return (
      <span className="inline-flex items-center gap-1.5 text-slate-400">
        <AlertIcon className="h-3.5 w-3.5" />
        {mode === "products"
          ? "Таблица не задана — поиск по артикулу недоступен"
          : "Лист не задан — запись в таблицу выключена"}
      </span>
    );
  }
  switch (check.kind) {
    case "checking":
      return (
        <span className="inline-flex items-center gap-1.5 text-slate-500">
          <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
          Проверка таблицы…
        </span>
      );
    case "ok":
      if (mode === "log") {
        return (
          <span className="inline-flex items-center gap-1.5 text-emerald-600">
            <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
            Подключено{check.count > 0 ? ` · записей: ${check.count}` : " · лист пуст"}
          </span>
        );
      }
      return check.count > 0 ? (
        <span className="inline-flex items-center gap-1.5 text-emerald-600">
          <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
          Подключено · {formatCount(check.count)}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-amber-600">
          <AlertIcon className="h-3.5 w-3.5" />
          Подключено, но таблица пуста
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-1.5 text-rose-600">
          <AlertIcon className="h-3.5 w-3.5" />
          {check.message}
        </span>
      );
    default:
      return null;
  }
}
