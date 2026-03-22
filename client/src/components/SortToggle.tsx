import { useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";

export type SortDir = "asc" | "desc";

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
      <span className="hidden sm:inline text-xs">{label}</span>
      <span className="text-xs text-muted-foreground ml-0.5">{value === "desc" ? "↓" : "↑"}</span>
    </button>
  );
}
