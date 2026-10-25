import { GearIcon } from "./icons";

export default function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-slate-900/25 transition hover:-translate-y-0.5 hover:bg-slate-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-300 print:hidden"
    >
      <GearIcon className="h-5 w-5 transition-transform duration-500 group-hover:rotate-90" />
      Настройка
    </button>
  );
}
