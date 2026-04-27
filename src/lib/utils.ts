import { clsx } from "clsx";

export function cn(...values: Array<string | false | null | undefined>) {
  return clsx(values);
}

export function formatNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  // toFixed is deterministic on both server and client — no locale dependency
  const fixed = value.toFixed(digits);
  // Trim trailing decimal zeros: "1.20" → "1.2", "1.00" → "1"
  const trimmed = digits > 0 ? fixed.replace(/\.?0+$/, "") : fixed;
  // Add thousand separators manually (always dot-free, comma-as-separator) to stay consistent
  const parts = trimmed.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

export function formatDate(value: string) {
  // Parse YYYY-MM-DD directly to avoid UTC offset shifting the date
  const [year, month, day] = value.split("-").map(Number);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${String(day).padStart(2,"0")} ${months[(month ?? 1) - 1]} ${year}`;
}

export function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function dotGet(
  object: Record<string, unknown>,
  path: string,
): string | undefined {
  return path.split(".").reduce<unknown>((result, key) => {
    if (result && typeof result === "object" && key in result) {
      return (result as Record<string, unknown>)[key];
    }

    return undefined;
  }, object) as string | undefined;
}

export function roundHalf(age: number) {
  return Math.floor(age * 2) / 2;
}

export function calculateAge(dob: string, collectedAt: string) {
  const diff =
    new Date(collectedAt).getTime() - new Date(dob).getTime();

  return diff / (1000 * 60 * 60 * 24 * 365.25);
}