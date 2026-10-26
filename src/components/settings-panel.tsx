"use client";

import { useAppSettings, type BraceletFields } from "@/lib/app-settings";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Settings2, X } from "lucide-react";

type SettingsPanelProps = {
  open: boolean;
  onClose: () => void;
  className?: string;
};

const BRACELET_KEYS: {
  key: keyof BraceletFields;
  labelKey: "showName" | "showRoom" | "showRemaining" | "showFlag";
}[] = [
  { key: "showName", labelKey: "showName" },
  { key: "showRoom", labelKey: "showRoom" },
  { key: "showRemaining", labelKey: "showRemaining" },
  { key: "showFlag", labelKey: "showFlag" },
];

export function SettingsPanel({ open, onClose, className }: SettingsPanelProps) {
  const { settings, setBraceletField, tr } = useAppSettings();

  if (!open) return null;

  return (
    <section
      className={cn(
        "animate-fade-up rounded-xl border border-line bg-bg px-4 py-5 sm:px-5",
        className,
      )}
      aria-labelledby="settings-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Settings2 className="mt-0.5 size-5 text-primary" aria-hidden />
          <div>
            <h2 id="settings-title" className="text-lg font-semibold text-ink">
              {tr("settingsTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted">{tr("settingsIntro")}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label={tr("closeSettings")}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="mt-5 space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">
            {tr("settingsBracelet")}
          </legend>
          <ul className="space-y-2">
            {BRACELET_KEYS.map(({ key, labelKey }) => (
              <li key={key}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                    checked={settings.bracelet[key]}
                    onChange={(e) => setBraceletField(key, e.target.checked)}
                  />
                  <span>{tr(labelKey)}</span>
                </label>
              </li>
            ))}
          </ul>
          {!settings.bracelet.showName &&
          !settings.bracelet.showRoom &&
          !settings.bracelet.showRemaining &&
          !settings.bracelet.showFlag ? (
            <p className="mt-2 text-xs text-danger" role="status">
              Enable at least one field so the wristband shows something.
            </p>
          ) : null}
        </fieldset>

        <Button type="button" onClick={onClose}>
          {tr("saveClose")}
        </Button>
      </div>
    </section>
  );
}
