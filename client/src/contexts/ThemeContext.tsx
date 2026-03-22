import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

export const COLOR_PRESETS = [
  { id: "blue",    label: "Bleu",       primary: "221 83% 53%", hex: "#2563EB" },
  { id: "violet",  label: "Violet",     primary: "262 80% 58%", hex: "#7C3AED" },
  { id: "emerald", label: "Émeraude",   primary: "158 64% 40%", hex: "#059669" },
  { id: "rose",    label: "Rose",       primary: "346 77% 53%", hex: "#E11D48" },
  { id: "orange",  label: "Orange",     primary: "24 95% 50%",  hex: "#F97316" },
  { id: "teal",    label: "Sarcelle",   primary: "187 76% 40%", hex: "#0891B2" },
  { id: "indigo",  label: "Indigo",     primary: "239 84% 60%", hex: "#4F46E5" },
  { id: "amber",   label: "Ambre",      primary: "43 96% 48%",  hex: "#D97706" },
  { id: "slate",   label: "Ardoise",    primary: "215 25% 35%", hex: "#475569" },
  { id: "pink",    label: "Rose vif",   primary: "330 81% 55%", hex: "#EC4899" },
  { id: "cyan",    label: "Cyan",       primary: "192 91% 42%", hex: "#0284C7" },
  { id: "lime",    label: "Lime",       primary: "85 78% 38%",  hex: "#65A30D" },
];

function applyColorPreset(presetId: string) {
  const preset = COLOR_PRESETS.find(p => p.id === presetId) || COLOR_PRESETS[0];
  const id = preset.id;
  const root = document.documentElement;
  // Set data attribute for CSS rules
  root.setAttribute("data-color", id);
  // Also directly set sidebar-accent so active items use the right color
  root.style.setProperty("--sidebar-accent", preset.primary);
  root.style.setProperty("--sidebar-accent-foreground", "0 0% 100%");
  root.style.setProperty("--primary", preset.primary);
  root.style.setProperty("--ring", preset.primary);
}

// Apply immediately before React renders to avoid color flash
const storedPreset = typeof window !== "undefined"
  ? (localStorage.getItem("colorPreset") || "blue")
  : "blue";

if (typeof window !== "undefined") {
  applyColorPreset(storedPreset);
}

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  switchable: boolean;
  colorPreset: string;
  setColorPreset: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined" && switchable) {
      return (localStorage.getItem("theme") as Theme) || defaultTheme;
    }
    return defaultTheme;
  });

  const [colorPreset, setColorPresetState] = useState<string>(storedPreset);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    if (switchable) localStorage.setItem("theme", theme);
  }, [theme, switchable]);

  useEffect(() => {
    applyColorPreset(colorPreset);
  }, [colorPreset]);

  const setColorPreset = (id: string) => {
    setColorPresetState(id);
    localStorage.setItem("colorPreset", id);
    applyColorPreset(id);
  };

  const toggleTheme = switchable
    ? () => setTheme(prev => (prev === "light" ? "dark" : "light"))
    : undefined;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, switchable, colorPreset, setColorPreset }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
