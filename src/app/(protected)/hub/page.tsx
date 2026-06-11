"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Database,
  FlaskConical,
  TrendingUp,
  Users,
  Zap,
  Timer,
  MapPin,
  Ruler,
} from "lucide-react";

import { useLocale } from "@/lib/i18n/locale-context";
import { useAppState } from "@/lib/store/app-state";
import type { ModuleStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Module definitions ───────────────────────────────────────────────────────

const modules: Array<{
  href: string;
  key: string;
  bodyKey: string;
  status: ModuleStatus;
  icon: ComponentType<{ className?: string }>;
}> = [
  {
    href: "/datahub",
    key: "nav.datahub",
    bodyKey: "hub.modules.datahub",
    status: "live",
    icon: Database,
  },
  {
    href: "/analysis",
    key: "nav.analysis",
    bodyKey: "hub.modules.analysis",
    status: "live",
    icon: BarChart3,
  },
  {
    href: "/community",
    key: "nav.community",
    bodyKey: "hub.modules.community",
    status: "beta",
    icon: Users,
  },
  {
    href: "/research",
    key: "nav.research",
    bodyKey: "hub.modules.research",
    status: "coming_soon",
    icon: FlaskConical,
  },
];

const statusColor: Record<ModuleStatus, string> = {
  live: "bg-accent",
  beta: "bg-warning",
  coming_soon: "bg-zinc-400",
};

// ─── Helper: format date as relative "hace X días" ────────────────────────────

function daysAgo(isoDate: string): string {
  const diff = Math.floor(
    (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return "hoy";
  if (diff === 1) return "ayer";
  return `hace ${diff} días`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HubPage() {
  const { t } = useLocale();
  const { state, assessments } = useAppState();

  const { athletes, teams, records, gpsSessions, trainingLoadEntries, club } =
    state;

  // ── KPI calculations ────────────────────────────────────────────────────────

  const totalAthletes = athletes.length;
  const totalTeams = teams.length;

  // Registros antropométricos: los 7 días más recientes
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const recentRecords = records.filter(
    (r) => now - new Date(r.createdAt).getTime() < sevenDays
  );

  // Sesiones GPS más recientes
  const recentGps = [...gpsSessions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const lastGpsDate =
    gpsSessions.length > 0
      ? [...gpsSessions].sort((a, b) => b.date.localeCompare(a.date))[0].date
      : null;

  // Alertas de maduración: jugadores en zona Mid-PHV o sin datos recientes
  const midPhvCount = assessments.filter(
    (a) => a.classification.maturityBand === "Mid-PHV"
  ).length;

  // Carga media de los últimos 7 días (training load)
  const recentLoad = trainingLoadEntries.filter(
    (e) => now - new Date(e.date).getTime() < sevenDays
  );
  const avgLoad =
    recentLoad.length > 0
      ? Math.round(
          recentLoad.reduce((s, e) => s + e.load, 0) / recentLoad.length
        )
      : null;

  // Resumen por equipo (jugadores + última evaluación)
  const teamSummaries = teams.map((team) => {
    const teamAthletes = athletes.filter((a) => a.teamId === team.id);
    const teamRecords = records
      .filter((r) =>
        teamAthletes.some((a) => a.id === r.athleteId)
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const lastEval = teamRecords[0]?.createdAt ?? null;
    return { team, count: teamAthletes.length, lastEval };
  });

  // Feed de actividad reciente: mezcla de registros, GPS y cargas
  type FeedItem = { label: string; date: string; icon: ComponentType<{ className?: string }> };
  const feedItems: FeedItem[] = [
    ...recentRecords.slice(0, 3).map((r) => ({
      label: `Evaluación antropométrica — ${r.athleteName}`,
      date: r.createdAt,
      icon: Ruler,
    })),
    ...recentGps.slice(0, 2).map((g) => ({
      label: `Sesión GPS importada (${g.teamName ?? "equipo"}) — ${g.sessionType === "match" ? "partido" : "entrenamiento"}`,
      date: g.date,
      icon: MapPin,
    })),
    ...recentLoad.slice(0, 2).map((e) => ({
      label: `Carga registrada — RPE ${e.rpe}, ${e.minutesPlayed} min`,
      date: e.date,
      icon: Timer,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  // ── Metric cards ─────────────────────────────────────────────────────────────

  const executiveMetrics = [
    {
      title: "Jugadores",
      value: totalAthletes.toString(),
      detail: `${totalTeams} equipo${totalTeams !== 1 ? "s" : ""}`,
      icon: Users,
    },
    {
      title: "Alertas PHV",
      value: midPhvCount.toString(),
      detail: "Jugadores en Mid-PHV",
      icon: AlertTriangle,
    },
    {
      title: "Evaluaciones",
      value: recentRecords.length.toString(),
      detail: "Últimos 7 días",
      icon: Activity,
    },
    {
      title: avgLoad !== null ? `${avgLoad} UA` : "—",
      detail: avgLoad !== null ? "Carga media semanal" : "Sin datos de carga",
      icon: TrendingUp,
      title2: "Carga media",
    },
  ] as Array<{
    title: string;
    title2?: string;
    value?: string;
    detail: string;
    icon: ComponentType<{ className?: string }>;
  }>;

  // Normalize metric cards so they all have a display value
  const kpiCards = [
    {
      label: "Jugadores",
      value: totalAthletes.toString(),
      detail: `${totalTeams} equipo${totalTeams !== 1 ? "s" : ""}`,
      icon: Users,
    },
    {
      label: "Alertas PHV",
      value: midPhvCount.toString(),
      detail: "Jugadores en Mid-PHV",
      icon: AlertTriangle,
    },
    {
      label: "Evaluaciones",
      value: recentRecords.length.toString(),
      detail: "Últimos 7 días",
      icon: CalendarDays,
    },
    {
      label: "Carga media",
      value: avgLoad !== null ? `${avgLoad}` : "—",
      detail: avgLoad !== null ? "UA · últimos 7 días" : "Sin datos",
      icon: TrendingUp,
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* HERO */}
      <section className="overflow-hidden rounded-[2rem] border border-line bg-[linear-gradient(135deg,rgba(12,36,59,1),rgba(17,94,89,.92))] p-8 text-white">
        <div className="grid gap-8 xl:grid-cols-[1.4fr_0.9fr]">
          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.35em] text-white/60">
              TalentOS · {club.name}
            </p>

            <h1 className="max-w-4xl text-4xl font-semibold leading-tight md:text-6xl">
              El sistema operativo del talento y el rendimiento deportivo.
            </h1>

            <p className="mt-5 max-w-2xl text-lg text-white/75">
              Centraliza la maduración, el análisis de rendimiento y la gestión
              deportiva del club en una única plataforma.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/analysis"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-900"
              >
                Abrir análisis
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/datahub"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
              >
                Centro de datos
              </Link>
            </div>
          </div>

          {/* KPI cards — datos reales */}
          <div className="grid grid-cols-2 gap-3">
            {kpiCards.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <Icon className="h-4 w-4 text-white/70" />
                    <span className="text-xs text-white/60">{item.detail}</span>
                  </div>
                  <div className="text-3xl font-semibold">{item.value}</div>
                  <div className="mt-1 text-sm text-white/70">{item.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* MÓDULOS */}
      <section>
        <div className="mb-5">
          <h2 className="text-2xl font-semibold">Áreas de trabajo</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Acceso rápido a los módulos principales de TalentOS.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {modules.map((module, index) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.href}
                href={module.href}
                className="group rounded-[1.8rem] border border-line bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/60 px-3 py-1 text-xs text-zinc-700">
                    <span
                      className={cn("status-dot", statusColor[module.status])}
                    />
                    {t(
                      `common.${
                        module.status === "coming_soon"
                          ? "comingSoon"
                          : module.status
                      }`
                    )}
                  </div>
                </div>

                <h3 className="text-xl font-semibold">{t(module.key)}</h3>

                <p className="mt-3 text-sm leading-6 text-ink-soft">
                  {t(module.bodyKey)}
                </p>

                <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-accent">
                  Abrir módulo
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* RESUMEN POR EQUIPO */}
      {teamSummaries.length > 0 && (
        <section>
          <div className="mb-5">
            <h2 className="text-2xl font-semibold">Resumen deportivo</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Estado actual de los equipos del club.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {teamSummaries.map(({ team, count, lastEval }) => (
              <div
                key={team.id}
                className="rounded-[1.8rem] border border-line bg-white p-6"
              >
                <div className="text-sm font-medium">{team.name}</div>

                <div className="mt-4 text-4xl font-semibold">{count}</div>
                <div className="text-sm text-ink-soft">
                  jugador{count !== 1 ? "es" : ""}
                </div>

                <div className="mt-5 border-t border-line pt-4 text-sm text-ink-soft">
                  {lastEval
                    ? `Última eval. ${daysAgo(lastEval)}`
                    : "Sin evaluaciones"}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ESTADO + ACTIVIDAD */}
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        {/* Maduración rápida */}
        <div className="rounded-[2rem] border border-line bg-white p-6">
          <h2 className="text-2xl font-semibold">Estado de maduración</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Distribución actual de bandas biológicas.
          </p>

          {assessments.length === 0 ? (
            <p className="mt-6 text-sm text-ink-soft">
              No hay evaluaciones calculadas aún.
            </p>
          ) : (
            <div className="mt-6 space-y-5">
              {(
                [
                  { band: "Pre-PHV", color: "bg-blue-400" },
                  { band: "Mid-PHV", color: "bg-amber-400" },
                  { band: "Post-PHV", color: "bg-green-500" },
                ] as const
              ).map(({ band, color }) => {
                const n = assessments.filter(
                  (a) => a.classification.maturityBand === band
                ).length;
                const pct =
                  assessments.length > 0
                    ? Math.round((n / assessments.length) * 100)
                    : 0;
                return (
                  <div key={band}>
                    <div className="mb-2 flex justify-between text-sm">
                      <span>{band}</span>
                      <span>
                        {n} ({pct}%)
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className={cn("h-full rounded-full", color)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {/* Sesiones GPS recientes */}
              {lastGpsDate && (
                <div className="mt-4 border-t border-line pt-4 text-sm text-ink-soft">
                  Última sesión GPS:{" "}
                  <span className="font-medium text-ink">
                    {daysAgo(lastGpsDate)}
                  </span>{" "}
                  · {gpsSessions.length} sesión
                  {gpsSessions.length !== 1 ? "es" : ""} totales
                </div>
              )}
            </div>
          )}
        </div>

        {/* Feed de actividad real */}
        <div className="rounded-[2rem] border border-line bg-white p-6">
          <h2 className="text-2xl font-semibold">Actividad reciente</h2>

          <div className="mt-6 space-y-4">
            {feedItems.length === 0 ? (
              <p className="text-sm text-ink-soft">
                Sin actividad registrada en los últimos 7 días.
              </p>
            ) : (
              feedItems.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div
                    key={i}
                    className="flex gap-3 border-b border-line pb-4 last:border-0"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <div>
                      <p className="text-sm leading-6 text-ink-soft">
                        {item.label}
                      </p>
                      <p className="text-xs text-ink-soft/60">
                        {daysAgo(item.date)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}