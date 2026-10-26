export type GuestStatus = "in_house" | "arriving" | "checked_out";

export type Guest = {
  id: string;
  qrToken: string;
  displayName: string;
  fullName: string;
  room: string;
  status: GuestStatus;
  nightsLeft: number;
  /** Fechas de estancia ISO `YYYY-MM-DD` */
  checkInDate: string;
  checkOutDate: string;
  preferences: string;
  language: string;
  /** Foto voluntaria para ayuda visual al staff (no matching biométrico). */
  photoDataUrl: string | null;
  photoConsentAt: string | null;
  /**
   * Plantilla(s) FaceNet 128-D del enrolamiento.
   * - `number[]` (128): una sola (legado / media).
   * - `number[][]`: varias (cerca + lejos) para mejorar ID a distancia.
   */
  faceDescriptor: number[] | number[][] | null;
  /** Lista negra operativa (alerta al personal / pulsera). */
  blacklisted: boolean;
  blacklistReason: string | null;
  /** Lista VIP (trato preferente · marca dorada). */
  vip: boolean;
  vipNote: string | null;
  /**
   * Lista Silver: info extra a tener en cuenta (alergia grave, petición especial…).
   * Marca plateada en ficha/pulsera.
   */
  silver: boolean;
  silverNote: string | null;
};

/** Marcas operativas del huésped (prioridad: negra > VIP > silver). */
export type GuestFlag = "none" | "blacklist" | "vip" | "silver";

export type GuestEditInput = {
  fullName: string;
  displayName: string;
  room: string;
  checkInDate: string;
  checkOutDate: string;
  language: string;
  preferences: string;
  status: GuestStatus;
  /** Una sola lista activa a la vez. */
  flag: GuestFlag;
  flagNote: string;
};

export type NewGuestStayInput = {
  fullName: string;
  displayName?: string;
  room: string;
  checkInDate: string;
  checkOutDate: string;
  language: string;
  preferences?: string;
  /** Si true, status in_house; si check-in es futuro, arriving. */
  checkedInNow: boolean;
};

/** Hora oficial de check-out del hotel (hora local). */
export const CHECKOUT_HOUR = 11;
export const CHECKOUT_MINUTE = 0;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function todayISO(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** Momento exacto de check-out: fecha de salida a las 11:00 locales. */
export function checkoutDateTime(checkOutDate: string): Date {
  return new Date(
    `${checkOutDate}T${pad2(CHECKOUT_HOUR)}:${pad2(CHECKOUT_MINUTE)}:00`,
  );
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T12:00:00`);
  const b = new Date(`${checkOut}T12:00:00`);
  const ms = b.getTime() - a.getTime();
  if (Number.isNaN(ms) || ms <= 0) return 0;
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function formatStayRange(checkIn: string, checkOut: string): string {
  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
    });
  return `${fmt(checkIn)} → ${fmt(checkOut)} 11:00`;
}

function formatDurationUntil(target: Date, now: Date): string {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "Check-out";
  const totalMin = Math.floor(ms / 60000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours <= 0) return mins <= 1 ? "<1 min" : `${mins} min`;
  if (mins === 0) return hours === 1 ? "1 h" : `${hours} h`;
  return `${hours} h ${mins} m`;
}

/** Noches totales contratadas (entrada → salida). */
export function totalNights(
  guest: Pick<Guest, "checkInDate" | "checkOutDate">,
): number {
  return nightsBetween(guest.checkInDate, guest.checkOutDate);
}

/**
 * Noches de hotel que quedan hasta el check-out (11:00 del día de salida).
 * El día de salida antes de las 11:00 → 0 (sale hoy).
 */
export function remainingNights(
  guest: Pick<Guest, "checkOutDate" | "status">,
  now: Date = new Date(),
): number {
  const checkoutAt = checkoutDateTime(guest.checkOutDate);
  if (
    Number.isNaN(checkoutAt.getTime()) ||
    guest.status === "checked_out" ||
    now.getTime() >= checkoutAt.getTime()
  ) {
    return 0;
  }
  const today = todayISO(now);
  if (guest.checkOutDate === today) return 0;
  return nightsBetween(today, guest.checkOutDate);
}

/**
 * Texto corto para pulsera / ficha: noches restantes (+ horas si sale hoy).
 */
export function remainingStayLabel(
  guest: Pick<Guest, "checkInDate" | "checkOutDate" | "nightsLeft" | "status">,
  now: Date = new Date(),
  _locale: "en" = "en",
): string {
  const checkoutAt = checkoutDateTime(guest.checkOutDate);
  if (Number.isNaN(checkoutAt.getTime())) return "—";

  if (guest.status === "checked_out" || now.getTime() >= checkoutAt.getTime()) {
    return "Check-out";
  }

  const left = remainingNights(guest, now);
  const total = totalNights(guest);
  const dur = formatDurationUntil(checkoutAt, now);
  if (left <= 0) {
    return `Leaving today · ${dur}`;
  }
  if (left === 1) {
    return `Left 1/${total || 1}`;
  }
  return `Left ${left}/${total || left}`;
}

/** Short label: “3 nights” / “1 night”. */
export function totalNightsLabel(
  guest: Pick<Guest, "checkInDate" | "checkOutDate">,
  _locale: "en" = "en",
): string {
  const n = totalNights(guest);
  if (n <= 0) return "—";
  return n === 1 ? "1 night" : `${n} nights`;
}

export function isPastCheckout(
  checkOutDate: string,
  now: Date = new Date(),
): boolean {
  return now.getTime() >= checkoutDateTime(checkOutDate).getTime();
}

function slugToken(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 10);
}

export function buildGuestFromStay(input: NewGuestStayInput): Guest {
  const fullName = input.fullName.trim();
  const displayName =
    input.displayName?.trim() || fullName.split(/\s+/)[0] || fullName;
  const room = input.room.trim();
  const nights = nightsBetween(input.checkInDate, input.checkOutDate);
  const now = new Date();
  const today = todayISO(now);
  let status: GuestStatus = "arriving";
  if (input.checkInDate > today) {
    status = "arriving";
  } else if (isPastCheckout(input.checkOutDate, now)) {
    status = "checked_out";
  } else if (input.checkedInNow || input.checkInDate <= today) {
    status = "in_house";
  }

  return {
    id: `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    qrToken: `HN-${room}-${slugToken(displayName) || "GUEST"}`,
    displayName,
    fullName,
    room,
    status,
    nightsLeft: status === "checked_out" ? 0 : nights,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    preferences: input.preferences?.trim() || "—",
    language: input.language || "EN",
    photoDataUrl: null,
    photoConsentAt: null,
    faceDescriptor: null,
    blacklisted: false,
    blacklistReason: null,
    vip: false,
    vipNote: null,
    silver: false,
    silverNote: null,
  };
}

