"use client";

import {
  formatStayRange,
  guestFlag,
  guestFlagNote,
  remainingNights,
  remainingStayLabel,
  totalNights,
  totalNightsLabel,
  type Guest,
} from "@/lib/guests";
import { useAppSettings } from "@/lib/app-settings";
import { GuestAvatar } from "@/components/guest-avatar";
import { Button } from "@/components/ui/button";
import { Camera, Crown, Info, Pencil, ShieldAlert, Watch } from "lucide-react";
import { cn } from "@/lib/utils";

type GuestCardProps = {
  guest: Guest;
  onNotify: () => void;
  onEnrollPhoto: () => void;
  onEdit: () => void;
  notifying: boolean;
  notified: boolean;
};

export function GuestCard({
  guest,
  onNotify,
  onEnrollPhoto,
  onEdit,
  notifying,
  notified,
}: GuestCardProps) {
  const { settings, tr } = useAppSettings();
  const left = remainingNights(guest);
  const total = totalNights(guest);
  const flag = guestFlag(guest);
  const note = guestFlagNote(guest);

  const statusLabel = {
    in_house: tr("statusInHouse"),
    arriving: tr("statusArriving"),
    checked_out: tr("statusOut"),
  } as const;

  return (
    <article
      className={cn(
        "animate-fade-up rounded-xl border px-5 py-5",
        flag === "blacklist" &&
          "border-[oklch(0.72_0.14_25)] bg-[oklch(0.985_0.02_25)]",
        flag === "vip" &&
          "border-[oklch(0.78_0.12_85)] bg-[oklch(0.985_0.03_90)]",
        flag === "silver" &&
          "border-[oklch(0.72_0.02_250)] bg-[oklch(0.97_0.01_250)]",
        flag === "none" && "border-line bg-surface",
      )}
    >
      {flag === "blacklist" ? (
        <div
          className="mb-4 flex items-start gap-2 rounded-lg border border-[oklch(0.72_0.14_25)] bg-[oklch(0.96_0.04_25)] px-3 py-2.5 text-sm text-ink"
          role="alert"
        >
          <ShieldAlert
            className="mt-0.5 size-4 shrink-0 text-danger"
            aria-hidden
          />
          <div>
            <p className="font-semibold text-danger">{tr("listBlack")}</p>
            <p className="mt-0.5 text-muted text-pretty">
              {note || "—"}
            </p>
          </div>
        </div>
      ) : null}

      {flag === "vip" ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-[oklch(0.78_0.12_85)] bg-[oklch(0.96_0.05_90)] px-3 py-2.5 text-sm text-ink">
          <Crown
            className="mt-0.5 size-4 shrink-0 text-[oklch(0.55_0.12_80)]"
            aria-hidden
          />
          <div>
            <p className="font-semibold text-[oklch(0.48_0.11_75)]">
              {tr("listVip")}
            </p>
            <p className="mt-0.5 text-muted text-pretty">{note || "—"}</p>
          </div>
        </div>
      ) : null}

      {flag === "silver" ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-[oklch(0.72_0.02_250)] bg-[oklch(0.95_0.01_250)] px-3 py-2.5 text-sm text-ink">
          <Info
            className="mt-0.5 size-4 shrink-0 text-[oklch(0.45_0.03_250)]"
            aria-hidden
          />
          <div>
            <p className="font-semibold text-[oklch(0.4_0.03_250)]">
              {tr("listSilver")}
            </p>
            <p className="mt-0.5 text-muted text-pretty">{note || "—"}</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start gap-4">
        <button
          type="button"
          onClick={onEnrollPhoto}
          className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.48_0.12_230)]"
          aria-label={
            guest.photoDataUrl ? tr("updatePhoto") : tr("addPhoto")
          }
        >
          <GuestAvatar guest={guest} size="xl" />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-[oklch(0.2_0.03_230_/_0.45)] opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100">
            <Camera className="size-6 text-white" aria-hidden />
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
                {tr("guestIdentified")}
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink text-balance">
                {guest.fullName}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {tr("greetAs")} «{guest.displayName}» · {guest.language}
              </p>
            </div>
            <div className="rounded-md bg-primary/10 px-3 py-2 text-right">
              <p className="text-[0.65rem] font-medium uppercase tracking-wider text-primary">
                {tr("room")}
              </p>
              <p className="font-mono text-2xl font-semibold text-primary">
                {guest.room}
              </p>
            </div>
          </div>
        </div>
      </div>

      <dl className="mt-5 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-muted">{tr("status")}</dt>
          <dd className="mt-0.5 font-medium text-ink">
            {statusLabel[guest.status]}
          </dd>
        </div>
        <div>
          <dt className="text-muted">{tr("nightsLeft")}</dt>
          <dd className="mt-0.5 font-semibold text-primary">
            {left === 0
              ? remainingStayLabel(guest, new Date(), "en")
              : left === 1
                ? "1 night"
                : `${left} nights`}
          </dd>
          <dd className="mt-0.5 text-xs text-muted">{tr("checkoutAt")}</dd>
        </div>
        <div>
          <dt className="text-muted">{tr("nightsTotal")}</dt>
          <dd className="mt-0.5 font-semibold text-ink">
            {totalNightsLabel(guest, settings.locale)}
          </dd>
          <dd className="mt-0.5 text-xs text-muted">
            {left}/{total || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">{tr("stay")}</dt>
          <dd className="mt-0.5 font-medium text-ink">
            {formatStayRange(guest.checkInDate, guest.checkOutDate)}
          </dd>
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <dt className="text-muted">{tr("preferences")}</dt>
          <dd className="mt-0.5 font-medium text-ink text-pretty">
            {guest.preferences}
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="accent"
          onClick={onNotify}
          disabled={notifying}
          aria-busy={notifying}
        >
          <Watch className="size-4" aria-hidden />
          {notifying
            ? tr("sending")
            : notified
              ? tr("resendBracelet")
              : tr("sendBracelet")}
        </Button>
        <Button type="button" variant="secondary" onClick={onEdit}>
          <Pencil className="size-4" aria-hidden />
          {tr("edit")}
        </Button>
        <Button type="button" variant="secondary" onClick={onEnrollPhoto}>
          <Camera className="size-4" aria-hidden />
          {guest.photoDataUrl ? tr("updatePhoto") : tr("addPhoto")}
        </Button>
        {notified ? (
          <span className="text-sm text-accent animate-fade-in">
            {flag === "blacklist"
              ? tr("shownAlert")
              : flag === "vip"
                ? tr("shownVip")
                : flag === "silver"
                  ? tr("shownSilver")
                  : tr("shownOk")}
          </span>
        ) : null}
      </div>
    </article>
  );
}
