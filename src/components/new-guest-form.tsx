"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  defaultStayDates,
  nightsBetween,
  type NewGuestStayInput,
} from "@/lib/guests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { UserPlus, X } from "lucide-react";

type NewGuestFormProps = {
  onSubmit: (input: NewGuestStayInput, options: { enrollPhoto: boolean }) => void;
  onCancel: () => void;
  className?: string;
};

export function NewGuestForm({ onSubmit, onCancel, className }: NewGuestFormProps) {
  const defaults = defaultStayDates();
  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [room, setRoom] = useState("");
  const [checkInDate, setCheckInDate] = useState(defaults.checkInDate);
  const [checkOutDate, setCheckOutDate] = useState(defaults.checkOutDate);
  const [language, setLanguage] = useState("EN");
  const [preferences, setPreferences] = useState("");
  const [checkedInNow, setCheckedInNow] = useState(true);
  const [enrollPhoto, setEnrollPhoto] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const nights = useMemo(
    () => nightsBetween(checkInDate, checkOutDate),
    [checkInDate, checkOutDate],
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError("Enter the guest’s full name.");
      return;
    }
    if (!room.trim()) {
      setError("Enter the room number.");
      return;
    }
    if (!checkInDate || !checkOutDate) {
      setError("Complete the stay dates.");
      return;
    }
    if (nights <= 0) {
      setError("Check-out must be after check-in.");
      return;
    }

    onSubmit(
      {
        fullName,
        displayName,
        room,
        checkInDate,
        checkOutDate,
        language,
        preferences,
        checkedInNow,
      },
      { enrollPhoto },
    );
  }

  return (
    <section
      className={cn(
        "animate-fade-up rounded-xl border border-line bg-surface px-4 py-5 sm:px-5",
        className,
      )}
      aria-labelledby="new-guest-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            id="new-guest-title"
            className="flex items-center gap-2 text-lg font-semibold text-ink"
          >
            <UserPlus className="size-5 text-primary" aria-hidden />
            New guest
          </h2>
          <p className="mt-1 text-sm text-muted text-pretty">
            Register the stay. You can add a check-in photo next.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onCancel}
          aria-label="Close form"
        >
          <X className="size-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="ng-name">
              Full name
            </label>
            <Input
              id="ng-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Ana López Martín"
              autoComplete="name"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="ng-display">
              Greeting name
            </label>
            <Input
              id="ng-display"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ana (optional)"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="ng-room">
              Room
            </label>
            <Input
              id="ng-room"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="314"
              inputMode="numeric"
              required
            />
          </div>
        </div>

        <fieldset className="rounded-lg border border-line bg-bg px-3 py-3 sm:px-4">
          <legend className="px-1 text-sm font-medium text-ink">Stay</legend>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm text-muted" htmlFor="ng-in">
                Check-in
              </label>
              <Input
                id="ng-in"
                type="date"
                value={checkInDate}
                onChange={(e) => setCheckInDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-muted" htmlFor="ng-out">
                Check-out (11:00)
              </label>
              <Input
                id="ng-out"
                type="date"
                value={checkOutDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
                required
              />
            </div>
          </div>
          <p className="mt-3 text-sm text-ink">
            {nights > 0 ? (
              <>
                <span className="font-medium">{nights}</span>{" "}
                {nights === 1 ? "night total" : "nights total"}
                <span className="text-muted"> · checkout at 11:00</span>
              </>
            ) : (
              <span className="text-danger">Check the dates</span>
            )}
          </p>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="ng-lang">
              Guest language
            </label>
            <select
              id="ng-lang"
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
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="ng-prefs">
              Preferences / notes
            </label>
            <Input
              id="ng-prefs"
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex cursor-pointer items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-[var(--primary)]"
              checked={checkedInNow}
              onChange={(e) => setCheckedInNow(e.target.checked)}
            />
            <span>Already checked in (in-house status)</span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-[var(--primary)]"
              checked={enrollPhoto}
              onChange={(e) => setEnrollPhoto(e.target.checked)}
            />
            <span>Continue to face photo after saving</span>
          </label>
        </div>

        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="submit">Create guest</Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
}