export function guestFlag(guest: Pick<Guest, "blacklisted" | "vip" | "silver">): GuestFlag {
  if (guest.blacklisted) return "blacklist";
  if (guest.vip) return "vip";
  if (guest.silver) return "silver";
  return "none";
}

export function guestFlagNote(
  guest: Pick<
    Guest,
    "blacklisted" | "blacklistReason" | "vip" | "vipNote" | "silver" | "silverNote"
  >,
): string | null {
  switch (guestFlag(guest)) {
    case "blacklist":
      return guest.blacklistReason;
    case "vip":
      return guest.vipNote;
    case "silver":
      return guest.silverNote;
    default:
      return null;
  }
}

export function applyGuestEdit(guest: Guest, edit: GuestEditInput): Guest {
  const nights = nightsBetween(edit.checkInDate, edit.checkOutDate);
  const note = edit.flagNote.trim();
  const blacklisted = edit.flag === "blacklist";
  const vip = edit.flag === "vip";
  const silver = edit.flag === "silver";
  return {
    ...guest,
    fullName: edit.fullName.trim(),
    displayName: edit.displayName.trim() || edit.fullName.trim().split(/\s+/)[0],
    room: edit.room.trim(),
    checkInDate: edit.checkInDate,
    checkOutDate: edit.checkOutDate,
    language: edit.language,
    preferences: edit.preferences.trim() || "—",
    status: edit.status,
    nightsLeft: edit.status === "checked_out" ? 0 : nights,
    blacklisted,
    blacklistReason: blacklisted ? note || "No reason given" : null,
    vip,
    vipNote: vip ? note || null : null,
    silver,
    silverNote: silver ? note || "Info extra a tener en cuenta" : null,
  };
}

export function defaultStayDates(): { checkInDate: string; checkOutDate: string } {
  const checkInDate = todayISO();
  const out = new Date(`${checkInDate}T12:00:00`);
  out.setDate(out.getDate() + 2);
  const y = out.getFullYear();
  const m = String(out.getMonth() + 1).padStart(2, "0");
  const day = String(out.getDate()).padStart(2, "0");
  return { checkInDate, checkOutDate: `${y}-${m}-${day}` };
}

