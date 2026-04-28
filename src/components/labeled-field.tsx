"use client";

import { cn } from "@/lib/utils";

export function LabeledField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("grid gap-2", className)}>
      <span className="text-sm font-medium text-zinc-800">{label}</span>
      {children}
    </label>
  );
}
