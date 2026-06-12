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
  Timer,
  MapPin,
  Ruler,
  Zap,
  ChevronRight,
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
  gradient: string;
}> = [
  {
    href: "/datahub",
    key: "nav.datahub",
    bodyKey: "hub.modules.datahub",
    status: "live",
    icon: Database,
    gradient: "from-sky-500/15 to-blue-600/5",
  },
  {
    href: "/analysis",
    key: "nav.analysis",
    bodyKey: "hub.modules.analysis",
    status: "live",
    icon: BarChart3,
    gradient: "from-teal-500/15 to-emerald-600/5",
  },
  {
    href: "/community",
    key: "nav.community",
    bodyKey: "hub.modules.community",
    status: "beta",
    icon: Users,
    gradient: "from-violet-500/15 to-purple-600/5",
  },
  {
    href: "/research",
    key: "nav.research",
    bodyKey: "hub.modules.research",
    status: "coming_soon",
    icon: FlaskConical,
    gradient: "from-orange-500/10 to-amber-600/5",
  },
];

const statusConfig: Record<ModuleStatus, { dot: string; label: string; badge: string }> = {
  live:        { dot: "bg-emerald-400", label: "En vivo",   badge: "bg-emerald-50 text-emerald-700 border-emerald-200/60" },
  beta:        { dot: "bg-amber-400",   label: "Beta",      badge: "bg-amber-50 text-amber-700 border-amber-200/60" },
  coming_soon: { dot: "bg-zinc-300",    label: "Próximo",   badge: "bg-zinc-50 text-zinc-500 border-zinc-200/60" },
};

