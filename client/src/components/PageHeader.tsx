import { ReactNode } from "react";
import { useTheme, COLOR_PRESETS } from "@/contexts/ThemeContext";

interface Props {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  stats?: { label: string; value: string | number; sub?: string }[];
}

export function PageHeader({ icon, title, description, action, stats }: Props) {
  const { colorPreset } = useTheme();
  const preset = COLOR_PRESETS.find(p => p.id === colorPreset) || COLOR_PRESETS[0];

  // primary is e.g. "221 83% 53%" — parse correctly
  const parts = preset.primary.split(" ");
  const h = parseInt(parts[0]);
  const s = parseFloat(parts[1]); // strips % automatically
  const l = parseFloat(parts[2]);

  // Darker shade for gradient start, lighter for end
  const l1 = Math.max(l - 8, 15);
  const l2 = Math.min(l + 12, 72);
  const color1 = `hsl(${h}, ${s}%, ${l1}%)`;
  const color2 = `hsl(${h}, ${s}%, ${l2}%)`;

  return (
    <div
      className="rounded-2xl p-5 text-white mb-5"
      style={{ background: `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)` }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">{title}</h1>
            {description && (
              <p className="text-white/70 text-xs mt-0.5 truncate">{description}</p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {stats && stats.length > 0 && (
        <div className="grid gap-2 mt-4" style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, 1fr)` }}>
          {stats.map((stat, i) => (
            <div key={i} className="rounded-xl p-2.5 bg-white/15">
              <p className="text-white/60 text-xs">{stat.label}</p>
              <p className="text-white text-lg font-bold leading-tight">{stat.value}</p>
              {stat.sub && <p className="text-white/50 text-xs">{stat.sub}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PageHeaderButton({
  onClick,
  children,
}: {
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-semibold transition-colors whitespace-nowrap"
    >
      {children}
    </button>
  );
}
