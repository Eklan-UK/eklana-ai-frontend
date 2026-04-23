"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { useTheme } from "@/components/providers/ThemeProvider";

const THEME_OPTIONS = [
  { id: "light", label: "Light", description: "Default light theme", Icon: Sun },
  { id: "dark", label: "Dark", description: "Dark mode for night use", Icon: Moon },
  { id: "system", label: "System", description: "Follow system settings", Icon: Monitor },
] as const;

export default function ThemePage() {
  const { theme, resolvedTheme, setTheme, mounted } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Status Bar Space */}
      <div className="h-6"></div>

      <Header showBack title="Theme" />

      <div className="max-w-md mx-auto px-4 py-6 md:max-w-2xl md:px-8">
        <p className="mb-2 text-base text-text-secondary">
          Choose your preferred theme. Changes apply instantly and are saved automatically.
        </p>
        {mounted ? (
          <p className="mb-6 text-sm text-muted-foreground">
            Active appearance: <span className="font-medium capitalize">{resolvedTheme}</span>
          </p>
        ) : null}

        <div className="space-y-3">
          {THEME_OPTIONS.map(({ id, label, description, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTheme(id)}
              className="w-full text-left"
              aria-pressed={theme === id}
            >
              <Card
                className={`transition-all ${
                  theme === id
                    ? "bg-green-50 ring-2 ring-green-600 dark:bg-green-950/40 dark:ring-green-500"
                    : "bg-card border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`rounded-full p-2 ${
                        theme === id
                          ? "bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300"
                          : "bg-muted text-text-secondary"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-foreground">{label}</p>
                      <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                  </div>
                  {theme === id ? (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-white dark:bg-green-500">
                      <Check className="h-4 w-4" />
                    </div>
                  ) : null}
                </div>
              </Card>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

