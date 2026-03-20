import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

// 12 beautiful accent color presets
export const COLOR_PRESETS = [
  { id: "blue",    label: "Bleu",       primary: "221 83% 53%",  sidebar: "221 83% 25%" },
  { id: "violet",  label: "Violet",     primary: "262 80% 58%",  sidebar: "262 80% 28%" },
  { id: "emerald", label: "Émeraude",   primary: "158 64% 40%",  sidebar: "158 64% 20%" },
  { id: "rose",    label: "Rose",       primary: "346 77% 53%",  sidebar: "346 77% 25%" },
  { id: "orange",  label: "Orange",     primary: "24 95% 50%",   sidebar: "24 95% 25%" },
  { id: "teal",    label: "Sarcelle",   primary: "187 76% 40%",  sidebar: "187 76% 20%" },
  { id: "indigo",  label: "Indigo",     primary: "239 84% 60%",  sidebar: "239 84% 28%" },
  { id: "amber",   label: "Ambre",      primary: "43 96% 48%",   sidebar: "43 96% 22%" },
  { id: "slate",   label: "Ardoise",    primary: "215 25% 35%",  sidebar: "215 25% 15%" },
  { id: "pink",    label: "Rose vif",   primary: "330 81% 55%",  sidebar: "330 81% 25%" },
  { id: "cyan",    label: "Cyan",       primary: "192 91% 42%",  sidebar: "192 91% 20%" },
  { id: "lime",    label: "Lime",       primary: "85 78% 38%",   sidebar: "85 78% 18%" },
];

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

function applyColorPreset(presetId: string) {
  const preset = COLOR_PRESETS.find(p => p.id === presetId) || COLOR_PRESETS[0];
  const root = document.documentElement;
  root.style.setProperty("--primary", preset.primary);
  root.style.setProperty("--sidebar-primary", preset.sidebar);
  root.style.setProperty("--ring", preset.primary);
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (switchable) {
      const stored = localStorage.getItem("theme");
      return (stored as Theme) || defaultTheme;
    }
    return defaultTheme;
  });

  const [colorPreset, setColorPresetState] = useState<string>(() => {
    return localStorage.getItem("colorPreset") || "blue";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    if (switchable) {
      localStorage.setItem("theme", theme);
    }
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
