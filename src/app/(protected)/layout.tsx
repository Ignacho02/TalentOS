import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import ErrorBoundary from "@/components/error-boundary";
import { requireSession } from "@/lib/auth";
import { LocaleProvider } from "@/lib/i18n/locale-context";
import { AppStateProvider } from "@/lib/store/app-state";
import { loadAppStateForSession } from "@/lib/supabase/app-state";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const cookieStore = await cookies();
  const fallbackLocale = cookieStore.get("maduration_locale")?.value === "en" ? "en" : "es";
  const initialState = await loadAppStateForSession(session, fallbackLocale);

  return (
    <LocaleProvider initialLocale={initialState.preferences.locale}>
      <AppStateProvider initialState={initialState}>
        <AppShell userEmail={session.email}>
          <ErrorBoundary>{children}</ErrorBoundary>
        </AppShell>
      </AppStateProvider>
    </LocaleProvider>
  );
}
