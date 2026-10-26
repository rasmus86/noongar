"use client";

import type { Guest } from "@/lib/guests";
import { guestInitials } from "@/lib/guests";
import { cn } from "@/lib/utils";

type GuestAvatarProps = {
  guest: Guest;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizeClass = {
  sm: "size-9 text-xs",
  md: "size-12 text-sm",
  lg: "size-20 text-lg",
  xl: "size-28 text-xl",
} as const;

export function GuestAvatar({ guest, size = "md", className }: GuestAvatarProps) {
  const label = `Photo of ${guest.fullName}`;
  if (guest.photoDataUrl) {
    return (
      <img
        src={guest.photoDataUrl}
        alt={label}
        className={cn(
          "shrink-0 rounded-full object-cover ring-2 ring-bg shadow-sm",
          sizeClass[size],
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/12 font-semibold text-primary ring-2 ring-bg",
        sizeClass[size],
        className,
      )}
      aria-label={`${guest.fullName} — no photo`}
      role="img"
    >
      {guestInitials(guest)}
    </div>
  );
}
