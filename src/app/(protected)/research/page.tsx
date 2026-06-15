"use client";

import { FlaskConical, Microscope, BarChart2, Dna, Lock } from "lucide-react";

export default function ResearchPage() {
  return (
    <div className="p-6 sm:p-8">
      <div className="relative overflow-hidden rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-violet-50 to-slate-50 p-10 text-center shadow-sm">
        {/* Decorative background icons */}
        <div className="absolute -top-6 -right-6 opacity-5 pointer-events-none">
          <Dna className="w-64 h-64 text-indigo-600" />
        </div>
        <div className="absolute -bottom-8 -left-8 opacity-5 pointer-events-none">
          <BarChart2 className="w-56 h-56 text-violet-600" />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-6 max-w-xl mx-auto">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white border border-indigo-100 shadow-md">
            <Lock className="h-9 w-9 text-indigo-400" />
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-slate-900">
              Área en desarrollo
            </h2>
            <p className="text-slate-500 leading-relaxed">
              El módulo I+D+I está actualmente en proceso de implementación. Pronto podrás diseñar y ejecutar estudios científicos propios —
              correlaciones, cohortes, modelos predictivos y más — utilizando directamente los datos de tus atletas.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mt-2">
            {[
              {
                icon: <Microscope className="h-5 w-5 text-indigo-500" />,
                title: "Estudios propios",
                desc: "Diseña protocolos de investigación con datos reales del club.",
              },
              {
                icon: <BarChart2 className="h-5 w-5 text-violet-500" />,
                title: "Análisis estadístico",
                desc: "Correlaciones, tendencias y modelos sobre maduración y rendimiento.",
              },
              {
                icon: <Dna className="h-5 w-5 text-emerald-500" />,
                title: "Ciencia aplicada",
                desc: "Publica o comparte hallazgos internamente con el cuerpo técnico.",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 p-4 bg-white/70 rounded-2xl border border-slate-200 text-left"
              >
                <div className="p-2 bg-slate-50 rounded-xl w-fit">{feature.icon}</div>
                <p className="font-semibold text-sm text-slate-800">{feature.title}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-600">
            <FlaskConical className="h-4 w-4" />
            Próximamente
          </span>
        </div>
      </div>
    </div>
  );
}