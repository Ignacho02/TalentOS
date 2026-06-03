"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, FileDown } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";

interface MethodInfo {
  id: string;
  name: string;
  year: number;
  formula?: string;
  description: string;
  accuracy: string;
  applicableTo: string[];
  advantages: string[];
  limitations: string[];
  references: Reference[];
  notes?: string;
}

interface Reference {
  title: string;
  authors: string;
  year: number;
  doi?: string;
  url?: string;
}

const methods: MethodInfo[] = [
  {
    id: "fransen",
    name: "Fransen (2018)",
    year: 2018,
    formula: "MR = 6.987 + 0.1158·AGE + 0.001451·AGE² + 0.004518·BM − 0.000034·BM² − 0.15195·H + 0.000933·H² − 0.00000166·H³ + 0.03220·LL − 0.000269·LL² − 0.000761·(H·AGE)  →  APHV = AGE / MR  →  Offset = AGE − APHV",
    description:
      "Introduces the Maturity Ratio (MR = CA / APHV) concept. A polynomial of 11 terms using age, body mass, total stature and leg length. Developed and validated in 1,330 male football academy players in Belgium. The model corrects the systematic bias Mirwald shows in extreme maturers (very early/late). Motor primario AUTO para chicos.",
    accuracy: "SEE ≈ 0.55–0.65 years; corrects Mirwald bias in early/late maturers",
    applicableTo: ["Boys 8-18 years — football/sport academy population"],
    advantages: [
      "Highest accuracy for males in sport academy context",
      "Corrects Mirwald bias in early/late maturers",
      "No DXA required — pure anthropometry (age, mass, height, leg length)",
      "Developed specifically for football population",
    ],
    limitations: [
      "Males only — paper is explicit: 'only refer to a male population'",
      "Validated in Belgian football academies; generalizability to other populations pending",
      "Less accurate at extremes of maturation (offset < −3 or > +3 years)",
    ],
    references: [
      {
        title:
          "Improving the Prediction of Maturity From Anthropometric Variables Using a Maturity Ratio",
        authors: "Fransen J, Bush S, Woodcock S, Novak A, Deprez D, Baxter-Jones ADG, Vaeyens R, Lenoir M",
        year: 2018,
        doi: "10.1123/pes.2017-0009",
      },
    ],
    notes: "Recommended first choice (AUTO) for sport maturation assessment in boys. Coeficientes verificados contra Table 2 del paper original. ✅",
  },

  {
    id: "sherar",
    name: "Mirwald (♀) — 2002",
    year: 2002,
    formula:
      "MO = −9.376 + 0.0001882·(LL·SH) + 0.0022·(AGE·LL) + 0.005841·(AGE·SH) − 0.002658·(AGE·BM) + 0.07693·((BM/H)·100)  →  APHV = AGE − MO",
    description:
      "Ecuación Eq. 4 de Mirwald et al. (2002) para chicas. Calcula el maturity offset (años hasta/desde el PHV) a partir de medidas antropométricas. El engine en código era llamado 'Sherar' por error bibliográfico: Sherar et al. (2005) describe un método de predicción de talla adulta que usa internamente esta ecuación de Mirwald, pero no publica una ecuación de offset propia. La atribución correcta es Mirwald (2002). Motor primario AUTO para chicas.",
    accuracy: "R² = 0.890, SEE = 0.569 años (Mirwald 2002); error se multiplica ×2–6 para offset < −3 o > +3 (Koziel & Malina 2018)",
    applicableTo: ["Girls 8-16 years (rango validado original)"],
    advantages: [
      "Único método de offset específico para chicas con amplia validación",
      "Solo requiere medidas antropométricas básicas",
      "Buena precisión en rango central (offset −2 a +2)",
    ],
    limitations: [
      "Chicas únicamente",
      "Precisión reducida en maduradores extremos (offset < −3 o > +3)",
      "Validado principalmente en población caucásica norteamericana",
      "Para chicas, el PAH% (Khamis-Roche) es más fiable que el offset como indicador",
    ],
    references: [
      {
        title:
          "An assessment of maturity from anthropometric measurements",
        authors: "Mirwald RL, Baxter-Jones ADG, Bailey DA, Beunen G",
        year: 2002,
        doi: "10.1097/00005768-200204000-00020",
      },
      {
        title: "Prediction of adult height using maturity-based cumulative height velocity curves (uses Mirwald Eq. 4 internally)",
        authors: "Sherar LB, Mirwald RL, Baxter-Jones ADG, Thomis M",
        year: 2005,
        doi: "10.1016/j.jpeds.2005.04.065",
      },
    ],
    notes:
      "Atribución corregida de 'Sherar' a 'Mirwald (♀)' — la ecuación es Mirwald et al. (2002) Eq. 4, p. 692. Para chicas, priorizar PAH% sobre offset (mayor fiabilidad según Koziel & Malina 2018).",
  },

  {
    id: "moore",
    name: "Moore (2015)",
    year: 2015,
    formula:
      "♂ Moore-1: MO = −8.128741 + 0.0070346·(AGE·SH)  |  ♂ Moore-2 (fallback, sin SH): MO = −7.999994 + 0.0036124·(AGE·H)  |  ♀: MO = −7.709133 + 0.0042232·(AGE·H)  →  APHV = AGE − MO",
    description:
      "Simplifica el modelo de Mirwald reduciendo la multicolinealidad a un único término de interacción. Aplica a ambos sexos con ecuaciones separadas. Para chicos ofrece dos variantes: Moore-1 (con altura sentado, más precisa) y Moore-2 (fallback automático cuando no hay altura sentado, usa estatura total). La app activa Moore-2 automáticamente si falta el dato de altura sentado.",
    accuracy: "MAD ~0.4–0.7 años; Moore-2 tiene ~0.1 años MAD adicional respecto a Moore-1 (Koziel & Malina 2018)",
    applicableTo: ["Boys and girls 8-18 years"],
    advantages: [
      "Applicable to both sexes",
      "Moore-2 funciona sin altura sentado (fallback robusto)",
      "Baja multicolinealidad — ecuación simple y estable",
      "Good performance across broader age ranges",
    ],
    limitations: [
      "Lower accuracy than sex-specific methods",
      "Moore-1 para chicas presenta sesgo sistemático positivo desde los 10 años",
      "Para chicas, ninguna ecuación de offset tiene ventana clara de precisión equivalente a chicos",
    ],
    references: [
      {
        title:
          "Enhancing a somatic maturity prediction model",
        authors: "Moore SA, McKay HA, Macdonald H, Nettlefold L, Baxter-Jones ADG, Cameron N, Brasher PMA",
        year: 2015,
        doi: "10.1249/MSS.0000000000000588",
      },
    ],
    notes: "Fallback de Fransen (♂) y motor principal (♀). Moore-2 activado automáticamente cuando falta altura sentado.",
  },

  {
    id: "mirwald",
    name: "Mirwald (2002)",
    year: 2002,
    formula:
      "♂: MO = −9.236 + 0.0002708·(LL·SH) − 0.001663·(AGE·LL) + 0.007216·(AGE·SH) + 0.02292·((BM/H)·100)  |  ♀: ver 'Mirwald (♀)' arriba  →  APHV = AGE − MO",
    description:
      "Primer método en estimar el maturity offset (años hasta/desde el PHV) a partir exclusivamente de medidas antropométricas, sin edad ósea. Desarrollado sobre datos longitudinales de tres estudios canadienses (SGDS, BMAS, LLTS). La app implementa las ecuaciones combinadas (Eq. 3 para chicos, Eq. 4 para chicas), recomendadas por el paper como más robustas. Motor de respaldo para ambos sexos.",
    accuracy: "R² = 0.891 (♂), 0.890 (♀); SEE = 0.592 años (♂), 0.569 años (♀)",
    applicableTo: ["Boys and girls 8-16 years (rango validado original)"],
    advantages: [
      "Aplicable a ambos sexos con ecuaciones separadas",
      "Extensamente validado y citado en literatura científica",
      "Requiere solo medidas básicas (edad, estatura, altura sentado, masa)",
      "Concepto de offset intuitivo (negativo = antes del PHV, positivo = después)",
    ],
    limitations: [
      "Error se multiplica ×2–6 para offset < −3 o > +3 años (Koziel & Malina 2018)",
      "Alta correlación offset-edad cronológica (r ≈ 0.92–0.97)",
      "Validado principalmente en población caucásica norteamericana",
    ],
    references: [
      {
        title:
          "An assessment of maturity from anthropometric measurements",
        authors: "Mirwald RL, Baxter-Jones ADG, Bailey DA, Beunen G",
        year: 2002,
        doi: "10.1097/00005768-200204000-00020",
      },
    ],
    notes: "Motor de respaldo. Coeficientes verificados contra el paper original. ✅",
  },

  {
    id: "khamis-roche",
    name: "Khamis-Roche (1994)",
    year: 1994,
    formula:
      "Predicted Adult Height = 1.27(present height) + 0.54(mid-parent height) − 14.4 for females; similar for males with different coefficients",
    description:
      "Uses current height, parental height, and sex to predict adult height (final stature). Not a maturation method per se, but provides essential context for maturation interpretation. Estimates growth remaining.",
    accuracy: "±3-5 cm at 95% confidence interval for adult height prediction",
    applicableTo: ["Boys and girls", "Any age with parental height available"],
    advantages: [
      "Requires only height measurements (no special equipment)",
      "Parental height is powerful predictor",
      "Applicable across wide age range",
      "Useful for comparing current PAH (% Adult Height) context",
    ],
    limitations: [
      "Prediction range is ±3-5 cm (relatively wide)",
      "Requires accurate parental heights (often unavailable or inaccurate)",
      "Does not account for individual genetic variation precisely",
      "Not a maturation indicator itself",
    ],
    references: [
      {
        title: "Predicting adult stature without using skeletal age",
        authors: "Khamis HJ, Roche AF",
        year: 1994,
        doi: "10.1542/peds.94.4.504",
      },
    ],
    notes:
      "Essential for calculating % Adult Height (PAH). Provides context for growth potential interpretation.",
  },

  {
    id: "who-bmi",
    name: "WHO BMI Z-Score (2007)",
    year: 2007,
    formula:
      "BMI Z-Score = (BMI − reference BMI for age/sex) / SD of reference BMI, using WHO Child Growth Standards",
    description:
      "Uses Body Mass Index standardized against WHO reference population by age and sex (ages 5-19). Produces standardized deviation score (Z-score) indicating nutritional status relative to healthy reference population.",
    accuracy: "Classification into ±1 SD, ±2 SD bands from mean",
    applicableTo: ["Boys and girls 5-19 years", "Nutritional status assessment"],
    advantages: [
      "Internationally standardized reference (WHO)",
      "Simple calculation from height and mass",
      "Identifies malnutrition risk (Z < -2)",
      "Identifies overweight/obesity (Z > +1 or +2)",
      "Supplements maturation assessment with nutritional context",
    ],
    limitations: [
      "Not a maturation indicator (complementary to maturation methods)",
      "BMI does not distinguish fat from lean mass",
      "Population-level standards may not apply to athletic populations",
      "Does not indicate specific maturation phase",
    ],
    references: [
      {
        title: "WHO Child Growth Standards: Growth velocity based on weight, length and head circumference",
        authors: "World Health Organization",
        year: 2009,
        url: "https://www.who.int/tools/child-growth-standards",
      },
    ],
    notes:
      "Used alongside maturation methods to assess growth AND nutritional context. Not intended as maturation assessment tool.",
  },

  {
    id: "sitar",
    name: "SITAR (2010)",
    year: 2010,
    formula:
      "APHV_SITAR = 13.5 + b  |  PHV_SITAR = 10.1 × exp(−c)  |  PAH_SITAR = 179.5 + a  (parámetros de referencia: Monasterio et al. 2026, fútbol élite español)",
    description:
      "SuperImposition by Translation And Rotation. Modelo longitudinal individual que descompone la curva de crecimiento en tres parámetros: a (tamaño), b (timing), c (velocidad). Requiere mínimo 3 mediciones en el tiempo. Los parámetros de referencia han sido actualizados a valores de fútbol de élite español (Monasterio 2026): meanAphv=13.5, meanPhv=10.1, meanAdultHeight=179.5 — corrigiendo el sesgo de −1.08 cm/año del dataset Berkeley.",
    accuracy: "Clasifica correctamente ~80% pre/circa/post-PHV vs ~50–70% métodos de offset (Monasterio 2026)",
    applicableTo: [
      "Boys (parámetros de referencia validados en población masculina)",
      "Requiere ≥3 mediciones longitudinales en ≥6 meses",
    ],
    advantages: [
      "~80% de clasificación correcta pre/circa/post-PHV con datos desde U11",
      "Estima APHV, PHV y talla adulta (PAH) simultáneamente",
      "Modelado individual — no comparación con media poblacional",
      "Superior a métodos de offset cuando hay datos longitudinales",
    ],
    limitations: [
      "Requiere ≥3 mediciones distribuidas alrededor del PHV",
      "Con solo datos U13-U15: error típico ±0.6 años en APHV",
      "Optimización grid search + hill climbing (menos precisa que REML del paquete R sitar)",
      "No disponible en modo single-measurement",
    ],
    references: [
      {
        title:
          "SITAR — a useful instrument for growth curve analysis",
        authors: "Cole TJ, Donaldson MDC, Ben-Shlomo Y",
        year: 2010,
        doi: "10.1093/ije/dyq115",
      },
      {
        title: "Application of the SITAR model for estimating APHV, PHV, and adult height in elite male football players",
        authors: "Monasterio X et al.",
        year: 2026,
      },
    ],
    notes:
      "Parámetros actualizados a fútbol élite español (Monasterio 2026). Se activa automáticamente cuando hay ≥3 mediciones longitudinales. ✅",
  },
];

