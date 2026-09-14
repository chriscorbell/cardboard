import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cx } from "./ui";

export type MenuItem = { label: string; onSelect?: () => void; icon?: ReactNode; active?: boolean; disabled?: boolean; separator?: boolean; danger?: boolean };

export function Menu({ trigger, items, align = "left" }: { trigger: ReactNode; items: MenuItem[]; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            initial={reduce ? false : { opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className={cx("absolute top-full z-50 mt-1 min-w-48 overflow-hidden rounded-card border border-line-strong bg-raised p-1 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)]", align === "right" ? "right-0" : "left-0")}
          >
            {items.map((item, i) => (
              <div key={i}>
                {item.separator ? <div className="my-1 border-t border-line" /> : null}
                <button
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    item.onSelect?.();
                    setOpen(false);
                  }}
                  className={cx(
                    "flex w-full items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-left text-[13px] transition-colors",
                    item.disabled ? "cursor-default text-ink-faint" : item.danger ? "text-danger hover:bg-[rgba(217,130,116,0.1)]" : "text-ink hover:bg-overlay",
                    item.active && "text-accent",
                  )}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              </div>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
