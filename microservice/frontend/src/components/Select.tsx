"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, X } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

const TRIGGER_BASE =
  "w-full flex items-center gap-2 bg-white border border-slate-200 text-slate-900 rounded-lg px-3 py-2.5 text-sm outline-none transition-all hover:border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 disabled:opacity-50 disabled:cursor-not-allowed";

interface Pos {
  left: number;
  top: number;
  width: number;
  dropUp: boolean;
}

// Shared popover positioning + dismissal. Uses a portal so the menu is never
// clipped by scrollable/overflow-hidden ancestors (e.g. modals).
function usePopover(
  open: boolean,
  setOpen: (v: boolean) => void,
  triggerRef: React.RefObject<HTMLElement | null>,
  menuRef: React.RefObject<HTMLElement | null>
): Pos {
  const [pos, setPos] = useState<Pos>({ left: 0, top: 0, width: 0, dropUp: false });

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const dropUp = spaceBelow < 280 && r.top > spaceBelow;
    setPos({ left: r.left, top: dropUp ? r.top : r.bottom, width: r.width, dropUp });
  }, [open, triggerRef]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (menuRef.current && (e.target === menuRef.current || menuRef.current.contains(e.target as Node))) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, triggerRef, menuRef, setOpen]);

  return pos;
}

function menuStyle(pos: Pos): React.CSSProperties {
  return {
    position: "fixed",
    left: pos.left,
    width: pos.width,
    top: pos.dropUp ? undefined : pos.top + 6,
    bottom: pos.dropUp ? window.innerHeight - pos.top + 6 : undefined,
  };
}

/* ============================= Single Select ============================= */

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  className = "",
  triggerClassName = "",
  disabled,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pos = usePopover(open, setOpen, triggerRef, menuRef);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`${TRIGGER_BASE} justify-between ${triggerClassName}`}
      >
        <span className={`truncate ${selected ? "text-slate-900" : "text-slate-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle(pos)}
            className="z-[100] bg-white border border-slate-200 rounded-lg shadow-xl py-1 max-h-64 overflow-y-auto stream-in"
          >
            {options.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-400">No options available</div>
            )}
            {options.map((o) => {
              const isSel = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors ${ isSel ? "bg-slate-50 text-slate-900 font-medium" : "text-slate-600 hover:bg-slate-50" }`}
                >
                  <span className="min-w-0 flex flex-col">
                    <span className="truncate">{o.label}</span>
                    {o.hint && <span className="text-[11px] text-slate-400 truncate">{o.hint}</span>}
                  </span>
                  {isSel && <Check className="w-4 h-4 text-slate-900 flex-shrink-0" />}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}

/* ============================= Multi Select ============================= */

interface MultiSelectProps {
  values: string[];
  onChange: (values: string[]) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
}

export function MultiSelect({
  values,
  onChange,
  options,
  placeholder = "Select…",
  className = "",
  triggerClassName = "",
  disabled,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pos = usePopover(open, setOpen, triggerRef, menuRef);

  const selectedOptions = options.filter((o) => values.includes(o.value));

  const toggle = (value: string) => {
    if (values.includes(value)) onChange(values.filter((v) => v !== value));
    else onChange([...values, value]);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`${TRIGGER_BASE} justify-between min-h-[2.75rem] ${triggerClassName}`}
      >
        {selectedOptions.length === 0 ? (
          <span className="text-slate-400 truncate">{placeholder}</span>
        ) : (
          <span className="flex flex-wrap gap-1 min-w-0 py-0.5">
            {selectedOptions.map((o) => (
              <span
                key={o.value}
                className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-md pl-2 pr-1 py-0.5 text-xs max-w-[10rem]"
              >
                <span className="truncate">{o.label}</span>
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(o.value);
                  }}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3 h-3" />
                </span>
              </span>
            ))}
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle(pos)}
            className="z-[100] bg-white border border-slate-200 rounded-lg shadow-xl py-1 max-h-64 overflow-y-auto stream-in"
          >
            {options.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-400">No options available</div>
            )}
            {options.map((o) => {
              const isSel = values.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggle(o.value)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${ isSel ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50" }`}
                >
                  <span
                    className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${ isSel ? "vibrant-rainbow-bg border-transparent" : "border-slate-300 bg-white" }`}
                  >
                    {isSel && <Check className="w-3 h-3 text-white" />}
                  </span>
                  <span className="min-w-0 flex flex-col">
                    <span className="truncate">{o.label}</span>
                    {o.hint && <span className="text-[11px] text-slate-400 truncate">{o.hint}</span>}
                  </span>
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
