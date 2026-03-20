import { useTheme, COLOR_PRESETS } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Palette, Moon, Sun, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ThemeCustomizer() {
  const { theme, toggleTheme, switchable, colorPreset, setColorPreset } = useTheme();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Personnaliser le thème">
          <Palette className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4" align="end">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold mb-1">Couleur principale</p>
            <p className="text-xs text-muted-foreground mb-3">Choisissez votre couleur préférée</p>
            <div className="grid grid-cols-6 gap-2">
              {COLOR_PRESETS.map(preset => {
                const hsl = `hsl(${preset.primary})`;
                return (
                  <button
                    key={preset.id}
                    title={preset.label}
                    onClick={() => setColorPreset(preset.id)}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-110",
                      colorPreset === preset.id ? "border-foreground scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: hsl }}
                  >
                    {colorPreset === preset.id && (
                      <Check className="h-3.5 w-3.5 text-white drop-shadow" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">
                Sélectionné: <span className="font-medium text-foreground">
                  {COLOR_PRESETS.find(p => p.id === colorPreset)?.label || "Bleu"}
                </span>
              </p>
            </div>
          </div>

          {switchable && toggleTheme && (
            <div className="border-t pt-3">
              <p className="text-sm font-semibold mb-2">Mode d'affichage</p>
              <div className="flex gap-2">
                <Button
                  variant={theme === "light" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={() => theme === "dark" && toggleTheme()}
                >
                  <Sun className="h-3.5 w-3.5" />
                  Clair
                </Button>
                <Button
                  variant={theme === "dark" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={() => theme === "light" && toggleTheme()}
                >
                  <Moon className="h-3.5 w-3.5" />
                  Sombre
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
