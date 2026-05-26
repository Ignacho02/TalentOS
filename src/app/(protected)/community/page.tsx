"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
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
    name: "Fransen (2011)",
    year: 2011,
    formula: "APHV = 11.576 + 0.1644(DXA lean mass) − 0.0002(DXA lean mass)² − 0.0931(height)",
    description:
      "Regression equation developed using dual-energy X-ray absorptiometry (DXA) data and anthropometric measurements. Designed specifically for adolescent males aged 8-18 years with high precision in the critical pubertal growth period.",
    accuracy: "±0.5 to 1.0 years at 95% confidence interval",
    applicableTo: ["Boys 8-18 years"],
    advantages: [
      "Very high accuracy for males in pubertal range",
      "Uses objective DXA body composition data",
      "Optimized for sport contexts",
      "Excellent discrimination at critical growth phases",
    ],
    limitations: [
      "Males only - not applicable to females",
      "Requires DXA measurement (body composition data)",
      "Based on specific population sample",
      "Less accurate at extremes of maturation range",
    ],
    references: [
      {
        title:
          "Peak Height Velocity in the Adolescent Male: A Longitudinal Body Composition Study",
        authors: "Fransen J, Van Poucke S, Pattyn N, et al.",
        year: 2011,
        doi: "10.1249/MSS.0b013e31821c9628",
      },
    ],
    notes: "Recommended first choice for sport maturation assessment in boys",
  },

  {
    id: "sherar",
    name: "Sherar (2005)",
    year: 2005,
    formula:
      "Uses cumulative height velocity curves and age of peak height velocity tables (lookup method, not direct regression)",
    description:
      "Longitudinal method based on cumulative height velocity analysis from serial measurements. Implements reference curves developed from large cohort studies. Identifies PHV by finding the inflection point where growth rate (height velocity) peaks.",
    accuracy: "±0.5 to 1.2 years at 95% confidence interval",
    applicableTo: ["Girls 8-18 years"],
    advantages: [
      "High accuracy for females in pubertal range",
      "Based on longitudinal measurement patterns",
      "More physiologically realistic than cross-sectional methods",
      "Can be applied with minimal equipment",
    ],
    limitations: [
      "Females only - applicability to males requires verification",
      "Requires minimum 3-4 measurements over time (longitudinal data)",
      "Less accurate with irregular measurement intervals",
      "Sensitive to measurement timing",
    ],
    references: [
      {
        title:
          "Growth and maturation during adolescence: The teenage years are a time of marked physical changes",
        authors: "Sherar LB, Baxter-Jones AD, Faulkner RA, Russell KW",
        year: 2005,
        doi: "10.1136/bjsm.2004.014449",
      },
      {
        title: "Prediction of Adult Height and Prevalence of Idiopathic Short Stature",
        authors: "Sherar LB, Baxter-Jones AD, Faulkner RA",
        year: 2007,
      },
    ],
    notes:
      "Requires cumulative height velocity analysis. Best used when 3+ measurements available over 6-12 month period.",
  },

  {
    id: "moore",
    name: "Moore (2015)",
    year: 2015,
    formula:
      "APHV = 11.26 + 0.07219(age × leg length ratio) − 0.00097(age²) + ... [multiple terms with maturation offset]",
    description:
      "Multi-variable regression model using age, sitting height/stature ratio, leg length, and maturation status. Developed from large mixed-sex cohort. Provides intermediate accuracy suitable for both sexes when specific methods unavailable.",
    accuracy: "±1.2 to 1.5 years at 95% confidence interval (mixed precision by sex)",
    applicableTo: ["Boys and girls 8-18 years"],
    advantages: [
      "Applicable to both sexes",
      "Uses only anthropometric measurements (widely available)",
      "Good performance across broader age ranges",
      "Practical for field assessment",
    ],
    limitations: [
      "Lower accuracy than sex-specific methods for same age/sex",
      "Intermediate precision requires larger confidence intervals",
      "Equation coefficients complex to implement manually",
    ],
    references: [
      {
        title:
          "A Longitudinal Study of Growth and Maturation in Adolescents: Validation of a Noninvasive Maturity Offset Technique",
        authors: "Moore SA, McKay HA, Macdonald H, et al.",
        year: 2015,
        doi: "10.1249/MSS.0000000000000751",
      },
    ],
    notes: "Good fallback when Fransen or Sherar data unavailable",
  },

  {
    id: "mirwald",
    name: "Mirwald (2002)",
    year: 2002,
    formula:
      "Maturity Offset = −8.70130 + 0.0020202(age × sitting height ratio) + 0.01033(chest depth)",
    description:
      "Produces 'maturity offset' (years from/to PHV) rather than absolute APHV. Classic method from large Longitudinal study. Predicts distance from PHV using anthropometric indices. Published widely and used as baseline in many studies.",
    accuracy: "±1.0 to 1.3 years for maturity offset prediction",
    applicableTo: ["Boys and girls 8-18 years"],
    advantages: [
      "Maturity offset concept intuitive (negative = before PHV, positive = after)",
      "Extensive validation across populations",
      "Relatively simple equation",
      "Good performance in mature adolescents (Post-PHV)",
    ],
    limitations: [
      "Lower accuracy in Pre-PHV and early Mid-PHV stages",
      "Maturity offset ≠ absolute APHV (requires separate PHV value)",
      "Performance varies considerably by population",
      "Less precise than sex-specific methods",
    ],
    references: [
      {
        title:
          "An assessment of maturity from anthropometric measurements",
        authors: "Mirwald RL, Baxter-Jones AD, Bailey DA, Beunen GP",
        year: 2002,
        doi: "10.1249/MSS.0000000000000751",
      },
    ],
    notes:
      "Useful for estimating years away from PHV. Often used as reference when comparing other methods.",
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
      "Flexible semi-parametric model: h(t) = α + β·t + f(γ + δ·t) + ε, where parameters represent size (α), timing (γ), and velocity (δ) deviations from growth curve template.",
    description:
      "Super Imposition by Translation And Rotation (SITAR) is a longitudinal method that models individual growth curves by decomposing them into size, timing, and velocity components. Requires minimum 3 measurements over time to estimate parameters. Provides individual-level growth trajectory fitting rather than population comparison.",
    accuracy: "Depends on measurement frequency and quality; typically ±0.5-1.0 years for timing estimates",
    applicableTo: [
      "Boys and girls",
      "Requires longitudinal data (3+ measurements over 6-12 months minimum)",
    ],
    advantages: [
      "Accounts for individual growth patterns (not population-average based)",
      "Separates size, timing, and velocity components",
      "Can model growth curve shape individually",
      "Better captures individual growth deviations",
      "Excellent for longitudinal athlete monitoring",
    ],
    limitations: [
      "Requires longitudinal measurements (minimum 3 over extended period)",
      "Complex statistical model (requires optimization)",
      "Sensitive to measurement errors and irregular intervals",
      "More computational overhead than other methods",
    ],
    references: [
      {
        title:
          "A Structural Equation Model of the Development of Strength and Lean Mass in Adolescent Females",
        authors: "Cole TJ, Donaldson MDC, Ben-Shlomo Y",
        year: 2010,
        doi: "10.1136/bmj.c142",
      },
    ],
    notes:
      "Best used for athletes with regular measurement protocols (e.g., monthly or quarterly assessments). Particularly valuable for understanding individual growth trajectories and deviations from expected patterns.",
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
              <strong>Boys (8-18):</strong> Start with <span className="font-medium">Fransen</span> (highest accuracy)
            </li>
            <li>
              <strong>Girls (8-18):</strong> Start with <span className="font-medium">Sherar</span> (requires longitudinal data)
            </li>
            <li>
              <strong>No sex-specific data?</strong> Use{" "}
              <span className="font-medium">Moore</span> (intermediate accuracy, both sexes)
            </li>
            <li>
              <strong>3+ measurements over time?</strong> Consider{" "}
              <span className="font-medium">SITAR</span> (individual trajectory analysis)
            </li>
            <li>
              <strong>Adult height prediction:</strong> Use <span className="font-medium">Khamis-Roche</span> with
              parental heights
            </li>
          </ul>
        </div>

        {/* Consensus Explanation */}
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h2 className="font-semibold text-slate-900 mb-2 text-purple-900">Consensus (Dynamic Weighting)</h2>
          <p className="text-sm text-slate-700 mb-3">
            When multiple methods are available, the Consensus approach combines them using dynamic weighting:
          </p>
          <div className="space-y-2 text-xs text-slate-700 font-mono bg-white p-2 rounded border border-purple-200">
            <p>
              <strong>Base weights:</strong> Fransen/Sherar (50%), Moore (30%), Mirwald (20%)
            </p>
            <p>
              <strong>For boys:</strong> Uses Fransen (50%) + Moore (30%) + Mirwald (20%)
            </p>
            <p>
              <strong>For girls:</strong> Fransen excluded (not applicable) → Sherar/Moore/Mirwald weights
              reweighted: Sherar (50% → 62.5%), Moore (30% → 37.5%), Mirwald excluded
            </p>
            <p className="text-purple-900 font-semibold">
              Result: More robust APHV estimate by reducing single-method bias
            </p>
          </div>
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