const MethodSection = ({ method }: { method: MethodInfo }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200 bg-white/50 backdrop-blur-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition"
      >
        <div className="flex-1 text-left">
          <h3 className="font-semibold text-slate-900">{method.name}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{method.description.substring(0, 100)}...</p>
        </div>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""} ml-4 flex-shrink-0`}
        />
      </button>

      {expanded && (
        <div className="border-t border-slate-200 px-4 py-4 space-y-4">
          {/* Description */}
          <div>
            <h4 className="font-semibold text-slate-900 text-sm mb-2">Description</h4>
            <p className="text-sm text-slate-700 leading-relaxed">{method.description}</p>
          </div>

          {/* Formula */}
          {method.formula && (
            <div>
              <h4 className="font-semibold text-slate-900 text-sm mb-2">Formula</h4>
              <div className="bg-slate-50 p-3 rounded border border-slate-200 font-mono text-xs text-slate-700 overflow-x-auto">
                {method.formula}
              </div>
            </div>
          )}

          {/* Accuracy */}
          <div>
            <h4 className="font-semibold text-slate-900 text-sm mb-2">Accuracy</h4>
            <p className="text-sm text-slate-700">{method.accuracy}</p>
          </div>

          {/* Applicability */}
          <div>
            <h4 className="font-semibold text-slate-900 text-sm mb-2">Applicable To</h4>
            <div className="flex flex-wrap gap-2">
              {method.applicableTo.map((item) => (
                <span key={item} className="px-2.5 py-1 bg-teal-100 text-teal-700 text-xs rounded-full font-medium">
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Advantages and Limitations */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-slate-900 text-sm mb-2 text-emerald-700">Advantages</h4>
              <ul className="space-y-1 text-xs text-slate-700">
                {method.advantages.map((adv, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>{adv}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 text-sm mb-2 text-red-700">Limitations</h4>
              <ul className="space-y-1 text-xs text-slate-700">
                {method.limitations.map((lim, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-red-600 font-bold">✗</span>
                    <span>{lim}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* References */}
          <div>
            <h4 className="font-semibold text-slate-900 text-sm mb-2">References</h4>
            <div className="space-y-2">
              {method.references.map((ref, i) => (
                <div key={i} className="text-xs p-2.5 bg-slate-50 rounded border border-slate-200">
                  <p className="font-medium text-slate-900">
                    {ref.title}
                  </p>
                  <p className="text-slate-600 text-xs mt-1">
                    {ref.authors} ({ref.year})
                  </p>
                  {(ref.doi || ref.url) && (
                    <a
                      href={ref.doi ? `https://doi.org/${ref.doi}` : ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 transition mt-1.5"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {ref.doi ? `DOI: ${ref.doi}` : "Visit"}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {method.notes && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded">
              <p className="text-xs text-amber-900">
                <strong>📌 Note:</strong> {method.notes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function CommunityPage() {
  const { t } = useLocale();

  return (
    <div className="space-y-8">
      <section className="fade-up space-y-3">
        <p className="eyebrow">{t("community.title")}</p>
        <h1 className="text-3xl font-semibold tracking-tight">Maturation Assessment Methods</h1>
      </section>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Quick Selection Guide */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h2 className="font-semibold text-slate-900 mb-2 text-blue-900">Quick Selection Guide</h2>
          <ul className="space-y-1.5 text-sm text-slate-700">
            <li>
              <strong>Chicos (8-18):</strong> AUTO usa <span className="font-medium">Fransen</span> como motor primario (mayor precisión en fútbol masculino)
            </li>
            <li>
              <strong>Chicas (8-18):</strong> AUTO usa <span className="font-medium">Mirwald (♀)</span> como motor primario; priorizar <span className="font-medium">PAH%</span> sobre offset (más fiable en chicas)
            </li>
            <li>
              <strong>Sin altura sentado (chicos):</strong> <span className="font-medium">Moore</span> activa automáticamente el fallback Moore-2 (usa estatura total)
            </li>
            <li>
              <strong>≥3 mediciones longitudinales:</strong> Considerar <span className="font-medium">SITAR</span> (~80% clasificación correcta vs ~50–70% con offset)
            </li>
            <li>
              <strong>Predicción de talla adulta:</strong> <span className="font-medium">Khamis-Roche</span> con tallas parentales (indicar si son autoreportadas)
            </li>
          </ul>
        </div>

        {/* Maturation Table Variables */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <h2 className="font-semibold text-slate-900 mb-3">Variable Definitions</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              { label: "Grupo", description: t("maturationMethods.groupDesc") },
              { label: "Offset", description: t("maturationMethods.offsetDesc") },
              { label: "APHV", description: t("maturationMethods.aphvDesc") },
              { label: "% PAH", description: t("maturationMethods.pahDesc") },
              { label: "SHR", description: t("maturationMethods.shrDesc") },
              { label: "WHO BMI Z", description: t("maturationMethods.whoBmiDesc") },
              { label: `${t("maturationMethods.growthVelocityLabel")} (${t("maturationMethods.growthVelocityUnit")})`, description: t("maturationMethods.growthVelocityDesc") },
            ].map((variable) => (
              <div key={variable.label} className="rounded-lg bg-white p-3 border border-slate-200">
                <p className="text-sm font-semibold text-slate-900">{variable.label}</p>
                <p className="text-sm text-slate-700 mt-1 leading-relaxed">{variable.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Consensus Explanation */}
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h2 className="font-semibold text-slate-900 mb-2 text-purple-900">Consenso (Ponderación Dinámica)</h2>
          <p className="text-sm text-slate-700 mb-3">
            Cuando hay múltiples métodos disponibles, el Consenso los combina con pesos científicamente fundamentados:
          </p>
          <div className="space-y-2 text-xs text-slate-700 font-mono bg-white p-2 rounded border border-purple-200">
            <p>
              <strong>Pesos base:</strong> Fransen / Mirwald(♀) (50%), Moore (30%), Mirwald (20%)
            </p>
            <p>
              <strong>Para chicos:</strong> Fransen (50%) + Moore (30%) + Mirwald (20%)
            </p>
            <p>
              <strong>Para chicas:</strong> Fransen excluido (no aplica) → Mirwald(♀) (50% → 62.5%), Moore (30% → 37.5%), Mirwald excluido
            </p>
            <p className="text-purple-900 font-semibold">
              Resultado: estimación de APHV más robusta al reducir el sesgo de cada método individual
            </p>
          </div>
        </div>

        {/* Scientific Documentation Download */}
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <h2 className="font-semibold text-slate-900 mb-1 text-emerald-900">📄 Documentación Científica Completa</h2>
          <p className="text-sm text-slate-700 mb-3">
            Guía técnica completa con fórmulas verificadas fórmula a fórmula contra los artículos originales,
            coeficientes exactos, precisión de cada método, limitaciones clínicas y referencias bibliográficas.
            Versión 2.0 — Mayo 2026.
          </p>
          <a
            href="/community/maturation-methods.md"
            download="maturation-methods.md"
            className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-700 text-white text-sm rounded hover:bg-emerald-800 transition-colors"
          >
            <FileDown size={15} /> Descargar maturation-methods.md
          </a>
          <p className="text-xs text-slate-500 mt-2">
            Incluye: Fransen, Mirwald(♂/♀), Moore (Moore-1 y Moore-2), Khamis-Roche, WHO BMI Z-Score, SITAR, Consenso, Bio-banding, Avisos clínicos, Glosario y Referencias.
          </p>
        </div>

        {/* Methods */}
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Method Details</h2>
          {methods.map((method) => (
            <MethodSection key={method.id} method={method} />
          ))}
        </div>

        {/* Key Concepts */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
          <h2 className="font-semibold text-slate-900">Key Concepts</h2>

          <div className="space-y-2 text-sm">
            <div>
              <p className="font-medium text-slate-900">APHV (Age at Peak Height Velocity)</p>
              <p className="text-slate-700">
                The estimated age when maximum linear growth occurs. Usually occurs between 10-14 years in girls and 12-16 years in boys.
              </p>
            </div>

            <div>
              <p className="font-medium text-slate-900">Maturity Offset</p>
              <p className="text-slate-700">
                Years away from PHV (positive = after peak, negative = before peak). Used to group athletes by maturity stage rather than chronological age.
              </p>
            </div>

            <div>
              <p className="font-medium text-slate-900">PAH (% Adult Height)</p>
              <p className="text-slate-700">
                Percentage of predicted adult height already achieved. Reflects growth remaining. Higher PAH = closer to final adult height.
              </p>
            </div>

            <div>
              <p className="font-medium text-slate-900">Bio-banding</p>
              <p className="text-slate-700">
                Grouping athletes by biological maturity rather than chronological age, creating more equitable competition and training groups.
              </p>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
          <p>
            <strong>⚠️ Important:</strong> These assessments are based on population-level equations. Individual variation
            is normal. Always interpret maturation status in context with qualitative observations and sport-specific requirements.
            For clinical concerns, refer to appropriate health professionals.
          </p>
        </div>
      </div>
    </div>
  );
}