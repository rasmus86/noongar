"use client";

import { cn } from "@/lib/utils";
import type { GuestFlag } from "@/lib/guests";
import type { BraceletFields } from "@/lib/app-settings";
import { useAppSettings } from "@/lib/app-settings";

type BraceletPreviewProps = {
  name: string | null;
  room: string | null;
  /** Ej. «Quedan 2/4», «Sale hoy · 3 h» */
  remaining: string | null;
  /** Marca operativa en pulsera */
  flag?: GuestFlag;
  /** Override de campos (si no, usa Ajustes). */
  fields?: BraceletFields;
  visible: boolean;
  fading: boolean;
};

export function BraceletPreview({
  name,
  room,
  remaining,
  flag = "none",
  fields: fieldsProp,
  visible,
  fading,
}: BraceletPreviewProps) {
  const { settings, tr } = useAppSettings();
  const fields = fieldsProp ?? settings.bracelet;

  const alert = fields.showFlag && flag === "blacklist";
  const vip = fields.showFlag && flag === "vip";
  const silver = fields.showFlag && flag === "silver";
  const flagged = alert || vip || silver;

  const displayName = fields.showName ? name : null;
  const displayRoom = fields.showRoom ? room : null;
  const displayRemaining = fields.showRemaining ? remaining : null;

  const hasContent = Boolean(
    displayName || displayRoom || displayRemaining || flagged,
  );

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
        {tr("braceletSim")}
      </p>
      <div
        className={cn(
          "relative flex h-44 w-44 items-center justify-center rounded-full border-[10px] bg-[oklch(0.18_0.02_230)] shadow-[inset_0_1px_0_oklch(1_0_0_/_0.08)]",
          alert && visible && !fading
            ? "border-[oklch(0.45_0.18_25)]"
            : vip && visible && !fading
              ? "border-[oklch(0.62_0.14_85)]"
              : silver && visible && !fading
                ? "border-[oklch(0.62_0.03_250)]"
                : "border-[oklch(0.32_0.02_230)]",
        )}
        aria-live="polite"
      >
        <div
          className={cn(
            "flex h-[5.75rem] w-[6.75rem] flex-col items-center justify-center rounded-sm px-1.5 text-center transition-[opacity,filter,transform,background-color] duration-300 ease-out",
            alert && hasContent
              ? "bg-[oklch(0.16_0.04_25)]"
              : vip && hasContent
                ? "bg-[oklch(0.18_0.04_85)]"
                : silver && hasContent
                  ? "bg-[oklch(0.16_0.02_250)]"
                  : "bg-[oklch(0.12_0.01_230)]",
            visible && !fading
              ? "opacity-100 blur-0 scale-100"
              : fading
                ? "opacity-40 blur-[1px] scale-[0.98]"
                : "opacity-35 blur-0",
          )}
        >
          {visible && hasContent ? (
            <>
              {alert ? (
                <span className="mb-0.5 font-mono text-[0.7rem] font-bold uppercase tracking-wider text-[oklch(0.78_0.18_25)] animate-pulse">
                  {tr("flagAlert")}
                </span>
              ) : null}
              {vip ? (
                <span className="mb-0.5 font-mono text-[0.7rem] font-bold uppercase tracking-wider text-[oklch(0.86_0.14_90)]">
                  {tr("flagVip")}
                </span>
              ) : null}
              {silver ? (
                <span className="mb-0.5 font-mono text-[0.7rem] font-bold uppercase tracking-wider text-[oklch(0.82_0.03_250)]">
                  {tr("flagSilver")}
                </span>
              ) : null}
              {displayName ? (
                <span
                  className={cn(
                    "font-mono text-[0.88rem] font-semibold leading-tight",
                    alert
                      ? "text-[oklch(0.9_0.08_25)]"
                      : vip
                        ? "text-[oklch(0.92_0.1_90)]"
                        : silver
                          ? "text-[oklch(0.9_0.02_250)]"
                          : "text-[oklch(0.92_0.03_145)]",
                  )}
                >
                  {displayName}
                </span>
              ) : null}
              {displayRoom ? (
                <span className="mt-0.5 font-mono text-[0.62rem] text-[oklch(0.78_0.04_230)]">
                  {tr("room")} {displayRoom}
                </span>
              ) : null}
              {displayRemaining ? (
                <span className="mt-1 max-w-full font-mono text-[0.58rem] font-semibold leading-snug text-[oklch(0.86_0.1_70)]">
                  {displayRemaining}
                </span>
              ) : null}
            </>
          ) : (
            <span className="font-mono text-[0.65rem] uppercase tracking-wider text-[oklch(0.55_0.02_230)]">
              {tr("braceletWaiting")}
            </span>
          )}
        </div>
        <div className="absolute -bottom-1 h-3 w-10 rounded-full bg-[oklch(0.28_0.02_230)]" />
      </div>
      <p className="max-w-[16rem] text-center text-xs leading-relaxed text-muted">
        {tr("braceletFooter")}
      </p>
    </div>
  );
}
