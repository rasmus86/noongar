import { AboutNoongar } from "@/components/about-noongar";
import { StaffDesk } from "@/components/staff-desk";
import { AppSettingsProvider } from "@/lib/app-settings";
import { GuestDirectoryProvider } from "@/lib/guest-directory";
import { FooterI18n } from "@/components/footer-i18n";

export default function HomePage() {
  return (
    <AppSettingsProvider>
      <GuestDirectoryProvider>
        <main className="px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
          <StaffDesk />
          <AboutNoongar />
          <FooterI18n />
        </main>
      </GuestDirectoryProvider>
    </AppSettingsProvider>
  );
}
