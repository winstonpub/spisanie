import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { CATEGORIES } from "../lib/settings";
import type { Category, CategoryId } from "../lib/settings";
import { cn } from "../utils/cn";

interface DepartmentDropdownProps {
  activeCategory: Category;
}

function CategoryIcon({ id }: { id: CategoryId }) {
  if (id === "construction") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M12 9v6" />
        <path d="M16 15v6" />
        <path d="M16 3v6" />
        <path d="M3 15h18" />
        <path d="M3 9h18" />
        <path d="M8 15v6" />
        <path d="M8 3v6" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 4h3a2 2 0 0 1 2 2v14" />
      <path d="M2 20h3" />
      <path d="M13 20h9" />
      <path d="M10 12v.01" />
      <path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z" />
    </svg>
  );
}

export default function DepartmentDropdown({ activeCategory }: DepartmentDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const activeIndex = Math.max(
      0,
      CATEGORIES.findIndex((c) => c.id === activeCategory.id),
    );
    itemRefs.current[activeIndex]?.focus();
  }, [open, activeCategory.id]);

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const elements = itemRefs.current.filter((el): el is HTMLAnchorElement => el !== null);
    if (!elements.length) return;
    const index = elements.indexOf(document.activeElement as HTMLAnchorElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      elements[(index + 1) % elements.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      elements[(index - 1 + elements.length) % elements.length]?.focus();
    }
  };

  return (
    <nav ref={rootRef} aria-label="Страницы отделов" className="sm:relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "group inline-flex cursor-pointer items-center gap-2.5 rounded-lg bg-white py-2 pl-3.5 pr-2.5 text-sm font-medium text-[#20282B] shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5c400]",
          open && "ring-2 ring-[#f5c400]",
        )}
      >
        <span className="truncate">{activeCategory.title}</span>
        <span
          aria-hidden="true"
          className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-[#f5c400] text-[#20282b] transition-all duration-150 group-hover:scale-105 group-hover:bg-[#ffe97a]"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 10 6"
            width="10"
            height="6"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn("transition-transform duration-200", open && "rotate-180")}
          >
            <path d="M1 1l4 4 4-4" />
          </svg>
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Разделы"
          onKeyDown={handleMenuKeyDown}
          className="absolute left-0 top-[calc(100%+10px)] z-50 w-max min-w-[280px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[#e4e2da] bg-white p-1.5 text-[#20282b] shadow-[0_18px_40px_-12px_rgba(29,31,27,0.28)]"
        >
          <div className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-[#9a9a90]">
            Разделы
          </div>
          {CATEGORIES.map((item, idx) => {
            const active = item.id === activeCategory.id;
            return (
              <a
                key={item.id}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                role="menuitem"
                aria-current={active ? "page" : undefined}
                href={`#/${item.id}`}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#F5C400]",
                  active ? "bg-[#FFF8D6]" : "hover:bg-[#f4f3ee]",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    active ? "bg-[#F5C400] text-[#1d1f1b]" : "bg-[#1d1f1b] text-white",
                  )}
                >
                  <CategoryIcon id={item.id} />
                </span>
                <span className="min-w-0 flex-1 text-sm font-semibold text-[#1d1f1b] sm:whitespace-nowrap">
                  {item.title}
                </span>
                {active && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#F5C400]" aria-hidden="true" />
                )}
              </a>
            );
          })}
        </div>
      )}
    </nav>
  );
}
