/**
 * ActionMenu — Coupa-style hover icon row
 * Shows icons on row hover, tooltip on icon hover
 */
import { useState, useRef } from "react";
import { Link } from "wouter";

export interface Action {
  icon: React.ReactNode;
  label: string;                          // tooltip text
  onClick?: (e: React.MouseEvent) => void;
  href?: string;
  variant?: "default" | "danger" | "success" | "warning";
  disabled?: boolean;
  hidden?: boolean;
}

interface Props {
  actions: Action[];
}

const VARIANT_CLASS: Record<string, string> = {
  default: "hover:bg-blue-50 hover:text-blue-700",
  danger:  "hover:bg-red-50 hover:text-red-600",
  success: "hover:bg-emerald-50 hover:text-emerald-700",
  warning: "hover:bg-amber-50 hover:text-amber-700",
};

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 pointer-events-none">
          <div className="bg-gray-900 text-white text-[11px] font-medium px-2 py-1 rounded-md whitespace-nowrap shadow-lg">
            {label}
          </div>
          <div className="w-2 h-2 bg-gray-900 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2" />
        </div>
      )}
    </div>
  );
}

export function ActionMenu({ actions }: Props) {
  const visible = actions.filter(a => !a.hidden);
  if (visible.length === 0) return null;

  return (
    <div className="flex items-center justify-end gap-0.5">
      {visible.map((action, i) => {
        const base = `p-1.5 rounded-md transition-all text-gray-300 hover:text-gray-700 ${action.disabled ? "opacity-30 cursor-not-allowed" : VARIANT_CLASS[action.variant ?? "default"]}`;
        const inner = (
          <Tooltip key={i} label={action.label}>
            {action.href && !action.disabled ? (
              <Link href={action.href}>
                <button className={base} onClick={e => e.stopPropagation()}>
                  {action.icon}
                </button>
              </Link>
            ) : (
              <button className={base}
                disabled={action.disabled}
                onClick={e => { e.stopPropagation(); action.onClick?.(e); }}>
                {action.icon}
              </button>
            )}
          </Tooltip>
        );
        return inner;
      })}
    </div>
  );
}