/** Datos mock de PMS — sustituir por API real en Etapa 1 móvil. */
export const SEED_GUESTS: Guest[] = [
  {
    id: "g1",
    qrToken: "HN-312-MARIA",
    displayName: "María",
    fullName: "María González Ruiz",
    room: "312",
    status: "in_house",
    nightsLeft: 2,
    checkInDate: "2026-10-13",
    checkOutDate: "2026-10-15",
    preferences: "Quiet room · flat white",
    language: "ES",
    photoDataUrl: null,
    photoConsentAt: null,
    faceDescriptor: null,
    blacklisted: false,
    blacklistReason: null,
    vip: false,
    vipNote: null,
    silver: false,
    silverNote: null,
  },
  {
    id: "g2",
    qrToken: "HN-405-JAMES",
    displayName: "James",
    fullName: "James Whitaker",
    room: "405",
    status: "in_house",
    nightsLeft: 4,
    checkInDate: "2026-10-12",
    checkOutDate: "2026-10-16",
    preferences: "Late checkout si posible",
    language: "EN",
    photoDataUrl: null,
    photoConsentAt: null,
    faceDescriptor: null,
    blacklisted: false,
    blacklistReason: null,
    vip: false,
    vipNote: null,
    silver: false,
    silverNote: null,
  },
  {
    id: "g3",
    qrToken: "HN-118-SOFIA",
    displayName: "Sofía",
    fullName: "Sofía Almeida",
    room: "118",
    status: "arriving",
    nightsLeft: 3,
    checkInDate: "2026-10-15",
    checkOutDate: "2026-10-18",
    preferences: "Cot requested",
    language: "PT",
    photoDataUrl: null,
    photoConsentAt: null,
    faceDescriptor: null,
    blacklisted: false,
    blacklistReason: null,
    vip: false,
    vipNote: null,
    silver: false,
    silverNote: null,
  },
  {
    id: "g4",
    qrToken: "HN-221-LUCA",
    displayName: "Luca",
    fullName: "Luca Bianchi",
    room: "221",
    status: "in_house",
    nightsLeft: 1,
    checkInDate: "2026-10-14",
    checkOutDate: "2026-10-15",
    preferences: "Nut allergy",
    language: "IT",
    photoDataUrl: null,
    photoConsentAt: null,
    faceDescriptor: null,
    blacklisted: false,
    blacklistReason: null,
    vip: false,
    vipNote: null,
    silver: true,
    silverNote: "Alergia grave a frutos secos — avisar cocina",
  },
  {
    id: "g5",
    qrToken: "HN-507-AYA",
    displayName: "Aya",
    fullName: "Aya Nakamura",
    room: "507",
    status: "in_house",
    nightsLeft: 5,
    checkInDate: "2026-10-11",
    checkOutDate: "2026-10-16",
    preferences: "Courtyard view · green tea",
    language: "FR",
    photoDataUrl: null,
    photoConsentAt: null,
    faceDescriptor: null,
    blacklisted: false,
    blacklistReason: null,
    vip: true,
    vipNote: "Regular guest · preferred suite",
    silver: false,
    silverNote: null,
  },
  {
    id: "g6",
    qrToken: "HN-090-CARLOS",
    displayName: "Carlos",
    fullName: "Carlos Méndez",
    room: "090",
    status: "checked_out",
    nightsLeft: 0,
    checkInDate: "2026-10-10",
    checkOutDate: "2026-10-12",
    preferences: "—",
    language: "ES",
    photoDataUrl: null,
    photoConsentAt: null,
    faceDescriptor: null,
    blacklisted: false,
    blacklistReason: null,
    vip: false,
    vipNote: null,
    silver: false,
    silverNote: null,
  },
];

/** @deprecated usar SEED_GUESTS + GuestDirectory */
export const GUESTS = SEED_GUESTS;

export function findGuestByQuery(guests: Guest[], query: string): Guest[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return guests.filter(
    (g) =>
      g.status !== "checked_out" &&
      (g.fullName.toLowerCase().includes(q) ||
        g.displayName.toLowerCase().includes(q) ||
        g.room.includes(q) ||
        g.qrToken.toLowerCase().includes(q)),
  );
}

export function findGuestByToken(guests: Guest[], token: string): Guest | null {
  const t = token.trim().toUpperCase();
  if (!t) return null;
  return (
    guests.find((g) => g.qrToken.toUpperCase() === t && g.status !== "checked_out") ??
    null
  );
}

export function activeGuests(guests: Guest[]): Guest[] {
  return guests.filter((g) => g.status !== "checked_out");
}

export function guestInitials(guest: Guest): string {
  return guest.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
