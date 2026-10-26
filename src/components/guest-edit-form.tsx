"use client";

import { useState } from "react";
import {
  guestFlag,
  guestFlagNote,
  nightsBetween,
  type Guest,
  type GuestEditInput,
  type GuestFlag,
  type GuestStatus,
} from "@/lib/guests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Crown, Info, ShieldAlert, X } from "lucide-react";

type GuestEditFormProps = {
  guest: Guest;
  onSave: (edit: GuestEditInput) => void;
  onCancel: () => void;
  className?: string;
};

const FLAG_OPTIONS: {
  value: GuestFlag;
  label: string;
  hint: string;
  icon: typeof ShieldAlert;
}[] = [
  {
    value: "none",
    label: "No flag",
    hint: "Standard guest",
    icon: Info,
  },
  {
    value: "blacklist",
    label: "Blacklist",
    hint: "ALERT on wristband",
    icon: ShieldAlert,
  },
  {
    value: "vip",
    label: "VIP (gold)",
    hint: "Preferential care",
    icon: Crown,
  },
  {
    value: "silver",
    label: "Silver",
    hint: "Extra info to keep in mind",
    icon: Info,
  },
];

export function GuestEditForm({
  guest,
  onSave,
  onCancel,
  className,
}: GuestEditFormProps) {
  const [fullName, setFullName] = useState(guest.fullName);
  const [displayName, setDisplayName] = useState(guest.displayName);
  const [room, setRoom] = useState(guest.room);
  const [checkInDate, setCheckInDate] = useState(guest.checkInDate);
  const [checkOutDate, setCheckOutDate] = useState(guest.checkOutDate);
  const [language, setLanguage] = useState(guest.language);
  const [preferences, setPreferences] = useState(
    guest.preferences === "—" ? "" : guest.preferences,
  );
  const [status, setStatus] = useState<GuestStatus>(guest.status);
  const [flag, setFlag] = useState<GuestFlag>(guestFlag(guest));
  const [flagNote, setFlagNote] = useState(guestFlagNote(guest) ?? "");
  const [error, setError] = useState<string | null>(null);

  const total = nightsBetween(checkInDate, checkOutDate);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !room.trim()) {
      setError("Name and room are required.");
      return;
    }
    if (total <= 0) {
      setError("Check-out must be after check-in.");
      return;
    }
    if (flag === "blacklist" && !flagNote.trim()) {
      setError("Enter the blacklist reason.");
      return;
    }
    if (flag === "silver" && !flagNote.trim()) {
      setError("Enter the Silver list note.");
      return;
    }
    onSave({
      fullName,
      displayName,
      room,
      checkInDate,
      checkOutDate,
      language,
      preferences,
      status,
      flag,
      flagNote,
    });
  }

  return (
    <section
      className={cn(
        "animate-fade-up rounded-xl border border-line bg-bg px-4 py-5 sm:px-5",
        className,
      )}
      aria-labelledby="edit-guest-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="edit-guest-title" className="text-lg font-semibold text-ink">
            Edit guest
          </h2>
          <p className="mt-1 text-sm text-muted">
            Stay, preferences and operational flag (blacklist / VIP / Silver).
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onCancel}
          aria-label="Close edit"
        >
          <X className="size-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="eg-name">
              Full name
            </label>
            <Input
              id="eg-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="eg-display">
              Greeting name
            </label>
            <Input
              id="eg-display"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="eg-room">
              Room
            </label>
            <Input
              id="eg-room"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="eg-in">
              Check-in
            </label>
            <Input
              id="eg-in"
              type="date"
              value={checkInDate}
              onChange={(e) => setCheckInDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="eg-out">
              Check-out (11:00)
            </label>
            <Input
              id="eg-out"
              type="date"
              value={checkOutDate}
              onChange={(e) => setCheckOutDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="eg-status">
              Status
            </label>
            <select
              id="eg-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as GuestStatus)}
              className="flex h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm text-ink shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <option value="in_house">In house</option>
              <option value="arriving">Arriving today</option>
              <option value="checked_out">Checked out</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="eg-lang">
              Guest language
            </label>
            <select
              id="eg-lang"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="flex h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm text-ink shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <option value="EN">English</option>
              <option value="ES">Spanish</option>
              <option value="FR">French</option>
              <option value="DE">German</option>
              <option value="IT">Italian</option>
              <option value="PT">Portuguese</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="eg-prefs">
              Preferences / notes
            </label>
            <Input
              id="eg-prefs"
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
            />
          </div>
        </div>

        <p className="text-sm text-ink">
          Total nights booked:{" "}
          <span className="font-semibold text-primary">
            {total > 0 ? total : "—"}
          </span>
        </p>

        <fieldset
          className={cn(
            "rounded-lg border px-3 py-3 sm:px-4",
            flag === "blacklist" &&
              "border-[oklch(0.65_0.18_25)] bg-[oklch(0.97_0.03_25)]",
            flag === "vip" &&
              "border-[oklch(0.72_0.12_85)] bg-[oklch(0.97_0.04_90)]",
            flag === "silver" &&
              "border-[oklch(0.7_0.02_250)] bg-[oklch(0.96_0.01_250)]",
            flag === "none" && "border-line bg-surface",
          )}
        >
          <legend className="px-1 text-sm font-medium text-ink">
            Operational flag
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {FLAG_OPTIONS.map(({ value, label, hint, icon: Icon }) => (
              <label
                key={value}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors",
                  flag === value
                    ? "border-primary/40 bg-bg text-ink"
                    : "border-transparent text-ink hover:bg-bg/80",
                )}
              >
                <input
                  type="radio"
                  name="guest-flag"
                  className="mt-1 size-4 accent-[var(--primary)]"
                  checked={flag === value}
                  onChange={() => setFlag(value)}
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Icon className="size-3.5 shrink-0 opacity-70" aria-hidden />
                    {label}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">{hint}</span>
                </span>
              </label>
            ))}
          </div>

          {flag !== "none" ? (
            <div className="mt-3">
              <label
                className="mb-1.5 block text-sm text-muted"
                htmlFor="eg-flag-note"
              >
                {flag === "blacklist"
                  ? "Reason (required)"
                  : flag === "vip"
                    ? "VIP note (optional)"
                    : "Info to keep in mind (required)"}
              </label>
              <Input
                id="eg-flag-note"
                value={flagNote}
                onChange={(e) => setFlagNote(e.target.value)}
                placeholder={
                  flag === "blacklist"
                    ? "e.g. prior incident, do not host…"
                    : flag === "vip"
                      ? "e.g. regular guest, anniversary…"
                      : "e.g. allergy, wheelchair, late arrival…"
                }
                required={flag === "blacklist" || flag === "silver"}
              />
            </div>
          ) : null}
        </fieldset>

        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit">Save changes</Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
}
