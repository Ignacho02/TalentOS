"use client";

import { cn } from "@/lib/utils";
import {
  fieldErrorsToListItems,
  type FieldErrors,
  type TranslateFn,
} from "@/lib/form-errors";

export function FormErrorBanner({
  summary,
  fieldErrors,
  t,
  className,
}: {
  summary?: string;
  fieldErrors?: FieldErrors;
  /** When provided, list items show field labels (e.g. "Team: Select a team."). */
  t?: TranslateFn;
  className?: string;
}) {
  const items = fieldErrors
    ? fieldErrorsToListItems(t ?? ((key) => key), fieldErrors)
    : [];
  const hasErrors = Boolean(summary) || items.length > 0;
  if (!hasErrors) return null;

  const showList = items.length > 0;

  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800",
        className,
      )}
    >
      {summary ? <p className="font-medium">{summary}</p> : null}
      {showList ? (
        <ul className={cn("list-disc pl-5 space-y-0.5", summary && "mt-2")}>
          {items.map(({ id, label, message }) => (
            <li key={id}>
              <span className="font-medium">{label}:</span> {message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
