"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/locale-context";

export function LoginForm() {
  const router = useRouter();
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Login failed");
      setPending(false);
      return;
    }

    router.push("/hub");
    router.refresh();
  }

  return (
    <form className="panel rounded-[2rem] p-8 md:p-10" onSubmit={onSubmit}>
      <div className="mb-8 space-y-3">
        <p className="eyebrow">{t("common.demoAccess")}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
          {t("login.title")}
        </h1>
        <p className="max-w-lg text-sm leading-6 text-ink-soft">
          {t("login.body")}
        </p>
      </div>

      <div className="grid gap-5">
        <label className="grid gap-2">
          <span className="text-sm text-zinc-700">{t("common.email")}</span>
          <input
            type="email"
            autoComplete="email"
            id="login-email"
            className="rounded-2xl border border-line bg-white/70 px-4 py-3 outline-none transition focus:border-accent"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm text-zinc-700">{t("common.password")}</span>
          <input
            type="password"
            autoComplete="current-password"
            id="login-password"
            className="rounded-2xl border border-line bg-white/70 px-4 py-3 outline-none transition focus:border-accent"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-2xl bg-accent px-5 py-3 text-sm font-medium text-white transition hover:bg-accent-strong disabled:opacity-60"
        >
          {pending ? `${t("common.loading")}...` : t("common.login")}
        </button>

        {error ? (
          <p className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <p className="rounded-2xl border border-line bg-white/50 px-4 py-3 text-xs leading-5 text-ink-soft">
          {t("login.helper")}
        </p>
      </div>
    </form>
  );
}
