import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getSessionUserOrNoClub } from "@/lib/auth";
import { LocaleProvider } from "@/lib/i18n/locale-context";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const session = await getSessionUserOrNoClub();
  const locale = cookieStore.get("maduration_locale")?.value === "en" ? "en" : "es";

  if (session) {
    // Tiene sesión pero no club → onboarding
    if ("hasClub" in session && !session.hasClub) redirect("/onboarding");
    // Tiene club → app
    redirect("/hub");
  }

  return (
    <LocaleProvider initialLocale={locale}>
      <main className="relative min-h-screen overflow-hidden px-5 py-8 md:px-8 md:py-10">
        <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="fade-up rounded-[2.5rem] border border-white/35 bg-[linear-gradient(180deg,rgba(10,34,55,0.95),rgba(17,72,69,0.9))] p-8 text-white shadow-2xl shadow-black/10 md:p-12">
            <p className="eyebrow text-white/70">Maduration</p>
            <div className="mt-6 max-w-2xl space-y-6">
              <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
                Biological growth, translated into decisions your staff can trust.
              </h1>
              <p className="max-w-xl text-base leading-8 text-white/78 md:text-lg">
                DataHub, maturity equations, dashboards and a scalable structure for performance,
                education and future club-to-club collaboration.
              </p>
              <blockquote className="max-w-lg rounded-[1.75rem] border border-white/15 bg-white/8 px-5 py-4 text-sm leading-6 text-white/80">
                &quot;Chronological age does not tell the full story. Maduration turns it into useful context for better decisions.&quot;
              </blockquote>
            </div>
          </section>

          <div className="fade-up [animation-delay:120ms]">
            <LoginForm />
          </div>
        </div>
      </main>
    </LocaleProvider>
  );
}