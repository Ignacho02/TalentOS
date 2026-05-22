"use client";

import { useLocale } from "@/lib/i18n/locale-context";
import { BookOpen, GraduationCap, Link as LinkIcon, Microscope, BookMarked, Calculator, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ResearchPage() {
  const { t } = useLocale();

  const methods = [
    {
      title: "Khamis-Roche (1994)",
      description: "Predicción de la talla adulta (PAH) utilizando estatura, peso y talla promedio de los padres. Considerado el estándar de oro no invasivo.",
      type: "Predicción Talla Adulta",
      icon: <Calculator className="h-5 w-5 text-indigo-500" />
    },
    {
      title: "Mirwald et al. (2002)",
      description: "Ecuaciones de regresión para calcular el maturity offset (años desde/hacia el pico de velocidad de crecimiento) basadas en medidas antropométricas y longitud de piernas.",
      type: "Maturity Offset",
      icon: <Microscope className="h-5 w-5 text-emerald-500" />
    },
    {
      title: "Sherar et al. (2005)",
      description: "Validación y ajustes de ecuaciones de maduración, enfocadas en las diferencias por sexo y el uso de curvas acumulativas de velocidad de altura.",
      type: "Maturity Offset / PAH",
      icon: <Microscope className="h-5 w-5 text-emerald-500" />
    },
    {
      title: "Moore et al. (2015)",
      description: "Predicción de la edad del pico de velocidad de crecimiento utilizando fórmulas simplificadas que no requieren longitud de piernas.",
      type: "Maturity Offset",
      icon: <Microscope className="h-5 w-5 text-emerald-500" />
    },
    {
      title: "Fransen et al. (2018)",
      description: "Proporción predictiva optimizada para poblaciones masculinas atléticas, mejorando la precisión del maturity offset.",
      type: "Maturity Offset",
      icon: <Microscope className="h-5 w-5 text-emerald-500" />
    },
    {
      title: "Kozieł & Malina (2018)",
      description: "Evaluación y ajuste de las ecuaciones de maturity offset para reducir los sesgos en maduradores tempranos y tardíos.",
      type: "Ajuste Metodológico",
      icon: <Calculator className="h-5 w-5 text-indigo-500" />
    },
    {
      title: "Modelo SITAR",
      description: "SuperImposition by Translation and Rotation. Modelo longitudinal que ajusta las curvas individuales (tamaño, tiempo y velocidad) a una curva normativa de futbolistas de élite.",
      type: "Modelo Longitudinal",
      icon: <BookOpen className="h-5 w-5 text-rose-500" />
    },
    {
      title: "Z-Score IMC (OMS)",
      description: "Estandarización del Índice de Masa Corporal (IMC) según las tablas de crecimiento de la Organización Mundial de la Salud (2007) para niños y adolescentes.",
      type: "Composición Corporal",
      icon: <Calculator className="h-5 w-5 text-indigo-500" />
    }
  ];

  const bibliography = [
    "Khamis, H. J., & Roche, A. F. (1994). Predicting adult stature without using skeletal age: the Khamis-Roche method. Pediatrics, 94(4), 504-507.",
    "Mirwald, R. L., Baxter-Jones, A. D., Bailey, D. A., & Beunen, G. P. (2002). An assessment of maturity from anthropometric measurements. Medicine and science in sports and exercise, 34(4), 689-694.",
    "Sherar, L. B., Mirwald, R. L., Baxter-Jones, A. D., & Thomis, M. (2005). Prediction of adult height using maturity-based cumulative height velocity curves. The Journal of pediatrics, 147(4), 508-514.",
    "Moore, S. A., McKay, H. A., Macdonald, H., Nettlefold, L., Baxter-Jones, A. D., Cameron, N., & Brasher, P. M. (2015). Enhancing a somatic maturity prediction model. Medicine and science in sports and exercise, 47(8), 1755-1764.",
    "Fransen, J., Bush, S., Woodcock, S., Novak, A., Huysmans, Z., Johnson, W., ... & Vaeyens, R. (2018). Improving the prediction of maturity from anthropometric variables using a ratio method. Pediatric Exercise Science, 30(2), 296-307.",
    "Kozieł, S. M., & Malina, R. M. (2018). Modified maturity offset prediction equations: validation in independent longitudinal samples of boys and girls. Sports Medicine, 48(1), 221-232.",
    "Cole, T. J., Donaldson, M. D., & Ben-Shlomo, Y. (2010). SITAR—a useful instrument for growth curve analysis. International journal of epidemiology, 39(6), 1558-1566.",
    "World Health Organization. (2007). Growth reference data for 5-19 years."
  ];

  return (
    <div className="space-y-12 pb-12 fade-up">
      <section className="space-y-4">
        <div className="flex items-center gap-3 text-indigo-500 mb-2">
          <Microscope className="h-6 w-6" />
          <p className="font-semibold uppercase tracking-wider text-sm">Maduration Engine</p>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
          Metodología Científica
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
          Nuestros algoritmos integran las ecuaciones antropométricas más robustas y validadas por la literatura científica para monitorizar el crecimiento, calcular el pico de velocidad de crecimiento y predecir la talla adulta.
        </p>
      </section>

      {/* Community Banner */}
      <Card className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-0 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <GraduationCap className="w-48 h-48" />
        </div>
        <CardContent className="p-8 sm:p-10 relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <GraduationCap className="h-6 w-6" />
              Aprende más en la Comunidad
            </h2>
            <p className="text-indigo-100 text-lg">
              Descubre cursos, formaciones detalladas y actualizaciones sobre cómo interpretar y aplicar estos modelos matemáticos en tu día a día con deportistas.
            </p>
          </div>
          <Button asChild size="lg" variant="secondary" className="whitespace-nowrap font-semibold">
            <Link href="/community">
              Ir a Comunidad <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <Calculator className="h-6 w-6 text-slate-400" />
          Modelos Implementados
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {methods.map((method, idx) => (
            <Card key={idx} className="border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    {method.icon}
                  </div>
                  <span className="text-xs font-medium px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full">
                    {method.type}
                  </span>
                </div>
                <CardTitle className="text-xl mt-4">{method.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
                  {method.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <BookMarked className="h-6 w-6 text-slate-400" />
          Referencias Bibliográficas
        </h2>
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="p-6 sm:p-8">
            <ul className="space-y-5">
              {bibliography.map((ref, idx) => (
                <li key={idx} className="flex gap-4 items-start group">
                  <div className="mt-1 h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-medium text-slate-500 shrink-0">
                    {idx + 1}
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">
                    {ref}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
