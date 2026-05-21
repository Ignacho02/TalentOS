"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  Flame,
  Dumbbell,
  ChevronRight,
  FlaskConical,
  Globe,
  Palette,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { createClubAction, type CreateClubInput, type CreateClubError } from "@/lib/actions/create-club";
import { cn } from "@/lib/utils";

// Colores predefinidos para el acento del club
const ACCENT_COLORS = [
  { value: "#0d9488", label: "Teal" },
  { value: "#2563eb", label: "Azul" },
  { value: "#7c3aed", label: "Violeta" },
  { value: "#dc2626", label: "Rojo" },
  { value: "#ea580c", label: "Naranja" },
  { value: "#16a34a", label: "Verde" },
  { value: "#0891b2", label: "Cian" },
  { value: "#db2777", label: "Rosa" },
];

type Step = "choose" | "form";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("choose");
  const [isPending, startTransition] = useTransition();

  // Form state
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [sport, setSport] = useState<"football" | "futsal" | "">("");
  const [accentColor, setAccentColor] = useState(ACCENT_COLORS[0].value);
  const [errors, setErrors] = useState<CreateClubError[]>([]);

  function getFieldError(field: CreateClubError["field"]) {
    return errors.find((e) => e.field === field)?.message;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);

    const input: CreateClubInput = { name, region, sport, accentColor };

    startTransition(async () => {
      const result = await createClubAction(input);
      if (result && result.length > 0) {
        setErrors(result);
      }
      // Si no hay errores, createClubAction hace redirect() internamente
    });
  }

  // ── Vista inicial: elegir entre crear club o explorar demo ─────────────────
  if (step === "choose") {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#fafaf9] flex items-center justify-center px-5 py-12">
        {/* Fondo sutil */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(13,148,136,0.08),transparent)]"
        />

        <div className="relative w-full max-w-2xl">
          {/* Cabecera */}
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Maduration
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl">
              Bienvenido. ¿Cómo quieres empezar?
            </h1>
            <p className="mt-3 text-base text-zinc-500">
              Puedes crear tu club ahora o explorar la app con datos de prueba sin comprometerte.
            </p>
          </div>

          {/* Opciones */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Opción A — Crear club */}
            <button
              type="button"
              onClick={() => setStep("form")}
              className="group relative overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white p-6 text-left shadow-sm transition hover:border-accent/40 hover:shadow-md"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10">
                <Shield className="h-5 w-5 text-accent" />
              </div>
              <h2 className="text-base font-semibold text-zinc-900">Crear mi club</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
                Configura tu club, añade equipos, jugadores y empieza a registrar datos reales.
              </p>
              <div className="mt-5 flex items-center gap-1.5 text-sm font-medium text-accent">
                Empezar
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>

            {/* Opción B — Explorar demo */}
            <button
              type="button"
              onClick={() => router.push("/hub?demo=1")}
              className="group relative overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white p-6 text-left shadow-sm transition hover:border-zinc-300 hover:shadow-md"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100">
                <FlaskConical className="h-5 w-5 text-zinc-500" />
              </div>
              <h2 className="text-base font-semibold text-zinc-900">Explorar con datos demo</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
                Usa la app con datos de prueba pregenerados. Ningún dato se guardará en la base de datos.
              </p>
              <div className="mt-5 flex items-center gap-1.5 text-sm font-medium text-zinc-400">
                Explorar
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </div>
              {/* Badge */}
              <span className="absolute right-4 top-4 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-500">
                Sin cuenta
              </span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Vista de formulario ────────────────────────────────────────────────────
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fafaf9] flex items-center justify-center px-5 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(13,148,136,0.08),transparent)]"
      />

      <div className="relative w-full max-w-xl">
        {/* Cabecera */}
        <div className="mb-8">
          <button
            type="button"
            onClick={() => setStep("choose")}
            className="mb-6 flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-600 transition"
          >
            ← Volver
          </button>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Nuevo club
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl">
            Configura tu club
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Puedes cambiar todo esto más adelante desde la sección de Administración.
          </p>
        </div>

        {/* Error general */}
        {getFieldError("general") && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {getFieldError("general")}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Nombre del club */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Nombre del club <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Academia FC Sevilla"
              maxLength={80}
              className={cn(
                "w-full rounded-2xl border bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:ring-2 focus:ring-accent/30",
                getFieldError("name") ? "border-red-300 focus:ring-red-200" : "border-zinc-200 focus:border-accent/50",
              )}
            />
            {getFieldError("name") && (
              <p className="mt-1.5 text-xs text-red-500">{getFieldError("name")}</p>
            )}
          </div>

          {/* Región */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Región / Ciudad <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Globe className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Ej. Sevilla"
                maxLength={80}
                className={cn(
                  "w-full rounded-2xl border bg-white py-2.5 pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:ring-2 focus:ring-accent/30",
                  getFieldError("region") ? "border-red-300 focus:ring-red-200" : "border-zinc-200 focus:border-accent/50",
                )}
              />
            </div>
            {getFieldError("region") && (
              <p className="mt-1.5 text-xs text-red-500">{getFieldError("region")}</p>
            )}
          </div>

          {/* Deporte */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Deporte
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: "", label: "Sin especificar", icon: null },
                  { value: "football", label: "Fútbol", icon: Flame },
                  { value: "futsal", label: "Fútbol Sala", icon: Dumbbell },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSport(opt.value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-2xl border py-3 px-2 text-xs font-medium transition",
                    sport === opt.value
                      ? "border-accent/50 bg-accent/8 text-accent"
                      : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300",
                  )}
                >
                  {opt.icon && <opt.icon className="h-4 w-4" />}
                  {!opt.icon && <span className="h-4" />}
                  {opt.label}
                  {sport === opt.value && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Color de acento */}
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-zinc-700">
              <Palette className="h-4 w-4 text-zinc-400" />
              Color del club
            </label>
            <div className="flex flex-wrap gap-2.5">
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => setAccentColor(c.value)}
                  className={cn(
                    "h-8 w-8 rounded-full transition-all",
                    accentColor === c.value
                      ? "ring-2 ring-offset-2 scale-110"
                      : "hover:scale-105 opacity-70 hover:opacity-100",
                  )}
                  style={{
                    backgroundColor: c.value,
                    ["--tw-ring-color" as string]: c.value,
                  }}
                />
              ))}
            </div>
            {/* Preview */}
            <div
              className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-white w-fit transition-all"
              style={{ backgroundColor: accentColor }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Vista previa del color
            </div>
          </div>

          {/* Botón */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Creando club…
                </>
              ) : (
                <>
                  Crear mi club
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}