"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Dumbbell,
  Edit2,
  Plus,
  Trash2,
  Trophy,
  X,
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
import type {
  PerformanceArea,
  PerformanceDefinition,
  PerformanceEntry,
  PerformanceEntryInput,
  TrainingLoadEntry,
} from "@/lib/types";
import { performanceAreaLabels } from "./performance-constants";

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
              : "Entrenamiento";

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
