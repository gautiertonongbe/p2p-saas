import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

type SortDir = "asc" | "desc";

interface SortToggleProps {
  value: SortDir;
  onChange: (dir: SortDir) => void;
  label?: string;
}

export function SortToggle({ value, onChange, label = "Date" }: SortToggleProps) {
  return (
    <button
      onClick={() => onChange(value === "desc" ? "asc" : "desc")}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
      title={value === "desc" ? "Du plus récent au plus ancien" : "Du plus ancien au plus récent"}>
      {value === "desc"
        ? <ArrowDown className="h-3.5 w-3.5 text-blue-600" />
        : <ArrowUp className="h-3.5 w-3.5 text-blue-600" />}
      <span className="hidden sm:inline">{label}</span>
      <span className="text-xs text-muted-foreground">{value === "desc" ? "↓" : "↑"}</span>
    </button>
  );
}

// Hook to sort any array
export function useSortDir(initialDir: SortDir = "desc") {
  const { useState } = require("react");
  const [sortDir, setSortDir] = useState<SortDir>(initialDir);
  
  function sortByDate<T>(arr: T[], dateField: keyof T = "createdAt" as keyof T): T[] {
    return [...arr].sort((a: any, b: any) => {
      const aDate = new Date(a[dateField] || 0).getTime();
      const bDate = new Date(b[dateField] || 0).getTime();
      return sortDir === "desc" ? bDate - aDate : aDate - bDate;
    });
  }

  function sortByField<T>(arr: T[], field: keyof T, type: "date" | "number" | "string" = "date"): T[] {
    return [...arr].sort((a: any, b: any) => {
      if (type === "date") {
        const aV = new Date(a[field] || 0).getTime();
        const bV = new Date(b[field] || 0).getTime();
        return sortDir === "desc" ? bV - aV : aV - bV;
      }
      if (type === "number") {
        return sortDir === "desc" ? Number(b[field]) - Number(a[field]) : Number(a[field]) - Number(b[field]);
      }
      const aV = String(a[field] || "").toLowerCase();
      const bV = String(b[field] || "").toLowerCase();
      return sortDir === "desc" ? bV.localeCompare(aV) : aV.localeCompare(bV);
    });
  }

  return { sortDir, setSortDir, sortByDate, sortByField };
}
