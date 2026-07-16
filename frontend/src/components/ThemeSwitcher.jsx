import { useTheme } from "@/contexts/ThemeContext";
import { THEMES } from "@/lib/constants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Palette, Check } from "lucide-react";

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const current = THEMES.find((t) => t.id === theme) || THEMES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-testid="theme-switcher-btn"
          className="gap-2 h-9"
        >
          <Palette className="w-4 h-4" />
          <span className="hidden sm:inline">{current.name}</span>
          <span
            aria-hidden
            className="w-3 h-3 rounded-full border border-border"
            style={{ background: current.swatch }}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs uppercase tracking-wider">Palette</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEMES.map((t) => (
          <DropdownMenuItem
            key={t.id}
            data-testid={`theme-option-${t.id}`}
            onClick={() => setTheme(t.id)}
            className="gap-3 cursor-pointer"
          >
            <span
              className="w-4 h-4 rounded-full border border-border"
              style={{ background: t.swatch }}
            />
            <span className="flex-1">{t.name}</span>
            {theme === t.id && <Check className="w-4 h-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
