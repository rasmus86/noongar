"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  SEED_GUESTS,
  applyGuestEdit,
  buildGuestFromStay,
  type Guest,
  type GuestEditInput,
  type GuestFlag,
  type NewGuestStayInput,
} from "@/lib/guests";

const STORAGE_KEY = "hostnotify.directory.v5";

type PhotoMap = Record<
  string,
  {
    photoDataUrl: string;
    photoConsentAt: string;
    faceDescriptor: number[] | number[][] | null;
  }
>;

type StoredDirectory = {
  photos: PhotoMap;
  customGuests: Guest[];
  edits: Record<string, GuestEditInput>;
};

type GuestDirectoryValue = {
  guests: Guest[];
  ready: boolean;
  addGuestFromStay: (input: NewGuestStayInput) => Guest;
  updateGuest: (guestId: string, edit: GuestEditInput) => Guest | undefined;
  setGuestPhoto: (
    guestId: string,
    photoDataUrl: string,
    consentAt: string,
    faceDescriptor?: number[] | number[][] | null,
  ) => void;
  clearGuestPhoto: (guestId: string) => void;
  getGuest: (id: string) => Guest | undefined;
};

const GuestDirectoryContext = createContext<GuestDirectoryValue | null>(null);

function normalizeFaceDescriptor(
  raw: unknown,
): number[] | number[][] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  if (typeof raw[0] === "number") {
    return (raw as number[]).length >= 128 ? (raw as number[]) : null;
  }
  const multi = (raw as unknown[])
    .filter(
      (d): d is number[] =>
        Array.isArray(d) && d.length >= 128 && typeof d[0] === "number",
    )
    .map((d) => d.slice());
  return multi.length ? multi : null;
}

function normalizeGuest(g: Guest): Guest {
  return {
    ...g,
    faceDescriptor: normalizeFaceDescriptor(g.faceDescriptor),
    blacklisted: Boolean(g.blacklisted),
    blacklistReason: g.blacklistReason ?? null,
    vip: Boolean(g.vip),
    vipNote: g.vipNote ?? null,
    silver: Boolean(g.silver),
    silverNote: g.silverNote ?? null,
  };
}

function applyPhotos(list: Guest[], photos: PhotoMap): Guest[] {
  return list.map((g) => {
    const saved = photos[g.id];
    if (!saved) return g;
    return {
      ...g,
      photoDataUrl: saved.photoDataUrl,
      photoConsentAt: saved.photoConsentAt,
      faceDescriptor: saved.faceDescriptor ?? null,
    };
  });
}

function applyEdits(
  list: Guest[],
  edits: Record<string, GuestEditInput>,
): Guest[] {
  return list.map((g) => {
    const edit = edits[g.id];
    return edit ? applyGuestEdit(g, edit) : g;
  });
}

/** Migra edits antiguos (blacklisted/vip sueltos) al campo `flag`. */
function normalizeEdit(raw: unknown): GuestEditInput | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.fullName !== "string" || typeof e.room !== "string") return null;

  let flag: GuestFlag = "none";
  let flagNote = "";
  if (typeof e.flag === "string") {
    const f = e.flag as GuestFlag;
    if (f === "blacklist" || f === "vip" || f === "silver" || f === "none") {
      flag = f;
    }
    flagNote = typeof e.flagNote === "string" ? e.flagNote : "";
  } else if (e.blacklisted === true) {
    flag = "blacklist";
    flagNote =
      typeof e.blacklistReason === "string" ? e.blacklistReason : "";
  } else if (e.vip === true) {
    flag = "vip";
    flagNote = typeof e.vipNote === "string" ? e.vipNote : "";
  } else if (e.silver === true) {
    flag = "silver";
    flagNote = typeof e.silverNote === "string" ? e.silverNote : "";
  }

  return {
    fullName: e.fullName,
    displayName: typeof e.displayName === "string" ? e.displayName : "",
    room: e.room,
    checkInDate: typeof e.checkInDate === "string" ? e.checkInDate : "",
    checkOutDate: typeof e.checkOutDate === "string" ? e.checkOutDate : "",
    language: typeof e.language === "string" ? e.language : "ES",
    preferences: typeof e.preferences === "string" ? e.preferences : "",
    status:
      e.status === "arriving" || e.status === "checked_out"
        ? e.status
        : "in_house",
    flag,
    flagNote,
  };
}

function readStore(): StoredDirectory {
  if (typeof window === "undefined") {
    return { photos: {}, customGuests: [], edits: {} };
  }
  try {
    const raw =
      sessionStorage.getItem(STORAGE_KEY) ||
      sessionStorage.getItem("hostnotify.directory.v4") ||
      sessionStorage.getItem("hostnotify.directory.v3") ||
      sessionStorage.getItem("hostnotify.directory.v2");
    if (!raw) return { photos: {}, customGuests: [], edits: {} };
    const parsed = JSON.parse(raw) as Partial<StoredDirectory>;
    const photos: PhotoMap = {};
    if (parsed.photos && typeof parsed.photos === "object") {
      for (const [id, p] of Object.entries(parsed.photos)) {
        photos[id] = {
          photoDataUrl: p.photoDataUrl,
          photoConsentAt: p.photoConsentAt,
          faceDescriptor: normalizeFaceDescriptor(
            "faceDescriptor" in p ? p.faceDescriptor : null,
          ),
        };
      }
    }
    const edits: Record<string, GuestEditInput> = {};
    if (parsed.edits && typeof parsed.edits === "object") {
      for (const [id, edit] of Object.entries(parsed.edits)) {
        const normalized = normalizeEdit(edit);
        if (normalized) edits[id] = normalized;
      }
    }
    return {
      photos,
      customGuests: Array.isArray(parsed.customGuests)
        ? parsed.customGuests.map(normalizeGuest)
        : [],
      edits,
    };
  } catch {
    return { photos: {}, customGuests: [], edits: {} };
  }
}

