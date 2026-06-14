"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChevronDown, ExternalLink, FileDown, Users, BookOpen, GraduationCap } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";

/* ─────────────────────────────────────────────
   Tab panels
───────────────────────────────────────────── */
function NetworkTab({ t }: { t: (key: string) => string }) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Users className="h-8 w-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-700 mb-2">{t("community.tabNetwork")} — {t("community.networkComingSoon")}</h2>
        <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
          {t("community.networkComingSoonDesc")}
        </p>
      </div>
    </div>
  );
}

function DocumentationTab({ t }: { t: (key: string) => string }) {
  const SectionTitle = ({ id, children }: { id: string; children: React.ReactNode }) => (
    <h2 id={id} className="text-xl font-bold text-slate-900 pt-2 pb-1 border-b border-slate-200 scroll-mt-20">
      {children}
    </h2>
  );

  const SubTitle = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">{children}</h3>
  );

  const Formula = ({ children }: { children: React.ReactNode }) => (
    <div className="bg-slate-900 text-emerald-300 font-mono text-xs p-3 rounded-lg overflow-x-auto my-2 leading-relaxed whitespace-pre-wrap">
      {children}
    </div>
  );

  const Tag = ({ color, children }: { color: string; children: React.ReactNode }) => (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{children}</span>
  );

  const Ref = ({ doi, authors, year, title, url }: { doi?: string; url?: string; authors: string; year: number; title: string }) => (
    <div className="text-xs p-2.5 bg-slate-50 rounded border border-slate-200">
      <p className="font-medium text-slate-900">{title}</p>
      <p className="text-slate-500 mt-0.5">{authors} ({year})</p>
      {(doi || url) && (
        <a href={doi ? `https://doi.org/${doi}` : url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 mt-1">
          <ExternalLink className="h-3 w-3" /> {doi ? `DOI: ${doi}` : "Ver recurso"}
        </a>
      )}
    </div>
  );

  const Collapsible = ({ title, children }: { title: string; children: React.ReactNode }) => {
    const [open, setOpen] = useState(false);
    return (
      <div className="rounded-lg border border-slate-200 overflow-hidden bg-white/50">
        <button onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition">
          <span className="font-semibold text-slate-900 text-sm">{title}</span>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && <div className="border-t border-slate-200 px-4 py-4 space-y-4 bg-white">{children}</div>}
      </div>
    );
  };

  const sections = [
    { id: "variables",  label: "Variables" },
    { id: "methods",    label: "Métodos" },
    { id: "consensus",  label: "Consenso" },
    { id: "biobanding", label: "Bio-banding" },
    { id: "guide",      label: "Guía rápida" },
    { id: "download",   label: "Descarga" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-10">

      {/* TOC */}
      <nav className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl sticky top-0 z-10 backdrop-blur-sm">
        {sections.map(s => (
          <a key={s.id} href={`#${s.id}`}
            className="text-xs font-medium px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:border-teal-500 hover:text-teal-700 transition">
            {s.label}
          </a>
        ))}
      </nav>

      {/* ── 1. VARIABLES ── */}
      <section className="space-y-4">
        <SectionTitle id="variables">Variables madurativas</SectionTitle>
        <p className="text-sm text-slate-600 leading-relaxed">
          Cada registro de medición genera un conjunto de variables derivadas que permiten situar al deportista
          en su trayectoria de maduración. A continuación se describe qué mide cada una, cómo se interpreta
          y cuál es su utilidad clínica y deportiva.
        </p>

        <Collapsible title="Maturity Offset — Años hasta/desde el PHV">
          <p className="text-sm text-slate-700 leading-relaxed">
            El <strong>maturity offset</strong> expresa la distancia temporal en años entre la fecha de medición
            y el Pico de Velocidad de Altura (PHV). Un valor <strong>negativo</strong> indica que el deportista
            aún no ha alcanzado su PHV (pre-pico); un valor <strong>positivo</strong> indica que ya lo superó
            (post-pico). El valor <strong>0</strong> corresponde al momento exacto del pico.
          </p>
          <div className="grid grid-cols-3 gap-3 text-xs text-center">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <p className="font-bold text-blue-800 text-base mb-1">{"< −1"}</p>
              <p className="text-blue-700 font-medium">Pre-PHV</p>
              <p className="text-blue-500 mt-1">Crecimiento acelerado pendiente</p>
            </div>
            <div className="rounded-lg bg-teal-50 border border-teal-200 p-3">
              <p className="font-bold text-teal-800 text-base mb-1">−1 a +1</p>
              <p className="text-teal-700 font-medium">Circa-PHV</p>
              <p className="text-teal-500 mt-1">Ventana del pico de crecimiento</p>
            </div>
            <div className="rounded-lg bg-purple-50 border border-purple-200 p-3">
              <p className="font-bold text-purple-800 text-base mb-1">{">"} +1</p>
              <p className="text-purple-700 font-medium">Post-PHV</p>
              <p className="text-purple-500 mt-1">Desaceleración del crecimiento</p>
            </div>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
            <strong>⚠️ Limitación:</strong> El error del offset se multiplica ×2–6 cuando el valor es inferior
            a −3 o superior a +3 años (Koziel &amp; Malina, 2018). Para maduradores muy tempranos o tardíos,
            priorizar el % PAH como indicador complementario.
          </div>
        </Collapsible>

        <Collapsible title="APHV — Age at Peak Height Velocity (edad estimada del pico)">
          <p className="text-sm text-slate-700 leading-relaxed">
            La <strong>APHV</strong> es la edad cronológica estimada en la que el deportista alcanza su máximo
            crecimiento lineal. Se calcula como:
          </p>
          <Formula>{"APHV = Edad cronológica − Maturity Offset"}</Formula>
          <p className="text-sm text-slate-700 leading-relaxed">
            En <strong>chicos</strong>, el PHV suele ocurrir entre los 13 y 14.5 años; en <strong>chicas</strong>,
            entre los 11 y 12.5 años, con variabilidad inter-individual considerable. La APHV es clave para
            entender el potencial de crecimiento residual y para interpretar el riesgo de lesión: el período
            circa-PHV se asocia con mayor vulnerabilidad músculo-esquelética dado el desajuste temporal entre
            el crecimiento óseo y la adaptación del tejido blando.
          </p>
          <Ref
            title="An assessment of maturity from anthropometric measurements"
            authors="Mirwald RL, Baxter-Jones ADG, Bailey DA, Beunen G"
            year={2002}
            doi="10.1097/00005768-200204000-00020"
          />
        </Collapsible>

        <Collapsible title="% PAH — Porcentaje de Altura Adulta Predicha">
          <p className="text-sm text-slate-700 leading-relaxed">
            El <strong>% PAH</strong> indica qué proporción de su talla adulta predicha ha alcanzado ya el
            deportista. Se calcula sobre la predicción de Khamis-Roche:
          </p>
          <Formula>{"% PAH = (Estatura actual / Talla adulta predicha) × 100"}</Formula>
          <p className="text-sm text-slate-700 leading-relaxed">
            Un jugador con 92% PAH ha completado el 92% de su crecimiento potencial. El % PAH es especialmente
            útil en <strong>chicas</strong>, donde las ecuaciones de offset tienen mayor error, y como
            complemento al offset en maduradores extremos. Esta aplicación limita el valor máximo al
            <strong> 100%</strong>: valores superiores al 100% resultantes del modelo matemático se recortan,
            ya que indican que el deportista ha completado (o superado) su crecimiento predicho.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-200 rounded bg-white">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Banda (Armstrong &amp; Roberts)</th>
                  <th className="px-3 py-2 text-right font-semibold">% PAH</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr><td className="px-3 py-2 text-blue-700 font-medium">Pre-PHV</td><td className="px-3 py-2 text-right">{"< 88%"}</td></tr>
                <tr className="bg-slate-50/50"><td className="px-3 py-2 text-teal-700 font-medium">Circa temprano</td><td className="px-3 py-2 text-right">88–90%</td></tr>
                <tr><td className="px-3 py-2 text-teal-700 font-medium">Circa tardío</td><td className="px-3 py-2 text-right">90–96%</td></tr>
                <tr className="bg-slate-50/50"><td className="px-3 py-2 text-purple-700 font-medium">Post-PHV</td><td className="px-3 py-2 text-right">{"> 96%"}</td></tr>
              </tbody>
            </table>
          </div>
          <Ref
            title="Predicting adult stature without using skeletal age: The Khamis-Roche method"
            authors="Khamis HJ, Roche AF"
            year={1994}
            doi="10.1542/peds.94.4.504"
          />
        </Collapsible>

        <Collapsible title="SHR — Sitting Height Ratio (ratio altura sentado / estatura total)">
          <p className="text-sm text-slate-700 leading-relaxed">
            El <strong>SHR</strong> es el cociente adimensional entre la altura sentado y la estatura total:
          </p>
          <Formula>{"SHR = Altura sentado (cm) / Estatura total (cm)"}</Formula>
          <p className="text-sm text-slate-700 leading-relaxed">
            Oscila típicamente entre <strong>0.47 y 0.55</strong> en población adolescente. Refleja las
            proporciones corporales: un SHR alto indica tronco relativamente largo; un SHR bajo, predominancia
            de piernas. Durante la pubertad el patrón habitual es un descenso inicial del SHR (las piernas
            crecen primero en el estirón puberal), seguido de una recuperación cuando el tronco acelera. Este
            patrón puede usarse como indicador cualitativo de la fase madurativa. Las ecuaciones de Mirwald
            y Fransen usan el SHR y la altura sentado como predictores directos del offset.
          </p>
        </Collapsible>

        <Collapsible title="WHO BMI Z-Score — Puntuación Z del IMC según referencia OMS">
          <p className="text-sm text-slate-700 leading-relaxed">
            Estandariza el IMC del deportista respecto a la población de referencia OMS (5-19 años) por edad y sexo:
          </p>
          <Formula>{"IMC = Masa (kg) / Estatura² (m)\nZ = (IMC − Media_ref_edad_sexo) / SD_ref_edad_sexo"}</Formula>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1">
              <p className="font-semibold text-slate-800">Clasificación</p>
              <p>Z {"<"} −2 → Delgadez severa</p>
              <p>−2 a −1 → Delgadez</p>
              <p>−1 a +1 → Rango normal</p>
              <p>+1 a +2 → Sobrepeso</p>
              <p>Z {">"} +2 → Obesidad</p>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="font-semibold text-blue-800 mb-1">En contexto deportivo</p>
              <p className="text-blue-700">En élite, el IMC tiende a ser más elevado por mayor masa muscular. El Z-Score debe interpretarse como contexto nutricional complementario, no como indicador de rendimiento o madurez.</p>
            </div>
          </div>
          <Ref
            title="WHO Child Growth Standards: Methods and development"
            authors="World Health Organization"
            year={2007}
            url="https://www.who.int/tools/child-growth-standards"
          />
        </Collapsible>

        <Collapsible title="Vel. Crecimiento — Velocidad de crecimiento (cm/año)">
          <p className="text-sm text-slate-700 leading-relaxed">
            Estima cuántos centímetros crece el deportista por año, calculada entre dos mediciones consecutivas:
          </p>
          <Formula>{"Vel. Crecimiento = (Estatura₂ − Estatura₁) / (Fecha₂ − Fecha₁ en años)"}</Formula>
          <p className="text-sm text-slate-700 leading-relaxed">
            Requiere al menos <strong>2 registros</strong> del mismo deportista con un mínimo de 6 meses
            de separación. Para anualizar la tasa, se utiliza el registro previo cuyo intervalo respecto
            a la medición actual sea el más cercano a 1 año.
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            La velocidad de crecimiento se clasifica en tres categorías según Monasterio et al. (2024, <em>Biology of Sport</em>):
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-200 rounded bg-white">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Categoría</th>
                  <th className="px-3 py-2 text-center font-semibold">Rango (cm/año)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-rose-700">Rápido (fast)</td>
                  <td className="px-3 py-2 text-center">{"> 7.2"}</td>
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-amber-700">Moderado (moderate)</td>
                  <td className="px-3 py-2 text-center">3.5 – 7.2</td>
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-teal-700">Lento (slow)</td>
                  <td className="px-3 py-2 text-center">{"< 3.5"}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-teal-50 border border-teal-200 rounded text-xs text-teal-800">
            <strong>Interpretación práctica:</strong> Una velocidad de crecimiento clasificada como rápida
            (&gt; 7.2 cm/año) se asoció con un mayor riesgo de lesión en jugadores de fútbol de una
            academia de élite (Monasterio et al., 2024), especialmente durante la ventana de Pico de
            Velocidad de Crecimiento (PHV). En TalentOS, esta categoría activa los avisos de
            &quot;crecimiento acelerado&quot; en Performance Intelligence.
          </div>
          <Ref title="The combined effects of growth and maturity status on injury risk in an elite football academy" authors="Monasterio X, Cumming SP, Larruskain J, Johnson DM, Gil SM, Bidaurrazaga-Letona I, Lekue JA, Diaz-Beitia G, Santisteban JM, Williams S" year={2023} doi="10.5114/biolsport.2024.129472" />
        </Collapsible>

        <Collapsible title="Grupo madurativo — Clasificación Pre / Circa / Post-PHV">
          <p className="text-sm text-slate-700 leading-relaxed">
            Síntesis interpretativa que combina el offset y/o el % PAH para asignar al deportista a una de
            tres etapas de desarrollo:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-200 rounded bg-white">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Banda</th>
                  <th className="px-3 py-2 text-center font-semibold">Offset (años)</th>
                  <th className="px-3 py-2 text-center font-semibold">% PAH</th>
                  <th className="px-3 py-2 text-left font-semibold">Significado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-3 py-2 font-medium text-blue-700">Pre-PHV</td>
                  <td className="px-3 py-2 text-center">{"< −1"}</td>
                  <td className="px-3 py-2 text-center">{"< 88%"}</td>
                  <td className="px-3 py-2">Antes del pico de crecimiento</td>
                </tr>
                <tr className="bg-slate-50/50">
                  <td className="px-3 py-2 font-medium text-teal-700">Circa-PHV</td>
                  <td className="px-3 py-2 text-center">−1 a +1</td>
                  <td className="px-3 py-2 text-center">88–96%</td>
                  <td className="px-3 py-2">Entorno del pico de crecimiento</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium text-purple-700">Post-PHV</td>
                  <td className="px-3 py-2 text-center">{">"} +1</td>
                  <td className="px-3 py-2 text-center">{">"} 96%</td>
                  <td className="px-3 py-2">Pasado el pico de crecimiento</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            La estrategia de agrupación (offset vs. % PAH) es configurable en las preferencias de la aplicación.
            En chicas se recomienda priorizar % PAH por mayor estabilidad estadística.
          </p>
        </Collapsible>
      </section>

      {/* ── 2. MÉTODOS ── */}
      <section className="space-y-4">
        <SectionTitle id="methods">Métodos de cálculo madurativo</SectionTitle>
        <p className="text-sm text-slate-600 leading-relaxed">
          La aplicación implementa seis métodos de estimación de madurez biológica basados exclusivamente
          en medidas antropométricas. Cada uno tiene un contexto de uso óptimo, un rango de validación
          y limitaciones conocidas.
        </p>

        <Collapsible title="Fransen (2018) — Motor primario ♂">
          <div className="flex flex-wrap gap-2 mb-3">
            <Tag color="bg-blue-100 text-blue-700">Solo varones</Tag>
            <Tag color="bg-teal-100 text-teal-700">8–18 años</Tag>
            <Tag color="bg-green-100 text-green-700">AUTO ♂</Tag>
            <Tag color="bg-slate-100 text-slate-700">SEE ≈ 0.55–0.65 años</Tag>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">
            Fransen introduce el concepto de <strong>Maturity Ratio (MR)</strong>, definido como el cociente
            entre la edad cronológica y la APHV. A diferencia de los métodos basados en offset aditivo (Mirwald,
            Moore), el MR es multiplicativo, lo que corrige el sesgo sistemático en maduradores extremos.
            Desarrollado y validado en <strong>1.330 jugadores</strong> de academias de fútbol belgas.
          </p>
          <Formula>{"MR = 6.987 + 0.1158·AGE + 0.001451·AGE²\n    + 0.004518·BM − 0.000034·BM²\n    − 0.15195·H + 0.000933·H² − 0.00000166·H³\n    + 0.03220·LL − 0.000269·LL² − 0.000761·(H·AGE)\n\nAPHV   = AGE / MR\nOffset = AGE − APHV\n\nAGE = edad (años) · BM = masa (kg) · H = estatura (cm) · LL = long. pierna (cm)"}</Formula>
          <p className="text-sm text-slate-700"><strong>Variables requeridas:</strong> edad, estatura, masa corporal, longitud de pierna (= estatura − altura sentado).</p>
          <p className="text-sm text-slate-700 mt-2"><strong>¿Cuándo usarlo?</strong> Primera opción para varones en contexto de academia de fútbol, especialmente en extremos del espectro madurativo.</p>
          <Ref
            title="Improving the Prediction of Maturity From Anthropometric Variables Using a Maturity Ratio"
            authors="Fransen J, Bush S, Woodcock S, Novak A, Deprez D, Baxter-Jones ADG, Vaeyens R, Lenoir M"
            year={2018}
            doi="10.1123/pes.2017-0009"
          />
        </Collapsible>

        <Collapsible title="Mirwald (♀) — Motor primario ♀">
          <div className="flex flex-wrap gap-2 mb-3">
            <Tag color="bg-pink-100 text-pink-700">Solo chicas</Tag>
            <Tag color="bg-teal-100 text-teal-700">8–16 años</Tag>
            <Tag color="bg-green-100 text-green-700">AUTO ♀</Tag>
            <Tag color="bg-slate-100 text-slate-700">SEE ≈ 0.57 años · R² = 0.89</Tag>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">
            Implementa la <strong>ecuación Eq. 4</strong> de Mirwald et al. (2002) para chicas.
            <em> Nota bibliográfica:</em> anteriormente llamado "Sherar" en esta app por un error de atribución.
            Sherar et al. (2005) usa esta ecuación internamente pero no publica una ecuación de offset propia.
          </p>
          <Formula>{"MO = −9.376 + 0.0001882·(LL·SH) + 0.0022·(AGE·LL)\n    + 0.005841·(AGE·SH) − 0.002658·(AGE·BM)\n    + 0.07693·((BM/H)·100)\n\nAPHV = AGE − MO\n\nSH = altura sentado (cm) · LL = long. pierna (cm)"}</Formula>
          <p className="text-sm text-slate-700"><strong>Recomendación:</strong> complementar o priorizar el <strong>% PAH</strong> sobre el offset en chicas, ya que su fiabilidad es menor (Koziel &amp; Malina, 2018).</p>
          <div className="space-y-2">
            <Ref title="An assessment of maturity from anthropometric measurements" authors="Mirwald RL, Baxter-Jones ADG, Bailey DA, Beunen G" year={2002} doi="10.1097/00005768-200204000-00020" />
            <Ref title="Prediction of adult height using maturity-based cumulative height velocity curves" authors="Sherar LB, Mirwald RL, Baxter-Jones ADG, Thomis M" year={2005} doi="10.1016/j.jpeds.2005.04.065" />
          </div>
        </Collapsible>

        <Collapsible title="Moore (2015) — Fallback ambos sexos">
          <div className="flex flex-wrap gap-2 mb-3">
            <Tag color="bg-slate-100 text-slate-700">Ambos sexos</Tag>
            <Tag color="bg-teal-100 text-teal-700">8–18 años</Tag>
            <Tag color="bg-orange-100 text-orange-700">Fallback automático</Tag>
            <Tag color="bg-slate-100 text-slate-700">MAD ≈ 0.4–0.7 años</Tag>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">
            Simplifica los modelos de Mirwald a un único término de interacción, reduciendo la multicolinealidad.
            Dos variantes para varones: <strong>Moore-1</strong> (con altura sentado) y <strong>Moore-2</strong>
            (fallback sin altura sentado).
          </p>
          <Formula>{"♂ Moore-1 (con altura sentado):\nMO = −8.128741 + 0.0070346·(AGE·SH)\n\n♂ Moore-2 (sin altura sentado — activo automáticamente):\nMO = −7.999994 + 0.0036124·(AGE·H)\n\n♀ Moore:\nMO = −7.709133 + 0.0042232·(AGE·H)\n\nAPHV = AGE − MO"}</Formula>
          <p className="text-sm text-slate-700">Moore-2 penaliza ~0.1 años MAD adicional respecto a Moore-1. La app lo activa de forma transparente.</p>
          <Ref title="Enhancing a somatic maturity prediction model" authors="Moore SA, McKay HA, Macdonald H, Nettlefold L, Baxter-Jones ADG, Cameron N, Brasher PMA" year={2015} doi="10.1249/MSS.0000000000000588" />
        </Collapsible>

        <Collapsible title="Mirwald (2002) — Referencia histórica ♂">
          <div className="flex flex-wrap gap-2 mb-3">
            <Tag color="bg-slate-100 text-slate-700">Varones (Eq. 3)</Tag>
            <Tag color="bg-teal-100 text-teal-700">8–16 años</Tag>
            <Tag color="bg-slate-100 text-slate-700">Motor de respaldo</Tag>
            <Tag color="bg-slate-100 text-slate-700">R² = 0.891 · SEE = 0.592 años</Tag>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">
            Primer método en estimar el maturity offset desde medidas antropométricas puras, sin necesidad de
            edad ósea radiológica. Desarrollado sobre datos longitudinales de tres estudios canadienses (SGDS,
            BMAS, LLTS). Base sobre la que se construyeron Moore y Fransen; la referencia más citada en la literatura.
          </p>
          <Formula>{"♂ (Eq. 3):\nMO = −9.236 + 0.0002708·(LL·SH) − 0.001663·(AGE·LL)\n    + 0.007216·(AGE·SH) + 0.02292·((BM/H)·100)\n\nAPHV = AGE − MO"}</Formula>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
            <strong>⚠️ Limitación:</strong> Alta correlación offset-edad (r ≈ 0.92–0.97) que puede introducir
            sesgo circular. Error ×2–6 en maduradores extremos (Koziel &amp; Malina, 2018).
          </div>
          <Ref title="An assessment of maturity from anthropometric measurements" authors="Mirwald RL, Baxter-Jones ADG, Bailey DA, Beunen G" year={2002} doi="10.1097/00005768-200204000-00020" />
        </Collapsible>

        <Collapsible title="Khamis-Roche (1994) — Predicción de talla adulta y base del % PAH">
          <div className="flex flex-wrap gap-2 mb-3">
            <Tag color="bg-slate-100 text-slate-700">Ambos sexos</Tag>
            <Tag color="bg-slate-100 text-slate-700">Requiere tallas parentales</Tag>
            <Tag color="bg-emerald-100 text-emerald-700">Base del % PAH</Tag>
            <Tag color="bg-slate-100 text-slate-700">±3–5 cm IC 95%</Tag>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">
            No es un método de offset sino de <strong>predicción de talla adulta</strong>. Su output es el
            denominador del cálculo del % PAH. Usa estatura actual, masa corporal y talla media parental.
          </p>
          <Formula>{"Talla media parental (♂) = (Tall_padre + Tall_madre + 13) / 2\nTalla media parental (♀) = (Tall_padre + Tall_madre − 13) / 2\n\nPAH_estimada = β₀ + β₁·Estatura + β₂·Masa + β₃·TallaMediaParental\n(coeficientes β específicos por sexo y edad — tablas K-R 1994)\n\nSi tallas parentales son autorreportadas:\n  corrección −0.5 cm (padres) · −1.0 cm (madres)  [Damon, 1965]"}</Formula>
          <p className="text-sm text-slate-700"><strong>Sin tallas parentales:</strong> la app usa el método de fallback Koziel-Malina basado en el % PAH de referencia poblacional para la edad.</p>
          <Ref title="Predicting adult stature without using skeletal age: The Khamis-Roche method" authors="Khamis HJ, Roche AF" year={1994} doi="10.1542/peds.94.4.504" />
        </Collapsible>

        <Collapsible title="SITAR (2010) — Modelo longitudinal individual">
          <div className="flex flex-wrap gap-2 mb-3">
            <Tag color="bg-blue-100 text-blue-700">Varones validado</Tag>
            <Tag color="bg-purple-100 text-purple-700">≥3 mediciones</Tag>
            <Tag color="bg-green-100 text-green-700">~80% clasificación correcta</Tag>
            <Tag color="bg-violet-100 text-violet-700">Selección explícita</Tag>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">
            <strong>SITAR</strong> (SuperImposition by Translation And Rotation) es el único método longitudinal
            de la aplicación. Ajusta la curva de crecimiento individual completa y extrae tres parámetros biológicos:
          </p>
          <div className="grid grid-cols-3 gap-3 text-xs text-center mb-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <p className="font-bold text-slate-800 text-lg mb-1">a</p>
              <p className="font-medium">Tamaño</p>
              <p className="text-slate-500 mt-1">Desviación de estatura adulta respecto a la media</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <p className="font-bold text-slate-800 text-lg mb-1">b</p>
              <p className="font-medium">Timing</p>
              <p className="text-slate-500 mt-1">Adelanto/retraso del PHV respecto a la media</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <p className="font-bold text-slate-800 text-lg mb-1">c</p>
              <p className="font-medium">Velocidad</p>
              <p className="text-slate-500 mt-1">Factor multiplicativo de la velocidad de crecimiento</p>
            </div>
          </div>
          <Formula>{"APHV_SITAR  = 13.5 + b\nPHV_SITAR   = 10.1 × exp(−c)\nPAH_SITAR   = 179.5 + a\n\nParámetros de referencia (fútbol élite español, Monasterio 2026):\n  meanAPHV = 13.5 años · meanPHV = 10.1 cm/año · meanAdultHeight = 179.5 cm"}</Formula>
          <p className="text-sm text-slate-700">Disponible como motor explícito cuando hay ≥3 mediciones separadas ≥6 meses (varones). Seleccionar manualmente en Ajustes Madurativos. Con datos solo U13-U15, error típico en APHV ≈ ±0.6 años. PHV y PAH son estimaciones secundarias con mayor variabilidad (Monasterio et al., 2026).</p>
          <div className="space-y-2">
            <Ref title="SITAR — a useful instrument for growth curve analysis" authors="Cole TJ, Donaldson MDC, Ben-Shlomo Y" year={2010} doi="10.1093/ije/dyq115" />
            <Ref title="Application of the SITAR model for estimating APHV, PHV, and adult height in elite male football players" authors="Monasterio X et al." year={2026} />
          </div>
        </Collapsible>
      </section>

      {/* ── 3. CONSENSO ── */}
      <section className="space-y-4">
        <SectionTitle id="consensus">Consenso — Ponderación dinámica de métodos</SectionTitle>
        <p className="text-sm text-slate-600 leading-relaxed">
          El modo <strong>Consenso</strong> combina las estimaciones de los métodos disponibles con pesos
          científicamente fundamentados en su precisión relativa, reduciendo la dependencia de un único
          modelo con sus sesgos específicos.
        </p>
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-purple-200 rounded bg-white">
              <thead className="bg-purple-100">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Método</th>
                  <th className="px-3 py-2 text-right font-semibold">Peso base</th>
                  <th className="px-3 py-2 text-right font-semibold">Peso final ♂</th>
                  <th className="px-3 py-2 text-right font-semibold">Peso final ♀</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-100">
                <tr><td className="px-3 py-2">Fransen</td><td className="px-3 py-2 text-right">50%</td><td className="px-3 py-2 text-right font-medium">50%</td><td className="px-3 py-2 text-right text-slate-400">— excluido</td></tr>
                <tr className="bg-purple-50/30"><td className="px-3 py-2">Mirwald (♀)</td><td className="px-3 py-2 text-right">50%</td><td className="px-3 py-2 text-right text-slate-400">— excluido</td><td className="px-3 py-2 text-right font-medium">62.5%</td></tr>
                <tr><td className="px-3 py-2">Moore</td><td className="px-3 py-2 text-right">30%</td><td className="px-3 py-2 text-right font-medium">30%</td><td className="px-3 py-2 text-right font-medium">37.5%</td></tr>
                <tr className="bg-purple-50/30"><td className="px-3 py-2">Mirwald (♂)</td><td className="px-3 py-2 text-right">20%</td><td className="px-3 py-2 text-right font-medium">20%</td><td className="px-3 py-2 text-right text-slate-400">— excluido</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-purple-800">
            Los pesos se reajustan automáticamente cuando algún método no tiene datos disponibles (por ejemplo, sin altura sentado se excluye Fransen y se renormalizan el resto).
          </p>
        </div>
      </section>

      {/* ── 4. BIO-BANDING ── */}
      <section className="space-y-4">
        <SectionTitle id="biobanding">Bio-banding</SectionTitle>
        <p className="text-sm text-slate-600 leading-relaxed">
          El <strong>bio-banding</strong> agrupa a los deportistas por estado de madurez biológica en lugar
          de por edad cronológica, creando grupos más homogéneos en tamaño y desarrollo físico. Reduce las
          ventajas artificiales de los jugadores cronológicamente mayores dentro de la misma categoría
          (<em>relative age effect</em>).
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <h3 className="font-semibold text-slate-900 mb-2 text-sm">Estrategia por Offset</h3>
            <p className="text-xs text-slate-700 leading-relaxed">
              Agrupa por años de diferencia respecto al PHV. Intuitiva para el staff y directamente interpretable
              en términos de "cuánto le queda de crecimiento". Recomendada para varones donde el offset tiene
              mayor precisión.
            </p>
          </div>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <h3 className="font-semibold text-slate-900 mb-2 text-sm">Estrategia por % PAH</h3>
            <p className="text-xs text-slate-700 leading-relaxed">
              Agrupa por porcentaje de talla adulta alcanzada. Requiere tallas parentales para mayor precisión.
              Recomendada para chicas y como complemento en cualquier sexo frente a maduradores extremos.
            </p>
          </div>
        </div>
        <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
          <strong>Evidencia:</strong> El bio-banding ha mostrado beneficios en la identificación de talentos
          tardíos (<em>late maturers</em>) que quedan infravalorados en comparativas por edad cronológica.
          Su implementación en partidos y sesiones mixtas también reporta beneficios tácticos y psicológicos.
        </div>
        <Ref
          title="Bio-banding in sport: applications to competition, talent identification and strength and conditioning of youth athletes"
          authors="Cumming SP, Lloyd RS, Oliver JL, Eisenmann JC, Malina RM"
          year={2017}
          doi="10.1519/SSC.0000000000000281"
        />
      </section>

      {/* ── 5. GUÍA RÁPIDA ── */}
      <section className="space-y-4">
        <SectionTitle id="guide">Guía rápida de selección de método</SectionTitle>
        <div className="space-y-2">
          {([
            { cond: "Varones, con altura sentado", rec: "Fransen (AUTO ♂)", why: "Mayor precisión validada en academias de fútbol masculino. Corrige sesgo en extremos." },
            { cond: "Chicas", rec: "Mirwald (♀) + % PAH (AUTO ♀)", why: "Único método de offset específico para chicas. Complementar con % PAH por mayor fiabilidad." },
            { cond: "Sin altura sentado (varones)", rec: "Moore-2 (fallback automático)", why: "La app lo activa sin intervención. Penalización de ~0.1 años MAD respecto a Moore-1." },
            { cond: "≥3 mediciones longitudinales (varones)", rec: "SITAR (selección manual)", why: "~80% clasificación correcta vs ~50–70% con métodos de offset. Seleccionar explícitamente en Ajustes Madurativos." },
            { cond: "Tallas parentales disponibles", rec: "Khamis-Roche para % PAH", why: "La talla parental es el predictor más potente de talla adulta. Indicar si son autorreportadas." },
            { cond: "Comparativa entre métodos", rec: "Consenso", why: "Reduce el sesgo individual de cada método combinando con pesos científicamente fundamentados." },
          ] as const).map((row, i) => (
            <div key={i} className="grid md:grid-cols-3 gap-2 text-xs p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div><span className="font-semibold text-slate-700">Situación: </span>{row.cond}</div>
              <div><span className="font-semibold text-teal-700">Recomendación: </span>{row.rec}</div>
              <div className="text-slate-500">{row.why}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 6. DESCARGA ── */}
      <section className="space-y-3">
        <SectionTitle id="download">Documentación técnica completa</SectionTitle>
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <h2 className="font-semibold text-slate-900 mb-1 text-emerald-900">📄 Guía técnica verificada</h2>
          <p className="text-sm text-slate-700 mb-3">
            Fórmulas verificadas coeficiente a coeficiente contra los artículos originales, limitaciones
            clínicas, referencias bibliográficas completas y glosario. Versión 2.0 — Mayo 2026.
          </p>
          <a
            href="/community/maturation-methods.md"
            download="maturation-methods.md"
            className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-700 text-white text-sm rounded hover:bg-emerald-800 transition-colors"
          >
            <FileDown size={15} /> Descargar maturation-methods.md
          </a>
          <p className="text-xs text-slate-500 mt-2">
            Incluye: Fransen, Mirwald (♂/♀), Moore (Moore-1 y Moore-2), Khamis-Roche, WHO BMI Z-Score,
            SITAR, Consenso, Bio-banding, avisos clínicos, glosario y referencias.
          </p>
        </div>
        <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
          <strong>⚠️ Aviso clínico:</strong> Las estimaciones se basan en ecuaciones de nivel poblacional.
          La variación individual es normal. Interpretar siempre el estado madurativo en contexto con
          observaciones cualitativas y los requisitos específicos del deporte. Para dudas clínicas,
          derivar a profesionales sanitarios.
        </div>
      </section>

    </div>
  );
}

function LearningTab({ t }: { t: (key: string) => string }) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <GraduationCap className="h-8 w-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-700 mb-2">{t("community.tabLearning")} — {t("community.learningComingSoon")}</h2>
        <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
          {t("community.learningComingSoonDesc")}
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main page (needs Suspense for useSearchParams)
───────────────────────────────────────────── */
type Tab = "network" | "learning" | "documentation";

function CommunityPageInner() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawTab = searchParams.get("tab") as Tab | null;
  const activeTab: Tab = rawTab === "network" || rawTab === "documentation" ? rawTab : "learning";

  const setTab = (tab: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/community?${params.toString()}`, { scroll: false });
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "network",       label: t("community.tabNetwork"),       icon: <Users className="h-3.5 w-3.5" /> },
    { key: "learning",      label: t("community.tabLearning"),      icon: <GraduationCap className="h-3.5 w-3.5" /> },
    { key: "documentation", label: t("community.tabDocumentation"), icon: <BookOpen className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="fade-up space-y-3">
        <p className="eyebrow">{t("community.title")}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{t("community.subtitle")}</h1>
      </section>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-zinc-200">
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === key
                ? "border-teal-600 text-teal-700"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "network"       && <NetworkTab t={t} />}
      {activeTab === "learning"      && <LearningTab t={t} />}
      {activeTab === "documentation" && <DocumentationTab t={t} />}
    </div>
  );
}

export default function CommunityPage() {
  return (
    <Suspense>
      <CommunityPageInner />
    </Suspense>
  );
}