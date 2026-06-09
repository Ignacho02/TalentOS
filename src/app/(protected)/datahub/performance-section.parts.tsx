"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronRight,
  Dumbbell,
  Edit2,
  Plus,
  Trash2,
  Trophy,
  X,
  Zap,
  Target,
  Brain,
  Beaker,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/locale-context";
import { useAppState } from "@/lib/store/app-state";
import { useSearchParams } from "next/navigation";
import { clearFieldError } from "@/lib/form-errors";
import { invalidInputClass } from "@/components/field-error";
import { FieldError } from "@/components/field-error";
import { FormErrorBanner } from "@/components/form-error-banner";
import type {
  PerformanceArea,
  PerformanceDefinition,
  PerformanceEntry,
  PerformanceEntryInput,
  TrainingLoadEntry,
} from "@/lib/types";
import { performanceAreaLabels, performancePresets } from "./performance-constants";

const AREA_COLOURS: Record<PerformanceArea, string> = {
  physical: "bg-blue-50 text-blue-700 border-blue-200",
  technicalTactical: "bg-violet-50 text-violet-700 border-violet-200",
  psychological: "bg-amber-50 text-amber-700 border-amber-200",
  motorSkills: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function SessionList({
  entries,
  athletes,
  locale,
  allEntries,
}: {
  entries: TrainingLoadEntry[];
  athletes: { id: string; name: string; teamName?: string }[];
  locale: string;
  allEntries: TrainingLoadEntry[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadColour = (load: number) => {
    if (load === 0) return "text-zinc-400";
    if (load < 200) return "text-green-600";
    if (load < 400) return "text-yellow-600";
    if (load < 600) return "text-orange-500";
    return "text-red-600";
  };

  const rpeColour = (rpe: number) => {
    if (rpe <= 0) return "bg-zinc-100 text-zinc-400";
    if (rpe <= 3) return "bg-green-100 text-green-700";
    if (rpe <= 6) return "bg-yellow-100 text-yellow-700";
    if (rpe <= 8) return "bg-orange-100 text-orange-700";
    return "bg-red-100 text-red-700";
  };

  const historicalAvgRpe = (athleteId: string): number => {
    const past = allEntries.filter((entry) => entry.athleteId === athleteId && entry.attended && entry.rpe > 1);
    if (!past.length) return 0;
    return Math.round(past.reduce((sum, entry) => sum + entry.rpe, 0) / past.length);
  };

  const loadUnit = locale === "en" ? "L.U." : "U.C.";
  const sessionGroups = (() => {
    const map = new Map<
      string,
      { sType: "training" | "match"; teamName: string; entries: TrainingLoadEntry[] }
    >();

    for (const entry of entries) {
      const athlete = athletes.find((item) => item.id === entry.athleteId);
      const teamName = athlete?.teamName ?? "";
      const key = `${entry.sessionType}::${teamName}`;
      if (!map.has(key)) {
        map.set(key, {
          sType: entry.sessionType as "training" | "match",
          teamName,
          entries: [],
        });
      }
      map.get(key)!.entries.push(entry);
    }

    return Array.from(map.values());
  })();

  return (
    <div className="space-y-2">
      {sessionGroups.map(({ sType, teamName, entries: sessionEntries }) => {
        const groupKey = `${sType}::${teamName}`;
        const attended = sessionEntries.filter((entry) => entry.attended);
        const effectiveRpe = (entry: TrainingLoadEntry): number => {
          if (entry.rpe > 1) return entry.rpe;
          const historical = historicalAvgRpe(entry.athleteId);
          return historical > 0 ? historical : entry.rpe;
        };
        const effectiveLoad = (entry: TrainingLoadEntry): number =>
          entry.attended ? entry.minutesPlayed * effectiveRpe(entry) : 0;
        const avgLoad = attended.length
          ? Math.round(attended.reduce((sum, entry) => sum + effectiveLoad(entry), 0) / attended.length)
          : 0;
        const avgRpe = attended.length
          ? Math.round(attended.reduce((sum, entry) => sum + effectiveRpe(entry), 0) / attended.length)
          : 0;
        const minutes = sessionEntries[0]?.minutesPlayed ?? 0;
        const isOpen = expanded === groupKey;
        const label =
          sType === "match"
            ? locale === "en"
              ? "Match"
              : "Partido"
            : locale === "en"
              ? "Training"
              : "Manual";

        return (
          <div key={groupKey} className="overflow-hidden rounded-xl border border-line bg-white/60">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : groupKey)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50/60 transition text-left"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
                    sType === "match" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700",
                  )}
                >
                  {sType === "match" ? <Trophy className="h-3 w-3" /> : <Dumbbell className="h-3 w-3" />}
                  {teamName || label}
                </span>
                <span className="shrink-0 text-xs text-zinc-400">
                  {attended.length}/{sessionEntries.length} · {minutes} min{avgRpe > 0 ? ` · RPE Ø${avgRpe}` : ""}
                </span>
              </div>
              <div className="ml-2 flex shrink-0 items-center gap-2">
                <span className={cn("text-sm font-bold tabular-nums", loadColour(avgLoad))}>
                  Ø {avgLoad} {loadUnit}
                </span>
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-300" />
                )}
              </div>
            </button>

            {isOpen && (
              <div className="space-y-1 border-t border-line/50 px-4 pb-3 pt-2">
                <div
                  className="mb-2 grid text-[10px] font-semibold uppercase tracking-wide text-zinc-400"
                  style={{ gridTemplateColumns: "1fr 44px 52px 64px 50px" }}
                >
                  <span>{locale === "en" ? "Player" : "Jugador"}</span>
                  <span className="text-center">min</span>
                  <span className="text-center">RPE</span>
                  <span className="text-center">{loadUnit}</span>
                  <span className="text-center">{locale === "en" ? "In" : "Asiste"}</span>
                </div>

                {[...sessionEntries]
                  .sort((a, b) => effectiveLoad(b) - effectiveLoad(a))
                  .map((entry) => {
                    const athlete = athletes.find((item) => item.id === entry.athleteId);
                    const entryRpe = effectiveRpe(entry);
                    const entryLoad = effectiveLoad(entry);
                    const usedHistorical = entry.attended && entry.rpe <= 1 && entryRpe > 1;

                    return (
                      <div
                        key={entry.id}
                        className="grid items-center gap-x-1 border-b border-line/30 py-1 last:border-0"
                        style={{ gridTemplateColumns: "1fr 44px 52px 64px 50px" }}
                      >
                        <span
                          className={cn(
                            "truncate text-sm font-medium",
                            entry.attended ? "text-zinc-800" : "text-zinc-400 line-through",
                          )}
                        >
                          {athlete?.name ?? "—"}
                        </span>
                        <span className="text-center text-xs tabular-nums text-zinc-600">
                          {entry.attended ? entry.minutesPlayed : "—"}
                        </span>
                        <div className="flex justify-center">
                          {entry.attended ? (
                            <span
                              className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", rpeColour(entryRpe))}
                              title={usedHistorical ? (locale === "en" ? "Historical avg" : "Media histórica") : undefined}
                            >
                              {entryRpe}
                              {usedHistorical ? "*" : ""}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-300">—</span>
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-center text-sm font-bold tabular-nums",
                            entry.attended ? loadColour(entryLoad) : "text-zinc-300",
                          )}
                        >
                          {entry.attended ? entryLoad : "—"}
                        </span>
                        <div className="flex justify-center">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              entry.attended ? "bg-green-50 text-green-700" : "bg-zinc-100 text-zinc-400",
                            )}
                          >
                            {entry.attended ? (locale === "en" ? "In" : "Sí") : locale === "en" ? "Out" : "No"}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                <div
                  className="mt-1 grid items-center gap-x-1 border-t border-line/50 pt-2"
                  style={{ gridTemplateColumns: "1fr 44px 52px 64px 50px" }}
                >
                  <span className="text-xs font-bold uppercase text-zinc-500">
                    Ø {locale === "en" ? "team" : "equipo"}
                  </span>
                  <span className="text-center text-xs text-zinc-400">—</span>
                  <span className={cn("text-center text-xs font-bold tabular-nums", rpeColour(avgRpe))}>
                    {avgRpe > 0 ? avgRpe : "—"}
                  </span>
                  <span className={cn("text-center text-sm font-bold tabular-nums", loadColour(avgLoad))}>
                    {avgLoad}
                  </span>
                  <span className="text-center text-[10px] text-zinc-400">
                    {attended.length}/{sessionEntries.length}
                  </span>
                </div>

                {attended.some((entry) => entry.rpe <= 1 && historicalAvgRpe(entry.athleteId) > 1) && (
                  <p className="pt-1 text-[10px] italic text-zinc-400">
                    * {locale === "en" ? "Historical avg RPE used" : "Se usó RPE histórica media"}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function MultiSelectPill({
  label,
  options,
  selected,
  onToggle,
  onClear,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition",
          selected.length > 0
            ? "border-accent bg-accent/10 text-accent font-medium"
            : "border-line bg-white/70 text-zinc-700 hover:bg-zinc-50",
        )}
      >
        <span className="max-w-[140px] truncate">{label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition", open && "rotate-180")} />
      </button>

      {open && options.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-2xl border border-line bg-white shadow-lg">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 border-b border-line px-4 py-2.5 text-xs font-medium text-red-500 transition hover:bg-red-50"
            >
              <X className="h-3 w-3" /> {locale === "es" ? "Limpiar selección" : "Clear selection"}
            </button>
          )}
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition",
                selected.includes(option)
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-zinc-700 hover:bg-zinc-50",
              )}
            >
              <span>{option}</span>
              {selected.includes(option) && <span className="text-xs text-accent">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PlayerAreaModal({
  athlete,
  areaKey,
  defs,
  performanceEntries,
  updatePerformanceEntry,
  deletePerformanceEntry,
  onClose,
  onAddResult,
  t,
  canEditPerformance,
}: {
  athlete: { id: string; name: string; teamName?: string; position?: string; photoUrl?: string | null };
  areaKey: PerformanceArea;
  defs: PerformanceDefinition[];
  performanceEntries: PerformanceEntry[];
  updatePerformanceEntry: (id: string, updates: Partial<PerformanceEntryInput>) => void;
  deletePerformanceEntry: (id: string) => void;
  onClose: () => void;
  onAddResult: () => void;
  t: (key: string) => string;
  canEditPerformance?: boolean;
}) {
  const strokeByArea: Record<PerformanceArea, string> = {
    physical: "#3b82f6",
    technicalTactical: "#8b5cf6",
    psychological: "#f59e0b",
    motorSkills: "#10b981",
  };

  const allEntries = useMemo(
    () =>
      performanceEntries
        .filter(
          (entry) =>
            (entry.athleteId === athlete.id || entry.athleteName === athlete.name) &&
            entry.area === areaKey,
        )
        .sort((a, b) => a.measurementDate.localeCompare(b.measurementDate)),
    [performanceEntries, athlete, areaKey],
  );

  const byTest = useMemo(() => {
    const map = new Map<string, PerformanceEntry[]>();
    for (const entry of allEntries) {
      const current = map.get(entry.testName) ?? [];
      current.push(entry);
      map.set(entry.testName, current);
    }
    return map;
  }, [allEntries]);

  const presentDefs = defs.filter((definition) => byTest.has(definition.name));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Partial<PerformanceEntryInput>>({});

  function startEdit(entry: PerformanceEntry) {
    setEditingId(entry.id);
    setEditFields({
      value: entry.value,
      measurementDate: entry.measurementDate,
      notes: entry.notes ?? "",
      ratingLevel: entry.ratingLevel,
      ratingValue: entry.ratingValue,
    });
  }

  function saveEdit() {
    if (!editingId) return;
    updatePerformanceEntry(editingId, editFields);
    setEditingId(null);
  }

  function confirmDelete(id: string) {
    if (globalThis.confirm(t("common.confirmDelete") || "¿Eliminar este registro?")) {
      deletePerformanceEntry(id);
    }
  }

  const displayValue = (entry: PerformanceEntry) =>
    entry.ratingLevel
      ? `${entry.ratingLevel}${entry.ratingValue != null ? ` · ${formatNumber(entry.ratingValue, 1)}` : ""} ${entry.unit}`
      : `${formatNumber(entry.value, 2)} ${entry.unit}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-line px-6 pb-4 pt-6 shrink-0">
          <div className="flex items-center gap-4">
            {athlete.photoUrl ? (
              <img src={athlete.photoUrl} alt={athlete.name} className="h-14 w-14 rounded-full border border-line object-cover shrink-0" />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100">
                <span className="text-xl font-bold text-zinc-400">{athlete.name.charAt(0)}</span>
              </div>
            )}
            <div>
              <h3 className="text-xl font-bold text-zinc-900">{athlete.name}</h3>
              <p className="mt-0.5 text-sm text-zinc-500">
                {athlete.teamName ?? "—"} · {athlete.position ?? "—"}
              </p>
              <span
                className={cn(
                  "mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold",
                  AREA_COLOURS[areaKey],
                )}
              >
                {t(performanceAreaLabels[areaKey])}
              </span>
            </div>
          </div>
          <div className="ml-4 flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onAddResult}
              disabled={!canEditPerformance}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-3.5 w-3.5" />Añadir resultado
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-8 overflow-y-auto px-6 py-5">
          {presentDefs.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">{t("datahub.noResultsYet")}</p>
          ) : (
            presentDefs.map((definition) => {
              const entries = byTest.get(definition.name) ?? [];
              const latest = entries[entries.length - 1];
              const chartData = entries.map((entry) => ({
                date: entry.measurementDate.slice(0, 7),
                value: entry.ratingValue ?? entry.value,
              }));

              return (
                <div key={definition.id} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-zinc-900">
                      {(definition.nameKey ? t(definition.nameKey) : null) || definition.name}
                      <span className="ml-1.5 text-xs font-normal text-zinc-400">({definition.unit})</span>
                    </p>
                    <div className="h-px flex-1 bg-zinc-100" />
                    {latest && <span className="text-sm font-bold text-zinc-900">{displayValue(latest)}</span>}
                  </div>

                  {chartData.length >= 2 && !latest?.ratingLevel && (
                    <ResponsiveContainer width="100%" height={100}>
                      <LineChart data={chartData} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} />
                        <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                        <Tooltip
                          contentStyle={{ fontSize: 11, borderRadius: 8 }}
                          formatter={(value) => [
                            `${formatNumber(Number(value ?? 0), 2)} ${definition.unit}`,
                            (definition.nameKey ? t(definition.nameKey) : null) || definition.name,
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke={strokeByArea[areaKey]}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}

                  <div className="overflow-hidden rounded-xl border border-line">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-line bg-zinc-50 text-zinc-400">
                          <th className="px-3 py-2 font-medium">{t("datahub.date") || "Fecha"}</th>
                          <th className="px-3 py-2 font-medium">{t("datahub.result") || "Resultado"}</th>
                          <th className="px-3 py-2 font-medium">{t("common.notes") || "Notas"}</th>
                          <th className="w-16 px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {[...entries].reverse().map((entry) => (
                          <Fragment key={entry.id}>
                            <tr className="border-t border-line/40 transition hover:bg-zinc-50/60">
                              {editingId === entry.id ? (
                                <>
                                  <td className="px-3 py-2">
                                    <input
                                      type="date"
                                      value={editFields.measurementDate ?? ""}
                                      onChange={(event) =>
                                        setEditFields((fields) => ({ ...fields, measurementDate: event.target.value }))
                                      }
                                      className="w-32 rounded-lg border border-line bg-white px-2 py-1 text-xs outline-none focus:border-accent/50"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    {entry.ratingLevel ? (
                                      <input
                                        type="text"
                                        value={editFields.ratingLevel ?? ""}
                                        onChange={(event) =>
                                          setEditFields((fields) => ({ ...fields, ratingLevel: event.target.value }))
                                        }
                                        className="w-24 rounded-lg border border-line bg-white px-2 py-1 text-xs outline-none focus:border-accent/50"
                                      />
                                    ) : (
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={editFields.value ?? ""}
                                        onChange={(event) =>
                                          setEditFields((fields) => ({ ...fields, value: Number(event.target.value) }))
                                        }
                                        className="w-24 rounded-lg border border-line bg-white px-2 py-1 text-xs outline-none focus:border-accent/50"
                                      />
                                    )}
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="text"
                                      value={editFields.notes ?? ""}
                                      onChange={(event) =>
                                        setEditFields((fields) => ({ ...fields, notes: event.target.value }))
                                      }
                                      className="w-full rounded-lg border border-line bg-white px-2 py-1 text-xs outline-none focus:border-accent/50"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="flex gap-1">
                                      <button
                                        type="button"
                                        onClick={saveEdit}
                                        className="rounded-lg bg-accent px-2 py-1 text-[10px] font-medium text-white hover:bg-accent/90"
                                      >
                                        {t("datahub.save") || "Guardar"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingId(null)}
                                        className="rounded-lg border border-line px-2 py-1 text-[10px] text-zinc-500 hover:bg-zinc-50"
                                      >
                                        {t("datahub.cancel") || "Cancelar"}
                                      </button>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="px-3 py-2 text-zinc-600">{formatDate(entry.measurementDate)}</td>
                                  <td className="px-3 py-2 font-semibold text-zinc-900">{displayValue(entry)}</td>
                                  <td className="px-3 py-2 text-zinc-500">{entry.notes || "—"}</td>
                                  <td className="px-3 py-2">
                                    <div className="flex gap-1">
                                      <button
                                        type="button"
                                        onClick={() => startEdit(entry)}
                                        disabled={!canEditPerformance}
                                        className="rounded-full p-1.5 text-zinc-400 transition hover:bg-accent/10 hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-400"
                                        title={t("common.edit") || "Editar"}
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => confirmDelete(entry.id)}
                                        disabled={!canEditPerformance}
                                        className="rounded-full p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-400"
                                        title={t("common.delete") || "Eliminar"}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

import type { FieldErrors } from "@/lib/form-errors";

function clubInputClass(hasError: boolean, extra?: string) {
  return cn(
    "w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-accent/50 font-sans",
    hasError ? invalidInputClass : "border-line",
    extra,
  );
}

const areaStyles: Record<string, {
  icon: React.ElementType;
  chipClass: string;
  badgeClass: string;
  iconClass: string;
}> = {
  physical: {
    icon: Zap,
    chipClass: "border-orange-200 bg-orange-50 text-orange-800 hover:border-orange-400 hover:bg-orange-100",
    badgeClass: "bg-orange-100 text-orange-700",
    iconClass: "text-orange-500",
  },
  technicalTactical: {
    icon: Target,
    chipClass: "border-blue-200 bg-blue-50 text-blue-800 hover:border-blue-400 hover:bg-blue-100",
    badgeClass: "bg-blue-100 text-blue-700",
    iconClass: "text-blue-500",
  },
  psychological: {
    icon: Brain,
    chipClass: "border-purple-200 bg-purple-50 text-purple-800 hover:border-purple-400 hover:bg-purple-100",
    badgeClass: "bg-purple-100 text-purple-700",
    iconClass: "text-purple-500",
  },
  motorSkills: {
    icon: Dumbbell,
    chipClass: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400 hover:bg-emerald-100",
    badgeClass: "bg-emerald-100 text-emerald-700",
    iconClass: "text-emerald-500",
  },
};

export function TestBatteryTab({
  testBatteryArea,
  setTestBatteryArea,
  showAddTestForm,
  setShowAddTestForm,
  newDef,
  setNewDef,
  areaTestDefs,
  addDef,
  delDef,
  handleMedia,
  testDefErrors,
  testDefSummary,
  clearTestDefErrors,
  setTestDefErrors,
  updatePerformanceDefinition,
  t,
}: {
  testBatteryArea: PerformanceArea;
  setTestBatteryArea: (area: PerformanceArea) => void;
  showAddTestForm: boolean;
  setShowAddTestForm: (show: boolean) => void;
  newDef: { name: string; nameKey: string | undefined; descriptionKey: string | undefined; unit: string; attempts: number; isRating: boolean; scoringStrategy: "best" | "average"; interpretation: "higher_better" | "lower_better"; description: string; mediaUrl: string; mediaType: "image" | "video" | undefined; subCategory: string | undefined };
  setNewDef: React.Dispatch<React.SetStateAction<typeof newDef>>;
  areaTestDefs: PerformanceDefinition[];
  addDef: (e: React.FormEvent) => void;
  delDef: (id: string) => void;
  handleMedia: (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "video") => void;
  testDefErrors: FieldErrors;
  testDefSummary: string;
  clearTestDefErrors: () => void;
  setTestDefErrors: React.Dispatch<React.SetStateAction<FieldErrors>>;
  updatePerformanceDefinition: (id: string, updates: Partial<PerformanceDefinition>) => void;
  t: (key: string) => string;
}) {
  const { state } = useAppState();
  const searchParams = useSearchParams();
  const [selectedTestDef, setSelectedTestDef] = useState<PerformanceDefinition | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState<{ name: string; unit: string; attempts: number; isRating: boolean; scoringStrategy: "best" | "average"; interpretation: "higher_better" | "lower_better"; description: string; mediaUrl: string; mediaType: "image" | "video" | undefined }>({ name: "", unit: "", attempts: 1, isRating: false, scoringStrategy: "best", interpretation: "higher_better", description: "", mediaUrl: "", mediaType: undefined });

  function openDetail(def: PerformanceDefinition) {
    setSelectedTestDef(def);
    setEditMode(false);
    setEditFields({ name: def.name, unit: def.unit, attempts: def.attempts, isRating: def.isRating ?? false, scoringStrategy: def.scoringStrategy ?? "best", interpretation: def.interpretation ?? "higher_better", description: def.description ?? "", mediaUrl: def.mediaUrl ?? "", mediaType: def.mediaType });
  }

  function closeDetail() {
    setSelectedTestDef(null);
    setEditMode(false);
  }

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      const def = state.performanceDefinitions.find(d => d.id === id);
      if (def) {
        setTestBatteryArea(def.area);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        openDetail(def);
      }
    }
  }, [searchParams, setTestBatteryArea, state.performanceDefinitions]);

  function saveEdit() {
    if (!selectedTestDef) return;
    updatePerformanceDefinition(selectedTestDef.id, {
      name: editFields.name.trim() || selectedTestDef.name,
      nameKey: undefined,
      unit: editFields.unit.trim() || selectedTestDef.unit,
      attempts: editFields.attempts,
      isRating: editFields.isRating,
      scoringStrategy: editFields.scoringStrategy,
      interpretation: editFields.interpretation,
      description: editFields.description || undefined,
      descriptionKey: undefined,
      mediaUrl: editFields.mediaUrl || undefined,
      mediaType: editFields.mediaType,
    });
    closeDetail();
  }

  function handleEditMedia(e: React.ChangeEvent<HTMLInputElement>, type: "image" | "video") {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => { setEditFields(c => ({ ...c, mediaUrl: ev.target?.result as string, mediaType: type })); };
    r.readAsDataURL(f);
  }

  return (
    <section className="panel rounded-[1.75rem] p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t("club.testBattery")}</h2>
          <p className="mt-2 text-sm text-zinc-600">{t("datahub.createMetricsBody")}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddTestForm(!showAddTestForm)}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
            showAddTestForm
              ? "bg-zinc-200 text-zinc-700"
              : "bg-accent text-white hover:bg-accent/90"
          )}
        >
          {showAddTestForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showAddTestForm ? t("datahub.cancel") : t("club.addTest")}
        </button>
      </div>

      {/* Area selector */}
      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {(Object.keys(performanceAreaLabels) as PerformanceArea[]).map(item => {
          const style = areaStyles[item] ?? areaStyles.physical;
          const AreaIcon = style.icon;
          const isActive = testBatteryArea === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => setTestBatteryArea(item as PerformanceArea)}
              className={cn(
                "rounded-2xl border-2 px-5 py-4 text-left transition-all duration-200 hover:shadow-lg",
                isActive ? "border-accent bg-accent text-white shadow-md" : "border-gray-300 bg-white hover:bg-gray-50"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <AreaIcon className={cn("h-5 w-5", isActive ? "text-white/90" : style.iconClass)} />
                <p className="text-base font-semibold leading-tight">{t(performanceAreaLabels[item as PerformanceArea])}</p>
              </div>
              <p className={cn("text-sm", isActive ? "text-white/80" : "text-zinc-500")}>
                {item === "physical" ? t("datahub.physicalDesc") : item === "technicalTactical" ? t("datahub.technicalTacticalDesc") : item === "psychological" ? t("datahub.psychologicalDesc") : t("datahub.motorSkillsDesc")}
              </p>
            </button>
          );
        })}
      </section>

      {/* Chips list */}
      {areaTestDefs.length > 0 ? (
        <div className="rounded-[1.75rem] border border-line bg-white/50 p-6">
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-zinc-900">{t("datahub.testsAvailable")}</h3>
            <p className="mt-1 text-sm text-zinc-600">{areaTestDefs.length} {t("datahub.testsRegistered")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {areaTestDefs.map(d => {
              const style = areaStyles[d.area] ?? areaStyles.physical;
              const AreaIcon = style.icon;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => { openDetail(d); }}
                  className={cn("inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-all duration-150", style.chipClass)}
                >
                  <AreaIcon className={cn("h-3.5 w-3.5 flex-shrink-0", style.iconClass)} />
                  {d.nameKey ? t(d.nameKey) : d.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        !showAddTestForm && (
          <div className="rounded-[1.75rem] border border-dashed border-line bg-white/30 p-12 text-center">
            <Beaker className="h-12 w-12 mx-auto mb-4 text-zinc-400" />
            <p className="text-sm text-zinc-600 mb-4">{t("club.noTestsDefined")}</p>
            <button
              type="button"
              onClick={() => setShowAddTestForm(true)}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent/90"
            >
              <Plus className="h-4 w-4" />
              {t("club.addTest")}
            </button>
          </div>
        )
      )}

      {/* Test Detail / Edit — centred overlay, same style as Modal */}
      {selectedTestDef && typeof document !== "undefined" && createPortal((
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200"
          onClick={closeDetail}
        >
          <div
            className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-line shrink-0">
              <div className="flex min-w-0 items-center gap-4 pr-3">
                {(() => {
                  const style = areaStyles[selectedTestDef.area] ?? areaStyles.physical;
                  const AreaIcon = style.icon;
                  return (
                    <div className={cn("h-14 w-14 rounded-full flex items-center justify-center border flex-shrink-0", style.badgeClass)}>
                      <AreaIcon className="h-7 w-7" />
                    </div>
                  );
                })()}
                <div className="min-w-0">
                  {editMode ? (
                    <input
                      className="w-full rounded-lg border border-line bg-zinc-50 px-3 py-2 text-xl font-bold text-zinc-900 outline-none focus:bg-white focus:ring-2 focus:ring-accent/20"
                      value={editFields.name}
                      onChange={e => setEditFields(c => ({ ...c, name: e.target.value }))}
                    />
                  ) : (
                    <h3 className="text-xl font-bold text-zinc-900 leading-tight">{selectedTestDef.nameKey ? t(selectedTestDef.nameKey) : selectedTestDef.name}</h3>
                  )}
                  {(() => {
                    const style = areaStyles[selectedTestDef.area] ?? areaStyles.physical;
                    const AreaIcon = style.icon;
                    return (
                      <span className={cn("inline-flex items-center gap-1.5 mt-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", style.badgeClass)}>
                        <AreaIcon className="h-3 w-3" />
                        {t(performanceAreaLabels[selectedTestDef.area as PerformanceArea] ?? selectedTestDef.area)}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <button
                type="button"
                onClick={closeDetail}
                className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto px-6 py-5 space-y-6">
              {editMode ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">{t("datahub.metricUnit")}</label>
                      <input
                        className="w-full rounded-lg border border-line bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:bg-white focus:border-accent/50"
                        value={editFields.unit}
                        onChange={e => setEditFields(c => ({ ...c, unit: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">{t("datahub.attemptsCount")}</label>
                      <input
                        type="number" min={1}
                        className="w-full rounded-lg border border-line bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:bg-white focus:border-accent/50"
                        value={editFields.attempts}
                        onChange={e => setEditFields(c => ({ ...c, attempts: Number(e.target.value) || 1 }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">{t("datahub.resultType")}</label>
                      <select
                        className="w-full rounded-lg border border-line bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:bg-white focus:border-accent/50"
                        value={editFields.isRating ? "rating" : "numeric"}
                        onChange={e => setEditFields(c => ({ ...c, isRating: e.target.value === "rating" }))}
                      >
                        <option value="numeric">{t("datahub.resultNumeric")}</option>
                        <option value="rating">{t("datahub.resultRating")}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">{t("datahub.metricGoal")}</label>
                      <select
                        className={cn("w-full rounded-lg border border-line px-3 py-2.5 text-sm text-zinc-900 outline-none transition", editFields.attempts === 1 ? "bg-zinc-100 opacity-50 cursor-not-allowed" : "bg-zinc-50 focus:bg-white focus:border-accent/50")}
                        value={editFields.scoringStrategy}
                        disabled={editFields.attempts === 1}
                        onChange={e => setEditFields(c => ({ ...c, scoringStrategy: e.target.value as "best" | "average" }))}
                      >
                        <option value="best">{t("datahub.calcBest")}</option>
                        <option value="average">{t("datahub.calcAverage")}</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-zinc-500 mb-1">{t("datahub.metricInterpretation")}</label>
                      <select
                        className="w-full rounded-lg border border-line bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:bg-white focus:border-accent/50"
                        value={editFields.interpretation}
                        onChange={e => setEditFields(c => ({ ...c, interpretation: e.target.value as "higher_better" | "lower_better" }))}
                      >
                        <option value="higher_better">{t("datahub.interpretHigher")}</option>
                        <option value="lower_better">{t("datahub.interpretLower")}</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">{t("datahub.testDescriptionOptional")}</label>
                    <textarea
                      className="w-full rounded-lg border border-line bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:bg-white focus:border-accent/50 resize-none"
                      rows={3}
                      value={editFields.description}
                      onChange={e => setEditFields(c => ({ ...c, description: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-2">{t("datahub.mediaOptional")}</label>
                    <div className="flex gap-3">
                      <label className="flex-1 cursor-pointer">
                        <div className="flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50 py-3 hover:bg-zinc-100 transition text-zinc-500 text-sm font-medium">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          {t("datahub.image")}
                        </div>
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleEditMedia(e, "image")} />
                      </label>
                      <label className="flex-1 cursor-pointer">
                        <div className="flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50 py-3 hover:bg-zinc-100 transition text-zinc-500 text-sm font-medium">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          {t("datahub.video")}
                        </div>
                        <input type="file" accept="video/*" className="hidden" onChange={e => handleEditMedia(e, "video")} />
                      </label>
                    </div>
                    {editFields.mediaUrl && (
                      <div className="mt-3 rounded-xl border border-line bg-zinc-50 p-3 relative group">
                        <button type="button" onClick={() => setEditFields(c => ({ ...c, mediaUrl: "", mediaType: undefined }))} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"><X className="h-3 w-3" /></button>
                        {editFields.mediaType === "image" ? (
                          <img src={editFields.mediaUrl} alt="preview" className="max-h-56 w-full rounded-lg object-contain" />
                        ) : (
                          <video src={editFields.mediaUrl} className="max-h-56 w-full rounded-lg bg-black object-contain" controls />
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-zinc-50 px-3 py-2.5">
                      <p className="text-xs text-zinc-500 mb-0.5">{t("datahub.metricUnit")}</p>
                      <p className="font-medium text-zinc-900">{selectedTestDef.unit}</p>
                    </div>
                    <div className="rounded-xl bg-zinc-50 px-3 py-2.5">
                      <p className="text-xs text-zinc-500 mb-0.5">{t("datahub.attemptsCount")}</p>
                      <p className="font-medium text-zinc-900">{selectedTestDef.attempts}</p>
                    </div>
                    <div className="rounded-xl bg-zinc-50 px-3 py-2.5">
                      <p className="text-xs text-zinc-500 mb-0.5">{t("datahub.metricGoal")}</p>
                      <p className="font-medium text-zinc-900">{selectedTestDef.scoringStrategy === "average" ? t("datahub.calcAverage") : t("datahub.calcBest")}</p>
                    </div>
                    <div className="rounded-xl bg-zinc-50 px-3 py-2.5">
                      <p className="text-xs text-zinc-500 mb-0.5">{t("datahub.metricInterpretation")}</p>
                      <p className="font-medium text-zinc-900">{selectedTestDef.interpretation === "lower_better" ? t("datahub.interpretLower") : t("datahub.interpretHigher")}</p>
                    </div>
                    <div className="col-span-2 rounded-xl bg-zinc-50 px-3 py-2.5">
                      <p className="text-xs text-zinc-500 mb-0.5">{t("datahub.resultType")}</p>
                      <p className="font-medium text-zinc-900">{selectedTestDef.isRating ? t("datahub.resultRating") : t("datahub.resultNumeric")}</p>
                    </div>
                  </div>
                  {(selectedTestDef.descriptionKey || selectedTestDef.description) && (
                    <p className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-zinc-600 leading-relaxed">
                      {selectedTestDef.descriptionKey ? t(selectedTestDef.descriptionKey) : selectedTestDef.description}
                    </p>
                  )}
                  {selectedTestDef.mediaUrl && (
                    <div className="rounded-xl overflow-hidden border border-line bg-zinc-50">
                      {selectedTestDef.mediaType === "image" ? (
                        <img src={selectedTestDef.mediaUrl} alt="preview" className="max-h-[52vh] w-full object-contain" />
                      ) : (
                        <video src={selectedTestDef.mediaUrl} className="max-h-[52vh] w-full bg-black object-contain" controls />
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Footer actions */}
              <div className="flex items-center gap-3 pt-4 border-t border-line">
                {editMode ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditMode(false)}
                      className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition"
                    >
                      {t("datahub.cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={saveEdit}
                      className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-slate-950 hover:bg-accent-strong transition shadow-md shadow-accent/20"
                    >
                      {t("datahub.save")}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => { delDef(selectedTestDef.id); closeDetail(); }}
                      className="flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                      {t("datahub.delete")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditMode(true)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-slate-950 hover:bg-accent-strong transition shadow-md shadow-accent/20"
                    >
                      <Edit2 className="h-4 w-4" />
                      {t("datahub.edit")}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* Add test — centred overlay, same style as Modal */}
      {showAddTestForm && typeof document !== "undefined" && createPortal((
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200"
          onClick={() => setShowAddTestForm(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between shrink-0">
              <h3 className="text-xl font-bold text-zinc-900">{t("datahub.addMetricTitle")}</h3>
              <button
                type="button"
                onClick={() => setShowAddTestForm(false)}
                className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={addDef} className="overflow-y-auto pr-1 -mr-1 space-y-4">
              <FormErrorBanner summary={testDefSummary} fieldErrors={testDefErrors} t={t} />
              {/* Preset Selector */}
              <div className="rounded-xl border-2 border-accent/20 bg-accent/5 p-4">
                <label className="block text-xs font-bold text-accent mb-2 uppercase tracking-tight">{t("datahub.usePreset") || "Usar test predefinido"}</label>
                <select
                  className="w-full rounded-lg border border-accent/30 bg-white px-3 py-2.5 text-sm text-zinc-700 outline-none focus:ring-2 focus:ring-accent/10 font-sans"
                  onChange={(e) => {
                    const preset = performancePresets[testBatteryArea].find(p => p.name === e.target.value);
                    if (preset) {
                      setNewDef({
                        name: preset.name,
                        nameKey: preset.nameKey,
                        descriptionKey: preset.descriptionKey,
                        unit: preset.unit,
                        attempts: preset.scoringStrategy === "average" ? 3 : 1,
                        isRating: preset.isRating,
                        scoringStrategy: preset.scoringStrategy,
                        interpretation: preset.interpretation,
                        description: "",
                        mediaUrl: "",
                        mediaType: undefined,
                        subCategory: undefined,
                      });
                    }
                  }}
                  value=""
                >
                  <option value="" disabled>{t("datahub.selectPreset") || "-- Seleccionar test --"}</option>
                  {performancePresets[testBatteryArea].map(p => (
                    <option key={p.name} value={p.name}>{p.nameKey ? t(p.nameKey) : p.name}</option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-zinc-500 italic">
                  {t("datahub.presetHint") || "Selecciona un test común para rellenar los campos automáticamente."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium text-zinc-500">{t("datahub.metricName")}</label>
                  <input
                    className={clubInputClass(Boolean(testDefErrors.name), "bg-zinc-50 focus:bg-white")}
                    placeholder={t("datahub.exampleMetricNames")}
                    value={newDef.nameKey ? t(newDef.nameKey) : newDef.name}
                    onChange={e => {
                      setNewDef(c => ({ ...c, name: e.target.value, nameKey: undefined, descriptionKey: undefined }));
                      setTestDefErrors(prev => clearFieldError(prev, "name"));
                    }}
                  />
                  <FieldError message={testDefErrors.name} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-500">{t("datahub.metricUnit")}</label>
                  <input
                    className={clubInputClass(Boolean(testDefErrors.unit), "bg-zinc-50 focus:bg-white")}
                    placeholder={t("datahub.exampleMetricUnit")}
                    value={newDef.unit}
                    onChange={e => {
                      setNewDef(c => ({ ...c, unit: e.target.value }));
                      setTestDefErrors(prev => clearFieldError(prev, "unit"));
                    }}
                  />
                  <FieldError message={testDefErrors.unit} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-500">{t("datahub.attemptsCount")}</label>
                  <input
                    type="number" min={1}
                    className="w-full rounded-lg border border-line bg-zinc-50 px-3 py-2.5 text-sm outline-none focus:bg-white focus:border-accent/50 font-sans"
                    placeholder={t("datahub.exampleAttempts")}
                    value={newDef.attempts}
                    onChange={e => setNewDef(c => ({ ...c, attempts: Number(e.target.value) || 1 }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-500">{t("datahub.resultType")}</label>
                  <select
                    className="w-full rounded-lg border border-line bg-zinc-50 px-3 py-2.5 text-sm outline-none focus:bg-white focus:border-accent/50 font-sans"
                    value={newDef.isRating ? "rating" : "numeric"}
                    onChange={e => setNewDef(c => ({ ...c, isRating: e.target.value === "rating" }))}
                  >
                    <option value="numeric">{t("datahub.resultNumeric")}</option>
                    <option value="rating">{t("datahub.resultRating")}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-500">{t("datahub.metricGoal")}</label>
                  <select
                    className={cn("w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none font-sans transition", newDef.attempts === 1 ? "bg-zinc-100 opacity-50 cursor-not-allowed" : "bg-zinc-50 focus:bg-white focus:border-accent/50")}
                    value={newDef.scoringStrategy}
                    disabled={newDef.attempts === 1}
                    onChange={e => setNewDef(c => ({ ...c, scoringStrategy: e.target.value as "best" | "average" }))}
                  >
                    <option value="best">{t("datahub.calcBest")}</option>
                    <option value="average">{t("datahub.calcAverage")}</option>
                  </select>
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium text-zinc-500">{t("datahub.metricInterpretation")}</label>
                  <select
                    className="w-full rounded-lg border border-line bg-zinc-50 px-3 py-2.5 text-sm outline-none focus:bg-white focus:border-accent/50 font-sans"
                    value={newDef.interpretation}
                    onChange={e => setNewDef(c => ({ ...c, interpretation: e.target.value as "higher_better" | "lower_better" }))}
                  >
                    <option value="higher_better">{t("datahub.interpretHigher")}</option>
                    <option value="lower_better">{t("datahub.interpretLower")}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">{t("datahub.testDescriptionOptional")}</label>
                <textarea
                  className="w-full rounded-lg border border-line bg-zinc-50 px-3 py-2.5 text-sm outline-none focus:bg-white focus:border-accent/50 font-sans resize-none"
                  placeholder={t("datahub.exampleTestDescription")}
                  rows={3}
                  value={newDef.descriptionKey ? t(newDef.descriptionKey) : newDef.description}
                  onChange={e => setNewDef(c => ({ ...c, description: e.target.value, descriptionKey: undefined }))}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-500 mb-2 block">{t("datahub.mediaOptional")}</label>
                <div className="flex gap-3">
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50 py-4 hover:bg-zinc-100 transition text-zinc-500 text-sm font-medium">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      {t("datahub.image")}
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleMedia(e, "image")} />
                  </label>
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50 py-4 hover:bg-zinc-100 transition text-zinc-500 text-sm font-medium">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {t("datahub.video")}
                    </div>
                    <input type="file" accept="video/*" className="hidden" onChange={e => handleMedia(e, "video")} />
                  </label>
                </div>
                {newDef.mediaUrl && (
                  <div className="mt-3 rounded-xl border border-line bg-zinc-50 p-3 relative group">
                    <button type="button" onClick={() => setNewDef(c => ({ ...c, mediaUrl: "", mediaType: undefined }))} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"><X className="h-3 w-3" /></button>
                    <p className="text-xs text-zinc-500 mb-2 font-semibold uppercase tracking-wide">{t("datahub.selectedMedia")} — {newDef.mediaType}</p>
                    {newDef.mediaType === "image" ? (
                      <img src={newDef.mediaUrl} alt="preview" className="max-h-56 w-full rounded-lg object-contain" />
                    ) : (
                      <video src={newDef.mediaUrl} className="max-h-56 w-full rounded-lg bg-black object-contain" controls />
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { clearTestDefErrors(); setShowAddTestForm(false); }}
                  className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition"
                >
                  {t("datahub.cancel")}
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-slate-950 hover:bg-accent-strong transition shadow-md shadow-accent/20"
                >
                  {t("datahub.createMetric")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ), document.body)}
    </section>
  );
}