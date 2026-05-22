"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Página de establecimiento de contraseña para usuarios invitados.
 *
 * Flujo:
 * 1. El admin invita a un usuario → Supabase manda email con enlace
 * 2. El usuario hace clic → Supabase redirige a /set-password con tokens en la URL
 * 3. Supabase SSR detecta los tokens, inicia sesión automáticamente
 * 4. Esta página pide la contraseña nueva y llama a updateUser()
 * 5. Redirige a /hub
 *
 * Configuración necesaria en Supabase:
 *   Authentication → URL Configuration → Redirect URLs → añadir:
 *   http://localhost:3000/set-password  (desarrollo)
 *   https://tudominio.com/set-password  (producción)
 *
 *   Authentication → Email Templates → Invite user → cambiar {{ .ConfirmationURL }}
 *   por {{ .SiteURL }}/set-password?token_hash={{ .TokenHash }}&type=invite
 */

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // Supabase SSR detecta automáticamente los tokens en el hash/query de la URL
  // y establece la sesión. Esperamos a que esté lista antes de mostrar el formulario.
  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        setSessionReady(true);
      } else if (event === "INITIAL_SESSION" && session) {
        setSessionReady(true);
      } else if (event === "INITIAL_SESSION" && !session) {
        // No hay sesión — el enlace ha caducado o ya se usó
        setSessionError(
          "El enlace de invitación ha caducado o ya fue usado. Pide al administrador que te reenvíe la invitación.",
        );
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const passwordStrong = password.length >= 8;
  const passwordsMatch = password === confirm && confirm.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!passwordStrong) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (!passwordsMatch) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setPending(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setPending(false);
      return;
    }

    // Contraseña establecida → redirigir a la app
    router.push("/hub");
    router.refresh();
  }

  // ── Estado de error de sesión (enlace caducado) ────────────────────────────
  if (sessionError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fafaf9] px-5">
        <div className="w-full max-w-md rounded-[2rem] border border-red-200 bg-white p-8 shadow-sm text-center">
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-red-400" />
          <h1 className="text-lg font-semibold text-zinc-900 mb-2">Enlace no válido</h1>
          <p className="text-sm text-zinc-500 leading-relaxed">{sessionError}</p>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="mt-6 rounded-full border border-zinc-200 px-5 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition"
          >
            Volver al inicio
          </button>
        </div>
      </main>
    );
  }

  // ── Cargando sesión ────────────────────────────────────────────────────────
  if (!sessionReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fafaf9]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-accent/20 border-t-accent" />
          <p className="text-sm text-zinc-400">Verificando invitación…</p>
        </div>
      </main>
    );
  }

  // ── Formulario ─────────────────────────────────────────────────────────────
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fafaf9] px-5">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(13,148,136,0.07),transparent)]"
      />

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10">
            <KeyRound className="h-5 w-5 text-accent" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent mb-2">
            Maduration
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Establece tu contraseña
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Elige una contraseña segura para acceder a tu cuenta.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-sm space-y-5"
        >
          {/* Contraseña nueva */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Nueva contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                className={cn(
                  "w-full rounded-2xl border bg-white px-4 py-2.5 pr-11 text-sm text-zinc-900 outline-none transition focus:ring-2 focus:ring-accent/30",
                  password.length > 0 && !passwordStrong
                    ? "border-red-300 focus:ring-red-200"
                    : "border-zinc-200 focus:border-accent/50",
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {/* Indicador de fortaleza */}
            {password.length > 0 && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <div
                  className={cn(
                    "h-1 w-16 rounded-full transition-colors",
                    passwordStrong ? "bg-green-400" : "bg-red-300",
                  )}
                />
                <span className={cn("text-xs", passwordStrong ? "text-green-600" : "text-red-400")}>
                  {passwordStrong ? "Contraseña válida" : "Muy corta"}
                </span>
              </div>
            )}
          </div>

          {/* Confirmar contraseña */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
              Confirmar contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                placeholder="Repite la contraseña"
                className={cn(
                  "w-full rounded-2xl border bg-white px-4 py-2.5 pr-11 text-sm text-zinc-900 outline-none transition focus:ring-2 focus:ring-accent/30",
                  confirm.length > 0 && !passwordsMatch
                    ? "border-red-300 focus:ring-red-200"
                    : confirm.length > 0 && passwordsMatch
                    ? "border-green-300 focus:ring-green-200"
                    : "border-zinc-200 focus:border-accent/50",
                )}
              />
              {confirm.length > 0 && passwordsMatch && (
                <CheckCircle2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-500" />
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || !passwordStrong || !passwordsMatch}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-50"
          >
            {pending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Guardando…
              </>
            ) : (
              "Establecer contraseña y entrar"
            )}
          </button>
        </form>
      </div>
    </main>
  );
}