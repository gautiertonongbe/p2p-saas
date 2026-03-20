import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

export const COLOR_PRESETS = [
  { id: "blue",    label: "Bleu",       primary: "221 83% 53%" },
  { id: "violet",  label: "Violet",     primary: "262 80% 58%" },
  { id: "emerald", label: "Émeraude",   primary: "158 64% 40%" },
  { id: "rose",    label: "Rose",       primary: "346 77% 53%" },
  { id: "orange",  label: "Orange",     primary: "24 95% 50%"  },
  { id: "teal",    label: "Sarcelle",   primary: "187 76% 40%" },
  { id: "indigo",  label: "Indigo",     primary: "239 84% 60%" },
  { id: "amber",   label: "Ambre",      primary: "43 96% 48%"  },
  { id: "slate",   label: "Ardoise",    primary: "215 25% 35%" },
  { id: "pink",    label: "Rose vif",   primary: "330 81% 55%" },
  { id: "cyan",    label: "Cyan",       primary: "192 91% 42%" },
  { id: "lime",    label: "Lime",       primary: "85 78% 38%"  },
];

function applyColorPreset(presetId: string) {
  const id = COLOR_PRESETS.find(p => p.id === presetId) ? presetId : "blue";
  // Use data attribute - CSS rules handle the variables with correct specificity
  document.documentElement.setAttribute("data-color", id);
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
