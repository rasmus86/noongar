"use client";

import { useAppSettings } from "@/lib/app-settings";

export function AboutNoongar() {
  const { tr } = useAppSettings();

  return (
    <section
      id="about"
      aria-labelledby="about-heading"
      className="mx-auto mt-16 max-w-6xl scroll-mt-8 border-t border-line pt-12"
    >
      <div className="max-w-2xl space-y-4">
        <h2
          id="about-heading"
          className="text-sm font-semibold tracking-wide text-primary"
        >
          {tr("aboutTitle")}
        </h2>
        <p className="font-display text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
          {tr("brand")}
        </p>
        <p className="text-base leading-relaxed text-muted text-pretty sm:text-lg">
          {tr("aboutBody")}
        </p>
      </div>
    </section>
  );
}
