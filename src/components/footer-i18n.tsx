"use client";

import { useAppSettings } from "@/lib/app-settings";

export function FooterI18n() {
  const { tr } = useAppSettings();
  return (
    <footer className="mx-auto mt-12 max-w-6xl border-t border-line pt-6 text-xs text-muted">
      <p>
        {tr("footer")}
        <code className="font-mono">propuesta-reconocimiento-huespedes.md</code>
      </p>
    </footer>
  );
}
