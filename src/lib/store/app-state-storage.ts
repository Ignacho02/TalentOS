import { STORAGE_KEY } from "@/lib/config";
import { demoState } from "@/lib/demo-data";
import type { AppState } from "@/lib/types";

export function readStoredAppState(
  normalizeState: (input: unknown) => AppState,
): AppState {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (stored) {
      return normalizeState(JSON.parse(stored));
    }
  } catch {
    // Keep demo state if persisted data is malformed.
  }

  return demoState;
}

export function persistAppState(state: AppState) {
  globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function confirmResetState(locale: AppState["preferences"]["locale"]) {
  const message =
    locale === "es"
      ? "¿Estás seguro de que quieres borrar todos los datos y restablecer la demo?"
      : "Are you sure you want to clear all data and reset the demo?";

  return globalThis.confirm(message);
}
