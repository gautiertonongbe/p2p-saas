import { ReactNode } from "react";

interface StatCard {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}

interface PageHeaderProps {
  icon: ReactNode;
  title: string;
  description?: string;
  gradient: string;   // e.g. "135deg, #7c3aed 0%, #a855f7 100%"
  iconBg?: string;
  action?: ReactNode;
  stats?: StatCard[];
}

export function PageHeader({ icon, title, description, gradient, iconBg, action, stats }: PageHeaderProps) {
  return (
    <div className="rounded-2xl p-6 text-white mb-6" style={{ background: `linear-gradient(${gradient})` }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: iconBg || "rgba(255,255,255,0.2)" }}>
            {icon}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            {description && <p className="text-white/70 text-sm mt-0.5">{description}</p>}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
      {stats && stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
          {stats.map((stat, i) => (
            <div key={i} className="rounded-xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
              <p className="text-white/70 text-xs">{stat.label}</p>
              <p className="text-white text-xl font-bold mt-0.5">{stat.value}</p>
              {stat.sub && <p className="text-white/60 text-xs">{stat.sub}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Preset gradients matching the sidebar group colors
export const PAGE_GRADIENTS = {
  purchases:    "135deg, #7c3aed 0%, #a855f7 100%",   // purple - Achats
  finance:      "135deg, #0891b2 0%, #06b6d4 100%",   // cyan - Finance
  operations:   "135deg, #d97706 0%, #f59e0b 100%",   // amber - Opérations
  approvals:    "135deg, #dc2626 0%, #ef4444 100%",   // red - Approbations
  insights:     "135deg, #059669 0%, #10b981 100%",   // green - Insights
  community:    "135deg, #db2777 0%, #ec4899 100%",   // pink - Communauté
  home:         "135deg, #2563eb 0%, #3b82f6 100%",   // blue - Accueil
  vendors:      "135deg, #d97706 0%, #f59e0b 100%",   // amber
  expenses:     "135deg, #0891b2 0%, #06b6d4 100%",   // cyan
  settings:     "135deg, #475569 0%, #64748b 100%",   // slate
};
