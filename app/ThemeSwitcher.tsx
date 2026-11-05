"use client";

import { useState } from "react";
import { THEMES, type Theme } from "@/lib/themes";

const LABELS: Record<Theme, string> = { system: "System", light: "Light", dark: "Dark" };

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.cookie = `theme=${theme}; path=/; max-age=31536000; samesite=lax`;
}

export default function ThemeSwitcher({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState(initial);

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <div role="group" aria-label="Color theme" className="flex rounded-lg border border-line bg-surface p-0.5">
      {THEMES.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => choose(t)}
          aria-pressed={t === theme}
          className={`rounded-md px-2.5 py-1 text-xs font-medium ${
            t === theme ? "bg-surface-2 text-ink" : "text-ink-2 hover:text-ink"
          }`}
        >
          {LABELS[t]}
        </button>
      ))}
    </div>
  );
}
