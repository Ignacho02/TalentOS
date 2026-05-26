"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Settings } from "lucide-react";
import type { MaturationEngine } from "@/lib/maturation/unified-maturation";
import { getEngineLabel } from "@/lib/maturation/unified-maturation";

interface MaturationPreferencesProps {
  selectedEngine: MaturationEngine;
  onEngineChange: (engine: MaturationEngine) => void;
  bioBandingStrategy: "offset" | "pah";
  onBioStrategyChange: (strategy: "offset" | "pah") => void;
  t: (key: string) => string;
  sex?: "male" | "female";
  measurementCount?: number;
}

export function MaturationPreferences({
  selectedEngine,
  onEngineChange,
  bioBandingStrategy,
  onBioStrategyChange,
  t,
  sex = "male",
  measurementCount = 0,
}: MaturationPreferencesProps) {
  const router = useRouter();
  const [showAdjustments, setShowAdjustments] = useState(false);
  const [showInformation, setShowInformation] = useState(false);
  const showSitar = measurementCount >= 3;

  // Engine options based on sex
  const availableEngines: MaturationEngine[] = sex === "male"
    ? ["auto", "fransen", "moore", "mirwald", "consensus", ...(showSitar ? ["sitar"] : [])]
    : ["auto", "sherar", "moore", "mirwald", "consensus", ...(showSitar ? ["sitar"] : [])];

  const getEngineDescription = (engine: MaturationEngine): string => {
    const descriptions: Record<MaturationEngine, string> = {
      auto: t("maturationMethods.autoDesc"),
      fransen: t("maturationMethods.fransenDesc"),
      moore: t("maturationMethods.moorDesc"),
      mirwald: t("maturationMethods.mirwaldDesc"),
      sherar: t("maturationMethods.sherarDesc"),
      sitar: t("maturationMethods.sitarDesc"),
      consensus: t("maturationMethods.consensusDesc"),
    };
    return descriptions[engine];
  };

  return (
    <div className="space-y-3">
      {/* ACCORDION 1: ADJUSTMENTS (Settings) */}
      <div className="rounded-lg border border-slate-200 bg-white/50 backdrop-blur-sm">
        <button
          onClick={() => setShowAdjustments(!showAdjustments)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition"
        >
          <span className="font-medium text-slate-900 text-sm">
            ⚙️ {t("maturationMethods.adjustmentsTitle")}
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${showAdjustments ? "rotate-180" : ""}`}
          />
        </button>

        {showAdjustments && (
          <div className="border-t border-slate-200 px-4 py-4 space-y-4">
            {/* Method Selection */}
            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wide">
                {t("maturationMethods.selectMethod")}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                {t("maturationMethods.methodForAphvDesc")}
              </p>

              <div className="space-y-2">
                {availableEngines.map((engine) => (
                  <div key={engine} className="flex items-start gap-2">
                    <input
                      type="radio"
                      id={`engine-${engine}`}
                      name="engine"
                      value={engine}
                      checked={selectedEngine === engine}
                      onChange={() => onEngineChange(engine)}
                      className="cursor-pointer mt-1"
                    />
                    <label htmlFor={`engine-${engine}`} className="flex-1 cursor-pointer">
                      <span className="font-medium text-slate-700">{getEngineLabel(engine)}</span>
                      <span className="text-xs text-slate-500 block leading-relaxed">
                        {getEngineDescription(engine)}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Bio-banding Strategy */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wide">
                {t("maturationMethods.bioBandingStrategy")}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                {t("maturationMethods.bioBandingDesc")}
              </p>

              <div className="space-y-2">
                {[
                  { value: "offset", label: t("maturationMethods.offsetStrategy"), desc: t("maturationMethods.offsetStrategyDesc") },
                  { value: "pah", label: t("maturationMethods.pahStrategy"), desc: t("maturationMethods.pahStrategyDesc") },
                ].map(({ value, label, desc }) => (
                  <label
                    key={value}
                    className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-slate-100 transition"
                  >
                    <input
                      type="radio"
                      checked={bioBandingStrategy === value}
                      onChange={() => onBioStrategyChange(value as "offset" | "pah")}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-slate-700 block">{label}</span>
                      <span className="text-xs text-slate-500 block">{desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ACCORDION 2: INFORMATION (Help) */}
      <div className="rounded-lg border border-slate-200 bg-white/50 backdrop-blur-sm">
        <button
          onClick={() => setShowInformation(!showInformation)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition"
        >
          <span className="font-medium text-slate-900 text-sm">
            ℹ️ {t("maturationMethods.informationTitle")}
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${showInformation ? "rotate-180" : ""}`}
          />
        </button>

        {showInformation && (
          <div className="border-t border-slate-200 px-4 py-4 space-y-3">
            {/* Table Variables */}
            <div className="space-y-3">
              <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wide">
                {t("maturationMethods.tableVariables")}
              </h4>

              <div className="space-y-2 text-xs">
                {[
                  { title: "Grupo", desc: t("maturationMethods.groupDesc") },
                  { title: "Offset", desc: t("maturationMethods.offsetDesc") },
                  { title: "APHV", desc: t("maturationMethods.aphvDesc") },
                  { title: "% PAH", desc: t("maturationMethods.pahDesc") },
                  { title: "SHR", desc: t("maturationMethods.shrDesc") },
                  { title: "WHO BMI Z", desc: t("maturationMethods.whoBmiDesc") },
                ].map(({ title, desc }) => (
                  <div key={title} className="p-2.5 bg-slate-50 rounded border border-slate-200">
                    <p className="font-medium text-slate-900">{title}</p>
                    <p className="text-slate-600 mt-1 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Info Banner */}
            <div className="mt-3 p-3 bg-teal-50 border border-teal-200 rounded text-xs text-teal-900 space-y-1.5">
              <div>
                <strong>{t("maturationMethods.auto")}:</strong>
                <p className="text-teal-800">{t("maturationMethods.autoFullDesc")}</p>
              </div>
              <div>
                <strong>{t("maturationMethods.consensus")}:</strong>
                <p className="text-teal-800">{t("maturationMethods.consensusSexNote")}</p>
              </div>
            </div>

            {/* Community Link */}
            <div className="pt-3 border-t border-slate-200">
              <button
                onClick={() => router.push("/community")}
                className="inline-flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-teal-700 transition"
              >
                <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
                {t("maturationMethods.communityLink")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
