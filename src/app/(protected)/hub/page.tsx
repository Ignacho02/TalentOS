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
} from "lucide-react";

import { useLocale } from "@/lib/i18n/locale-context";
import type { ModuleStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

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

const executiveMetrics = [
  {
    title: "Jugadores evaluados",
    value: "186",
    detail: "+12 esta semana",
    icon: Activity,
  },
  {
    title: "Alertas activas",
    value: "7",
    detail: "2 prioritarias",
    icon: AlertTriangle,
  },
  {
    title: "Sesiones registradas",
    value: "24",
    detail: "Últimos 7 días",
    icon: CalendarDays,
  },
  {
    title: "Rendimiento medio",
    value: "82",
    detail: "+3 este mes",
    icon: TrendingUp,
  },
];

const actions = [
  {
    title: "Revisar jugadores en pico de crecimiento",
    text: "Dos perfiles muestran una aceleración significativa en su maduración biológica.",
  },
  {
    title: "Validar informes pendientes",
    text: "Hay cinco informes preparados para revisión técnica.",
  },
  {
    title: "Programar evaluaciones semanales",
    text: "Doce jugadores aún no tienen evaluación asignada.",
  },
];

const categories = [
  {
    name: "Sub-13",
    players: 32,
    score: 79,
  },
  {
    name: "Sub-15",
    players: 28,
    score: 83,
  },
  {
    name: "Sub-17",
    players: 25,
    score: 81,
  },
  {
    name: "Primer Equipo",
    players: 23,
    score: 88,
  },
];

const activityFeed = [
  "Informe de maduración completado para 14 jugadores.",
  "Nueva evaluación antropométrica registrada.",
  "Actualización de rendimiento del Sub-17 disponible.",
  "Sincronización de entrenamientos completada.",
  "Análisis comparativo generado para la academia.",
];

export default function HubPage() {
  const { t } = useLocale();

  return (
    <div className="space-y-8">
      {/* HERO */}

      <section className="overflow-hidden rounded-[2rem] border border-line bg-[linear-gradient(135deg,rgba(12,36,59,1),rgba(17,94,89,.92))] p-8 text-white">
        <div className="grid gap-8 xl:grid-cols-[1.4fr_0.9fr]">
          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.35em] text-white/60">
              TalentOS
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

          <div className="grid grid-cols-2 gap-3">
            {executiveMetrics.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <Icon className="h-4 w-4 text-white/70" />

                    <span className="text-xs text-white/60">
                      {item.detail}
                    </span>
                  </div>

                  <div className="text-3xl font-semibold">{item.value}</div>

                  <div className="mt-1 text-sm text-white/70">
                    {item.title}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* PRIORIDADES */}

      <section className="rounded-[2rem] border border-line bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">
              Acciones prioritarias
            </h2>

            <p className="mt-1 text-sm text-ink-soft">
              Elementos que requieren atención inmediata.
            </p>
          </div>

          <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            3 pendientes
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {actions.map((action) => (
            <div
              key={action.title}
              className="rounded-2xl border border-line p-5"
            >
              <div className="mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />

                <span className="text-xs font-medium uppercase tracking-wide text-amber-700">
                  Atención
                </span>
              </div>

              <h3 className="font-semibold">{action.title}</h3>

              <p className="mt-2 text-sm leading-6 text-ink-soft">
                {action.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* MÓDULOS */}

      <section>
        <div className="mb-5">
          <h2 className="text-2xl font-semibold">
            Áreas de trabajo
          </h2>

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
                      className={cn(
                        "status-dot",
                        statusColor[module.status]
                      )}
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

                <h3 className="text-xl font-semibold">
                  {t(module.key)}
                </h3>

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

      {/* CATEGORÍAS */}

      <section>
        <div className="mb-5">
          <h2 className="text-2xl font-semibold">
            Resumen deportivo
          </h2>

          <p className="mt-1 text-sm text-ink-soft">
            Estado actual de las categorías del club.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          {categories.map((team) => (
            <div
              key={team.name}
              className="rounded-[1.8rem] border border-line bg-white p-6"
            >
              <div className="text-sm text-ink-soft">{team.name}</div>

              <div className="mt-4 text-4xl font-semibold">
                {team.score}
              </div>

              <div className="text-sm text-ink-soft">
                Índice de rendimiento
              </div>

              <div className="mt-5 border-t border-line pt-4 text-sm text-ink-soft">
                {team.players} jugadores registrados
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* TENDENCIAS + ACTIVIDAD */}

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border border-line bg-white p-6">
          <h2 className="text-2xl font-semibold">
            Tendencias de la semana
          </h2>

          <div className="mt-6 space-y-5">
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span>Rendimiento global</span>
                <span>82%</span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full w-[82%] rounded-full bg-accent" />
              </div>
            </div>

            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span>Maduración registrada</span>
                <span>74%</span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full w-[74%] rounded-full bg-accent" />
              </div>
            </div>

            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span>Cobertura de evaluaciones</span>
                <span>91%</span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full w-[91%] rounded-full bg-accent" />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-line bg-white p-6">
          <h2 className="text-2xl font-semibold">
            Actividad reciente
          </h2>

          <div className="mt-6 space-y-4">
            {activityFeed.map((item) => (
              <div
                key={item}
                className="flex gap-3 border-b border-line pb-4 last:border-0"
              >
                <div className="mt-2 h-2 w-2 rounded-full bg-accent" />

                <p className="text-sm leading-6 text-ink-soft">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}