function writeStore(store: StoredDirectory) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function GuestDirectoryProvider({ children }: { children: ReactNode }) {
  const [photos, setPhotos] = useState<PhotoMap>({});
  const [customGuests, setCustomGuests] = useState<Guest[]>([]);
  const [edits, setEdits] = useState<Record<string, GuestEditInput>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStore();
    setPhotos(stored.photos);
    setCustomGuests(stored.customGuests);
    setEdits(stored.edits);
    setReady(true);
  }, []);

  const persist = useCallback(
    (
      nextPhotos: PhotoMap,
      nextCustom: Guest[],
      nextEdits: Record<string, GuestEditInput>,
    ) => {
      writeStore({
        photos: nextPhotos,
        customGuests: nextCustom,
        edits: nextEdits,
      });
    },
    [],
  );

  const guests = useMemo(
    () =>
      applyEdits(
        applyPhotos(
          [...SEED_GUESTS.map(normalizeGuest), ...customGuests],
          photos,
        ),
        edits,
      ),
    [photos, customGuests, edits],
  );

  const addGuestFromStay = useCallback(
    (input: NewGuestStayInput) => {
      const guest = buildGuestFromStay(input);
      setCustomGuests((prev) => {
        const next = [guest, ...prev];
        persist(photos, next, edits);
        return next;
      });
      return guest;
    },
    [persist, photos, edits],
  );

  const updateGuest = useCallback(
    (guestId: string, edit: GuestEditInput) => {
      const base =
        customGuests.find((g) => g.id === guestId) ||
        SEED_GUESTS.find((g) => g.id === guestId);
      if (!base) return undefined;

      const withPhoto = applyPhotos([normalizeGuest(base)], photos)[0];
      const updated = applyGuestEdit(withPhoto, edit);

      setEdits((prev) => {
        const next = { ...prev, [guestId]: edit };
        // Si es custom, también actualizamos el objeto base
        setCustomGuests((customs) => {
          const nextCustoms = customs.map((g) =>
            g.id === guestId
              ? {
                  ...updated,
                  photoDataUrl: g.photoDataUrl,
                  photoConsentAt: g.photoConsentAt,
                  faceDescriptor: g.faceDescriptor,
                }
              : g,
          );
          persist(photos, nextCustoms, next);
          return nextCustoms;
        });
        if (!customGuests.some((g) => g.id === guestId)) {
          persist(photos, customGuests, next);
        }
        return next;
      });

      return updated;
    },
    [customGuests, photos, persist],
  );

  const setGuestPhoto = useCallback(
    (
      guestId: string,
      photoDataUrl: string,
      consentAt: string,
      faceDescriptor: number[] | number[][] | null = null,
    ) => {
      const normalized = normalizeFaceDescriptor(faceDescriptor);
      setPhotos((prev) => {
        const next = {
          ...prev,
          [guestId]: {
            photoDataUrl,
            photoConsentAt: consentAt,
            faceDescriptor: normalized,
          },
        };
        persist(next, customGuests, edits);
        return next;
      });
      setCustomGuests((prev) =>
        prev.map((g) =>
          g.id === guestId
            ? {
                ...g,
                photoDataUrl,
                photoConsentAt: consentAt,
                faceDescriptor: normalized,
              }
            : g,
        ),
      );
    },
    [customGuests, edits, persist],
  );

  const clearGuestPhoto = useCallback(
    (guestId: string) => {
      setPhotos((prev) => {
        const next = { ...prev };
        delete next[guestId];
        persist(next, customGuests, edits);
        return next;
      });
      setCustomGuests((prev) =>
        prev.map((g) =>
          g.id === guestId
            ? {
                ...g,
                photoDataUrl: null,
                photoConsentAt: null,
                faceDescriptor: null,
              }
            : g,
        ),
      );
    },
    [customGuests, edits, persist],
  );

  const getGuest = useCallback(
    (id: string) => guests.find((g) => g.id === id),
    [guests],
  );

  const value = useMemo(
    () => ({
      guests,
      ready,
      addGuestFromStay,
      updateGuest,
      setGuestPhoto,
      clearGuestPhoto,
      getGuest,
    }),
    [
      guests,
      ready,
      addGuestFromStay,
      updateGuest,
      setGuestPhoto,
      clearGuestPhoto,
      getGuest,
    ],
  );

  return (
    <GuestDirectoryContext.Provider value={value}>
      {children}
    </GuestDirectoryContext.Provider>
  );
}

export function useGuestDirectory() {
  const ctx = useContext(GuestDirectoryContext);
  if (!ctx) {
    throw new Error("useGuestDirectory debe usarse dentro de GuestDirectoryProvider");
  }
  return ctx;
}
