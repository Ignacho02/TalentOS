"use client";

import { cn } from "@/lib/utils";
import { FieldError } from "@/components/field-error";

export function LabeledField({
  label,
  className,
  error,
  children,
}: {
  label: string;
  className?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("grid gap-2", className)}>
      <span className="text-sm font-medium text-zinc-800">{label}</span>
      {children}
      <FieldError message={error} />
    </label>
  );
}
