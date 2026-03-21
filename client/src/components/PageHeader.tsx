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
  const parts = preset.primary.split(" ");
  const h = parseInt(parts[0]);
  const s = parseFloat(parts[1]);
  const l = parseFloat(parts[2]);
  const accentColor = `hsl(${h}, ${s}%, ${l}%)`;
  const accentBg = `hsl(${h}, ${s}%, ${Math.min(l + 42, 96)}%)`;

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: accentBg, color: accentColor }}>
          {icon}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
      {stats && stats.length > 0 && (
        <div className="hidden sm:grid gap-3 ml-8" style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, 1fr)` }}>
          {stats.map((stat, i) => (
            <div key={i} className="text-right">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-lg font-bold" style={{ color: accentColor }}>{stat.value}</p>
              {stat.sub && <p className="text-xs text-muted-foreground">{stat.sub}</p>}
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
  const { colorPreset } = useTheme();
  const preset = COLOR_PRESETS.find(p => p.id === colorPreset) || COLOR_PRESETS[0];
  const parts = preset.primary.split(" ");
  const accentColor = `hsl(${parseInt(parts[0])}, ${parseFloat(parts[1])}%, ${parseFloat(parts[2])}%)`;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold transition-colors"
      style={{ backgroundColor: accentColor }}
    >
      {children}
    </button>
  );
}
