"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Página de establecimiento / recuperación de contraseña.
 *
 * Compatible con:
 * - Invitaciones (type=invite)
 * - Recuperación (type=recovery)
 *
 * Flujo correcto:
 * 1. El usuario abre el enlace del email
 * 2. Leemos token_hash y type de la URL
 * 3. verifyOtp() valida el token y crea la sesión
 * 4. updateUser() guarda la nueva contraseña
 * 5. Redirigimos a /hub
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

  // ────────────────────────────────────────────────────────────────────────────
  // Verificar token de invite/recovery
  // ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function verifyToken() {
      try {
        const params = new URLSearchParams(window.location.search);

        const token_hash = params.get("token_hash");
        const type = params.get("type");

        if (!token_hash || !type) {
          setSessionError("Enlace inválido o incompleto.");
          return;
        }

        if (type !== "invite" && type !== "recovery") {
          setSessionError("Tipo de enlace no válido.");
          return;
        }

        const { error } = await supabase.auth.verifyOtp({
          token_hash,
          type,
        });

        if (error) {
          console.error("VERIFY OTP ERROR:", error);

          setSessionError(
            "El enlace ha caducado, ya fue utilizado o no es válido.",
          );

          return;
        }

        setSessionReady(true);
      } catch (err) {
        console.error(err);

        setSessionError(
          "Ha ocurrido un error verificando el enlace.",
        );
      }
    }

    verifyToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ────────────────────────────────────────────────────────────────────────────
  // Validaciones
  // ────────────────────────────────────────────────────────────────────────────
  const passwordStrong = password.length >= 8;
  const passwordsMatch = password === confirm && confirm.length > 0;

  // ────────────────────────────────────────────────────────────────────────────
  // Guardar contraseña
  // ────────────────────────────────────────────────────────────────────────────
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

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      console.error("UPDATE USER ERROR:", updateError);

      setError(updateError.message);

      setPending(false);
      return;
    }

    // Password actualizada correctamente
    router.push("/hub");
    router.refresh();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Error de sesión
  // ────────────────────────────────────────────────────────────────────────────
  if (sessionError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fafaf9] px-5">
        <div className="w-full max-w-md rounded-[2rem] border border-red-200 bg-white p-8 shadow-sm text-center">
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-red-400" />

          <h1 className="mb-2 text-lg font-semibold text-zinc-900">
            Enlace no válido
          </h1>

          <p className="text-sm leading-relaxed text-zinc-500">
            {sessionError}
          </p>

          <button
            type="button"
            onClick={() => router.push("/login")}
            className="mt-6 rounded-full border border-zinc-200 px-5 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
          >
            Volver al inicio
          </button>
        </div>
      </main>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Loading
  // ────────────────────────────────────────────────────────────────────────────
  if (!sessionReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fafaf9]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-accent/20 border-t-accent" />

          <p className="text-sm text-zinc-400">
            Verificando enlace…
          </p>
        </div>
      </main>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Formulario
  // ────────────────────────────────────────────────────────────────────────────
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

          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
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
          className="space-y-5 rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-sm"
        >
          {/* Password */}
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-600"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {password.length > 0 && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <div
                  className={cn(
                    "h-1 w-16 rounded-full transition-colors",
                    passwordStrong ? "bg-green-400" : "bg-red-300",
                  )}
                />

                <span
                  className={cn(
                    "text-xs",
                    passwordStrong ? "text-green-600" : "text-red-400",
                  )}
                >
                  {passwordStrong
                    ? "Contraseña válida"
                    : "Muy corta"}
                </span>
              </div>
            )}
          </div>

          {/* Confirm */}
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

          {/* Submit */}
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