function daysAgo(isoDate: string): string {
  const diff = Math.floor(
    (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return "hoy";
  if (diff === 1) return "ayer";
  return `hace ${diff} días`;
}

export default function HubPage() {
  const { t } = useLocale();
  const { state, assessments } = useAppState();

  const { athletes, teams, records, gpsSessions, trainingLoadEntries, club } = state;

  const totalAthletes = athletes.length;
  const totalTeams = teams.length;

  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const recentRecords = records.filter(
    (r) => now - new Date(r.createdAt).getTime() < sevenDays
  );

  const recentGps = [...gpsSessions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const lastGpsDate =
    gpsSessions.length > 0
      ? [...gpsSessions].sort((a, b) => b.date.localeCompare(a.date))[0].date
      : null;

  const midPhvCount = assessments.filter(
    (a) => a.classification.maturityBand === "Mid-PHV"
  ).length;

  const recentLoad = trainingLoadEntries.filter(
    (e) => now - new Date(e.date).getTime() < sevenDays
  );
  const avgLoad =
    recentLoad.length > 0
      ? Math.round(recentLoad.reduce((s, e) => s + e.load, 0) / recentLoad.length)
      : null;

  const teamSummaries = teams.map((team) => {
    const teamAthletes = athletes.filter((a) => a.teamId === team.id);
    const teamRecords = records
      .filter((r) => teamAthletes.some((a) => a.id === r.athleteId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const lastEval = teamRecords[0]?.createdAt ?? null;
    return { team, count: teamAthletes.length, lastEval };
  });

  type FeedItem = { label: string; date: string; icon: ComponentType<{ className?: string }> };
  const feedItems: FeedItem[] = [
    ...recentRecords.slice(0, 3).map((r) => ({
      label: `Evaluación antropométrica — ${r.athleteName}`,
      date: r.createdAt,
      icon: Ruler,
    })),
    ...recentGps.slice(0, 2).map((g) => ({
      label: `Sesión GPS (${g.teamName ?? "equipo"}) — ${g.sessionType === "match" ? "partido" : "entrenamiento"}`,
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

  const kpiCards = [
    {
      label: "Jugadores",
      value: totalAthletes.toString(),
      detail: `${totalTeams} equipo${totalTeams !== 1 ? "s" : ""}`,
      icon: Users,
      color: "text-sky-500",
      bg: "bg-sky-500/10",
    },
    {
      label: "Alertas PHV",
      value: midPhvCount.toString(),
      detail: "Jugadores en Mid-PHV",
      icon: AlertTriangle,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
    },
    {
      label: "Evaluaciones",
      value: recentRecords.length.toString(),
      detail: "Últimos 7 días",
      icon: CalendarDays,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
    },
    {
      label: "Carga media",
      value: avgLoad !== null ? `${avgLoad}` : "—",
      detail: avgLoad !== null ? "UA · últimos 7 días" : "Sin datos",
      icon: TrendingUp,
      color: "text-violet-400",
      bg: "bg-violet-400/10",
    },
  ];

  return (
    <div className="space-y-6">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden rounded-3xl"
        style={{
          background: "linear-gradient(135deg, #0c243b 0%, #0f3460 45%, #115e59 100%)",
        }}
      >
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Glow blobs */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-teal-400/15 blur-3xl" />

        <div className="relative px-8 pt-10 pb-8">
          <div className="grid gap-10 xl:grid-cols-[1.5fr_1fr]">

            {/* Left: headline */}
            <div className="flex flex-col justify-between">
              <div>
                {/* Eyebrow */}
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,.8)]" />
                  <span className="text-xs font-medium tracking-widest text-white/60 uppercase">
                    {club.name}
                  </span>
                </div>

                <h1 className="max-w-xl text-[clamp(2rem,4vw,3.5rem)] font-semibold leading-[1.1] tracking-tight text-white">
                  El sistema operativo del talento deportivo.
                </h1>

                <p className="mt-4 max-w-lg text-base leading-relaxed text-white/60">
                  Centraliza la maduración, el rendimiento y la gestión del club
                  en una única plataforma inteligente.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/analysis"
                  className="group inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-white/90 hover:shadow-lg hover:shadow-black/20"
                >
                  Abrir análisis
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/datahub"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/8 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/15"
                >
                  Centro de datos
                </Link>
              </div>
            </div>

            {/* Right: KPI cards */}
            <div className="grid grid-cols-2 gap-3">
              {kpiCards.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/8 p-5 backdrop-blur-sm transition hover:bg-white/12"
                  >
                    <div className={cn("mb-3 inline-flex items-center justify-center rounded-xl p-2", item.bg)}>
                      <Icon className={cn("h-4 w-4", item.color)} />
                    </div>
                    <div className="text-3xl font-bold tabular-nums text-white">
                      {item.value}
                    </div>
                    <div className="mt-1 text-sm font-medium text-white/70">{item.label}</div>
                    <div className="mt-0.5 text-xs text-white/40">{item.detail}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── MÓDULOS ──────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">Áreas de trabajo</h2>
            <p className="mt-0.5 text-sm text-ink-soft">Acceso directo a los módulos principales.</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {modules.map((module, index) => {
            const Icon = module.icon;
            const sc = statusConfig[module.status];
            const isDisabled = module.status === "coming_soon";
            return (
              <Link
                key={module.href}
                href={module.href}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border border-line bg-white p-6 transition",
                  isDisabled
                    ? "pointer-events-none opacity-60"
                    : "hover:-translate-y-0.5 hover:border-zinc-200 hover:shadow-md hover:shadow-zinc-100"
                )}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                {/* Gradient blush */}
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 transition group-hover:opacity-100", module.gradient)} />

                <div className="relative">
                  <div className="mb-5 flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/8 text-accent ring-1 ring-accent/10">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", sc.badge)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
                      {sc.label}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-zinc-900">{t(module.key)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft line-clamp-2">{t(module.bodyKey)}</p>

                  <div className="mt-5 flex items-center gap-1.5 text-sm font-medium text-accent opacity-0 transition group-hover:opacity-100">
                    Abrir
                    <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── RESUMEN POR EQUIPO ───────────────────────────────────────────── */}
      {teamSummaries.length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-zinc-900">Resumen deportivo</h2>
            <p className="mt-0.5 text-sm text-ink-soft">Estado actual de los equipos del club.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {teamSummaries.map(({ team, count, lastEval }) => (
              <div
                key={team.id}
                className="rounded-2xl border border-line bg-white p-5 transition hover:border-zinc-200 hover:shadow-sm"
              >
                <div className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{team.name}</div>
                <div className="mt-3 text-4xl font-bold tabular-nums text-zinc-900">{count}</div>
                <div className="text-sm text-ink-soft">jugador{count !== 1 ? "es" : ""}</div>
                <div className="mt-4 border-t border-line pt-3 text-xs text-ink-soft">
                  {lastEval ? `Última eval. ${daysAgo(lastEval)}` : "Sin evaluaciones"}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── ESTADO + ACTIVIDAD ───────────────────────────────────────────── */}
      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">

        {/* Maduración */}
        <div className="rounded-2xl border border-line bg-white p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Estado de maduración</h2>
              <p className="mt-0.5 text-sm text-ink-soft">Distribución de bandas biológicas.</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/8 text-accent">
              <Activity className="h-4 w-4" />
            </div>
          </div>

          {assessments.length === 0 ? (
            <p className="text-sm text-ink-soft">No hay evaluaciones calculadas aún.</p>
          ) : (
            <div className="space-y-4">
              {(
                [
                  { band: "Pre-PHV",  color: "bg-sky-400",   track: "bg-sky-50" },
                  { band: "Mid-PHV",  color: "bg-amber-400", track: "bg-amber-50" },
                  { band: "Post-PHV", color: "bg-emerald-500", track: "bg-emerald-50" },
                ] as const
              ).map(({ band, color, track }) => {
                const n = assessments.filter(
                  (a) => a.classification.maturityBand === band
                ).length;
                const pct = assessments.length > 0 ? Math.round((n / assessments.length) * 100) : 0;
                return (
                  <div key={band}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium text-zinc-700">{band}</span>
                      <span className="tabular-nums text-ink-soft">{n} <span className="text-xs">({pct}%)</span></span>
                    </div>
                    <div className={cn("h-2 overflow-hidden rounded-full", track)}>
                      <div
                        className={cn("h-full rounded-full transition-all duration-700", color)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {lastGpsDate && (
                <div className="mt-2 border-t border-line pt-3 text-xs text-ink-soft">
                  Última sesión GPS:{" "}
                  <span className="font-medium text-zinc-700">{daysAgo(lastGpsDate)}</span>
                  {" "}· {gpsSessions.length} sesión{gpsSessions.length !== 1 ? "es" : ""} totales
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actividad reciente */}
        <div className="rounded-2xl border border-line bg-white p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Actividad reciente</h2>
              <p className="mt-0.5 text-sm text-ink-soft">Últimas 7 días.</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/8 text-accent">
              <Zap className="h-4 w-4" />
            </div>
          </div>

          <div className="space-y-3">
            {feedItems.length === 0 ? (
              <p className="text-sm text-ink-soft">Sin actividad registrada en los últimos 7 días.</p>
            ) : (
              feedItems.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="flex gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/8 text-accent">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-zinc-700">{item.label}</p>
                      <p className="text-xs text-ink-soft/70">{daysAgo(item.date)}</p>
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