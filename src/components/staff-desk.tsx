"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import {
  activeGuests,
  findGuestByQuery,
  findGuestByToken,
  guestFlag,
  remainingStayLabel,
  type Guest,
  type GuestFlag,
} from "@/lib/guests";
import { useAppSettings } from "@/lib/app-settings";
import { useGuestDirectory } from "@/lib/guest-directory";
import { BraceletPreview } from "@/components/bracelet-preview";
import { FaceCapture } from "@/components/face-capture";
import { GuestAvatar } from "@/components/guest-avatar";
import { GuestCard } from "@/components/guest-card";
import { GuestEditForm } from "@/components/guest-edit-form";
import { LiveIdentifyCamera } from "@/components/live-identify-camera";
import { NewGuestForm } from "@/components/new-guest-form";
import { SettingsPanel } from "@/components/settings-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Camera,
  QrCode,
  Search,
  Settings2,
  TriangleAlert,
  UserPlus,
} from "lucide-react";

type Mode = "search" | "qr" | "demo" | "enroll";

export function StaffDesk() {
  const {
    guests,
    addGuestFromStay,
    updateGuest,
    setGuestPhoto,
    clearGuestPhoto,
    getGuest,
  } = useGuestDirectory();
  const { settings, tr } = useAppSettings();
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [token, setToken] = useState("");
  const [results, setResults] = useState<Guest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [notifying, setNotifying] = useState(false);
  const [braceletVisible, setBraceletVisible] = useState(false);
  const [braceletFading, setBraceletFading] = useState(false);
  const [braceletName, setBraceletName] = useState<string | null>(null);
  const [braceletRoom, setBraceletRoom] = useState<string | null>(null);
  const [braceletRemaining, setBraceletRemaining] = useState<string | null>(
    null,
  );
  const [braceletFlag, setBraceletFlag] = useState<GuestFlag>("none");
  const [notified, setNotified] = useState(false);
  const [showEnroll, setShowEnroll] = useState(false);
  const [showNewGuest, setShowNewGuest] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabsId = useId();

  const selected = selectedId ? (getGuest(selectedId) ?? null) : null;

  useEffect(() => {
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, []);

  function selectGuest(guest: Guest) {
    setSelectedId(guest.id);
    setSearchError(null);
    setQrError(null);
    setNotified(false);
    setShowEdit(false);
  }

  function openEnroll(guest?: Guest) {
    if (guest) selectGuest(guest);
    setShowEnroll(true);
    setMode("enroll");
  }

  function runSearch(value: string) {
    setQuery(value);
    startTransition(() => {
      const found = findGuestByQuery(guests, value);
      setResults(found);
      if (value.trim() && found.length === 0) {
        setSearchError(tr("searchNone"));
        setSelectedId(null);
      } else {
        setSearchError(null);
      }
    });
  }

  function resolveToken(raw: string) {
    setToken(raw);
    const guest = findGuestByToken(guests, raw);
    if (!raw.trim()) {
      setQrError(null);
      return;
    }
    if (!guest) {
      setQrError(tr("qrInvalid"));
      setSelectedId(null);
      setNotified(false);
      return;
    }
    setQrError(null);
    selectGuest(guest);
  }

  function pushToBracelet(guest: Guest, opts?: { fromCamera?: boolean }) {
    selectGuest(guest);
    setNotifying(true);
    window.setTimeout(() => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      setBraceletName(guest.displayName);
      setBraceletRoom(guest.room);
      setBraceletRemaining(
        remainingStayLabel(guest, new Date(), settings.locale),
      );
      setBraceletFlag(guestFlag(guest));
      setBraceletVisible(true);
      setBraceletFading(false);
      setNotified(true);
      setNotifying(false);
      fadeTimer.current = setTimeout(() => setBraceletFading(true), 6500);
      clearTimer.current = setTimeout(() => {
        setBraceletVisible(false);
        setBraceletFading(false);
        setBraceletName(null);
        setBraceletRoom(null);
        setBraceletRemaining(null);
        setBraceletFlag("none");
      }, opts?.fromCamera ? 10000 : 8000);
    }, opts?.fromCamera ? 120 : 450);
  }

  function notifyBracelet() {
    if (!selected) return;
    pushToBracelet(selected);
  }

  const demos = activeGuests(guests);
  const withoutPhoto = demos.filter((g) => !g.photoDataUrl);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
      <div className="min-w-0 space-y-6">
        <header className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="animate-brand-in">
              <p className="font-display text-3xl font-bold tracking-[-0.03em] text-primary sm:text-4xl">
                {tr("brand")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowSettings((v) => !v);
                  setShowNewGuest(false);
                  setShowEdit(false);
                }}
                aria-pressed={showSettings}
              >
                <Settings2 className="size-4" aria-hidden />
                {tr("settings")}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setShowNewGuest(true);
                  setShowEnroll(false);
                  setShowSettings(false);
                }}
              >
                <UserPlus className="size-4" aria-hidden />
                {tr("newGuest")}
              </Button>
            </div>
          </div>
          <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-10">
            <div className="space-y-2">
              <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-ink text-balance sm:text-[2.5rem] sm:leading-tight">
                {tr("headline")}
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-muted text-pretty sm:text-lg">
                {tr("subhead")}
              </p>
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
              <Image
                src="/brand/hero.png"
                alt="Smart wristband name tip with camera recognition in a hotel lobby"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 42vw"
                className="object-cover object-center"
              />
            </div>
          </div>
        </header>

        {showSettings ? (
          <SettingsPanel
            open
            onClose={() => setShowSettings(false)}
          />
        ) : null}

        {showNewGuest ? (
          <NewGuestForm
            onCancel={() => setShowNewGuest(false)}
            onSubmit={(input, options) => {
              const guest = addGuestFromStay(input);
              setShowNewGuest(false);
              selectGuest(guest);
              if (options.enrollPhoto) {
                openEnroll(guest);
              } else {
                setMode("search");
                setShowEnroll(false);
              }
            }}
          />
        ) : null}

        <div
          className="flex items-start gap-3 rounded-xl border border-[var(--note-line)] bg-[var(--note)] px-4 py-3 text-sm text-ink"
          role="note"
        >
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0 text-primary"
            aria-hidden
          />
          <p className="text-pretty">{tr("privacyNote")}</p>
        </div>

        <div
          role="tablist"
          aria-label={tr("tabSearch")}
          className="flex flex-wrap gap-2 border-b border-line pb-3"
        >
          {(
            [
              ["search", tr("tabSearch"), Search],
              ["qr", tr("tabQr"), QrCode],
              ["demo", tr("tabDemo"), QrCode],
              ["enroll", tr("tabEnroll"), Camera],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`${tabsId}-${id}`}
              aria-selected={mode === id}
              aria-controls={`${tabsId}-panel`}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 ease-out",
                mode === id
                  ? "bg-primary text-primary-fg"
                  : "text-muted hover:bg-surface hover:text-ink",
              )}
              onClick={() => {
                setMode(id);
                if (id === "enroll") setShowEnroll(true);
              }}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>

        <div
          id={`${tabsId}-panel`}
          role="tabpanel"
          aria-labelledby={`${tabsId}-${mode}`}
          className="space-y-4"
        >
          {mode === "search" ? (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-ink" htmlFor="q">
                {tr("searchLabel")}
              </label>
              <Input
                id="q"
                value={query}
                onChange={(e) => runSearch(e.target.value)}
                placeholder={tr("searchPlaceholder")}
                autoComplete="off"
                aria-invalid={Boolean(searchError)}
                aria-describedby={searchError ? "search-error" : undefined}
              />
              {isPending ? (
                <div className="space-y-2" aria-busy="true">
                  <div className="h-12 animate-pulse rounded-md bg-surface" />
                  <div className="h-12 animate-pulse rounded-md bg-surface" />
                </div>
              ) : null}
              {searchError ? (
                <p id="search-error" className="text-sm text-danger" role="alert">
                  {searchError}
                </p>
              ) : null}
              {!searchError && results.length > 0 ? (
                <ul className="divide-y divide-line rounded-lg border border-line bg-bg">
                  {results.map((guest) => (
                    <li key={guest.id}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-150 ease-out hover:bg-surface",
                          selected?.id === guest.id && "bg-surface",
                        )}
                        onClick={() => selectGuest(guest)}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <GuestAvatar guest={guest} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink">
                              {guest.fullName}
                              {guestFlag(guest) === "blacklist" ? (
                                <span className="ml-2 text-xs font-semibold text-danger">
                                  ALERTA
                                </span>
                              ) : null}
                              {guestFlag(guest) === "vip" ? (
                                <span className="ml-2 text-xs font-semibold text-[oklch(0.55_0.12_80)]">
                                  VIP
                                </span>
                              ) : null}
                              {guestFlag(guest) === "silver" ? (
                                <span className="ml-2 text-xs font-semibold text-[oklch(0.45_0.03_250)]">
                                  SILVER
                                </span>
                              ) : null}
                            </span>
                            <span className="text-sm text-muted">
                              {tr("room")} {guest.room}
                              {guest.photoDataUrl
                                ? ` · ${tr("withPhoto")}`
                                : ` · ${tr("withoutPhoto")}`}
                            </span>
                          </span>
                        </span>
                        <span className="font-mono text-sm text-primary">
                          {guest.room}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {!query.trim() && !selected ? (
                <p className="text-sm text-muted">{tr("searchEmpty")}</p>
              ) : null}
            </div>
          ) : null}

          {mode === "qr" ? (
            <div className="space-y-3">
              <label
                className="block text-sm font-medium text-ink"
                htmlFor="token"
              >
                {tr("qrLabel")}
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="token"
                  value={token}
                  onChange={(e) => resolveToken(e.target.value)}
                  placeholder="HN-312-MARIA"
                  autoComplete="off"
                  className="font-mono uppercase"
                  aria-invalid={Boolean(qrError)}
                  aria-describedby={qrError ? "qr-error" : undefined}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => resolveToken(token)}
                >
                  {tr("resolve")}
                </Button>
              </div>
              {qrError ? (
                <p id="qr-error" className="text-sm text-danger" role="alert">
                  {qrError}
                </p>
              ) : (
                <p className="text-sm text-muted">{tr("qrHint")}</p>
              )}
            </div>
          ) : null}

          {mode === "demo" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">{tr("demoHint")}</p>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {demos.map((guest) => (
                  <li key={guest.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("qr");
                        resolveToken(guest.qrToken);
                      }}
                      className={cn(
                        "flex w-full flex-col items-center gap-3 rounded-xl border border-line bg-bg px-4 py-4 text-center transition-[border-color,background-color,transform] duration-200 ease-out hover:border-primary/40 hover:bg-surface active:scale-[0.99]",
                        selected?.id === guest.id && "border-primary/50 bg-surface",
                      )}
                    >
                      <GuestAvatar guest={guest} size="lg" />
                      <QRCodeSVG
                        value={guest.qrToken}
                        size={96}
                        level="M"
                        bgColor="transparent"
                        fgColor="oklch(0.22 0.03 230)"
                        title={`QR de ${guest.displayName}`}
                      />
                      <span>
                        <span className="block font-medium text-ink">
                          {guest.displayName}
                        </span>
                        <span className="font-mono text-xs text-muted">
                          {tr("room")} {guest.room}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {mode === "enroll" ? (
            <div className="space-y-4">
              <p className="text-sm text-muted">{tr("enrollHint")}</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {demos.map((guest) => (
                  <li key={guest.id}>
                    <button
                      type="button"
                      onClick={() => openEnroll(guest)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border border-line px-3 py-3 text-left transition-colors duration-150 ease-out hover:bg-surface",
                        selected?.id === guest.id && "border-primary/40 bg-surface",
                      )}
                    >
                      <GuestAvatar guest={guest} size="md" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">
                          {guest.fullName}
                        </span>
                        <span className="text-xs text-muted">
                          Rm. {guest.room}
                          {guest.photoDataUrl
                            ? " · photo ready"
                            : " · photo missing"}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {withoutPhoto.length > 0 && !selected ? (
                <p className="text-sm text-muted">
                  {withoutPhoto.length} guest(s) still without a photo.
                </p>
              ) : null}
              {selected && showEnroll ? (
                <FaceCapture
                  guest={selected}
                  onSave={(photo, consentAt, faceDescriptor) => {
                    setGuestPhoto(
                      selected.id,
                      photo,
                      consentAt,
                      faceDescriptor,
                    );
                  }}
                  onClear={() => clearGuestPhoto(selected.id)}
                  onClose={() => setShowEnroll(false)}
                />
              ) : null}
            </div>
          ) : null}
        </div>

        {selected && showEdit ? (
          <GuestEditForm
            guest={selected}
            onCancel={() => setShowEdit(false)}
            onSave={(edit) => {
              const updated = updateGuest(selected.id, edit);
              setShowEdit(false);
              if (updated) {
                setNotified(false);
                setBraceletVisible(false);
                setBraceletFlag("none");
              }
            }}
          />
        ) : null}

        {selected && !(mode === "enroll" && showEnroll) && !showEdit ? (
          <GuestCard
            guest={selected}
            onNotify={notifyBracelet}
            onEnrollPhoto={() => openEnroll(selected)}
            onEdit={() => {
              setShowEnroll(false);
              setShowNewGuest(false);
              setShowEdit(true);
            }}
            notifying={notifying}
            notified={notified}
          />
        ) : null}

        {!selected && !showSettings ? (
          <div className="rounded-xl border border-dashed border-line bg-surface/60 px-5 py-8 text-center">
            <p className="text-sm font-medium text-ink">{tr("noGuestTitle")}</p>
            <p className="mt-1 text-sm text-muted text-pretty">
              {tr("noGuestBody")}
            </p>
          </div>
        ) : null}
      </div>

      <aside className="flex flex-col items-center gap-6 lg:sticky lg:top-8 lg:self-start">
        <LiveIdentifyCamera
          guests={guests}
          onIdentified={(guest) => pushToBracelet(guest, { fromCamera: true })}
        />
        <BraceletPreview
          name={braceletName}
          room={braceletRoom}
          remaining={braceletRemaining}
          flag={braceletFlag}
          visible={braceletVisible}
          fading={braceletFading}
        />
      </aside>
    </div>
  );
}
