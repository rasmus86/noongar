export type AppLocale = "en";

export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: "English",
};

const messages = {
  en: {
    brand: "Noongar",
    headline: "Remember every person’s name",
    subhead:
      "For people who aren’t good with names: recognise who’s in front of you and get the cue on your wristband.",
    aboutTitle: "About",
    aboutBody:
      "Noongar literally translates as “person” or “people”, and is often used to refer to their community and extended family. This product helps people who forget names treat each person the right way: by name.",
    aboutLink: "About",
    newGuest: "New guest",
    settings: "Settings",
    closeSettings: "Close settings",
    privacyNote:
      "A face photo is sensitive personal data. In this prototype it stays in your browser session only after consent.",
    tabSearch: "Search",
    tabQr: "QR code",
    tabDemo: "Demo QR",
    tabEnroll: "Check-in photo",
    searchLabel: "Name or room",
    searchPlaceholder: "e.g. María or 312",
    searchEmpty:
      "Start typing a name or room number. Only in-house or arriving guests appear.",
    searchNone: "No in-house guest matches that search.",
    qrLabel: "Guest QR token",
    qrHint:
      "On mobile this is scanned with the camera. Here you paste the token to test the same flow.",
    qrInvalid:
      "Invalid code or guest no longer in-house. Try a demo or check the token.",
    resolve: "Resolve",
    demoHint:
      "Demo QR codes. Tap one to identify (you'll see the photo if enrolled).",
    enrollHint: "Pick a guest to capture or update their reception photo.",
    noGuestTitle: "No person selected yet",
    noGuestBody: "Identify with search or QR, or enroll a photo at check-in.",
    withPhoto: "with photo",
    withoutPhoto: "no photo",
    room: "Rm.",
    sendBracelet: "Send to wristband",
    resendBracelet: "Resend to wristband",
    sending: "Sending…",
    edit: "Edit",
    addPhoto: "Add photo",
    updatePhoto: "Update photo",
    braceletSim: "Wristband preview",
    braceletWaiting: "waiting",
    braceletFooter:
      "Bluetooth in Stage 2. Choose in Settings which fields to show.",
    flagAlert: "ALERT",
    flagVip: "VIP",
    flagSilver: "SILVER",
    listBlack: "Blacklist · ALERT",
    listVip: "VIP list · gold",
    listSilver: "Silver list · extra info",
    settingsTitle: "Settings",
    settingsIntro: "Fields shown on the wristband.",
    settingsLanguage: "Language",
    settingsBracelet: "Show on wristband",
    showName: "Name",
    showRoom: "Room",
    showRemaining: "Nights left / total",
    showFlag: "Flag (ALERT / VIP / SILVER)",
    saveClose: "Done",
    cameraFloor: "Floor camera · distance",
    turnOn: "Turn on",
    turnOff: "Turn off",
    retry: "Retry",
    nightsLeft: "Nights left",
    nightsTotal: "Total nights",
    stay: "Stay",
    status: "Status",
    preferences: "Preferences",
    guestIdentified: "Person identified",
    greetAs: "Greet as",
    checkoutAt: "Check-out 11:00",
    statusInHouse: "In house",
    statusArriving: "Arriving today",
    statusOut: "Checked out",
    shownAlert: "ALERT shown on wristband",
    shownVip: "VIP shown on wristband",
    shownSilver: "SILVER shown on wristband",
    shownOk: "Notice shown on wristband",
    remainingToday: "Leaving today",
    remainingCheckout: "Check-out",
    remainingOne: "Left",
    remainingMany: "Left",
    footer: "Noongar · remember names · web prototype · docs/",
  },
} as const;

export type MessageKey = keyof typeof messages.en;

export function t(_locale: AppLocale, key: MessageKey): string {
  return messages.en[key];
}
