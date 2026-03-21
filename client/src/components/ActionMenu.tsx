/**
 * ActionMenu — Coupa-style icon row with tooltips
 * Icons always visible with variant color, highlight on hover
 */
import { useState } from "react";
import { Link } from "wouter";

export interface Action {
  icon: React.ReactNode;
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  href?: string;
  variant?: "default" | "danger" | "success" | "warning";
  disabled?: boolean;
  hidden?: boolean;
}

interface Props {
  actions: Action[];
}

const VARIANT: Record<string, { text: string; hover: string }> = {
  default: { text: "text-blue-500",    hover: "hover:bg-blue-50 hover:text-blue-700" },
  success: { text: "text-emerald-500", hover: "hover:bg-emerald-50 hover:text-emerald-700" },
  warning: { text: "text-amber-500",   hover: "hover:bg-amber-50 hover:text-amber-700" },
  danger:  { text: "text-red-400",     hover: "hover:bg-red-50 hover:text-red-600" },
};

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
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
        const v = VARIANT[action.variant ?? "default"];
        const cls = `p-1.5 rounded-md transition-all ${v.text} ${v.hover} ${action.disabled ? "opacity-30 cursor-not-allowed" : ""}`;

        return (
          <Tooltip key={i} label={action.label}>
            {action.href && !action.disabled ? (
              <Link href={action.href}>
                <button className={cls} onClick={e => e.stopPropagation()}>
                  {action.icon}
                </button>
              </Link>
            ) : (
              <button className={cls} disabled={action.disabled}
                onClick={e => { e.stopPropagation(); action.onClick?.(e); }}>
                {action.icon}
              </button>
            )}
          </Tooltip>
        );
      })}
    </div>
  );
}
