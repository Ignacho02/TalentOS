"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { MaturationEngine } from "@/lib/maturation/unified-maturation";

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
  const [showAdjustments, setShowAdjustments] = useState(false);
  const showSitar = measurementCount >= 3;

  // Engine options based on sex
  const availableEngines: MaturationEngine[] = sex === "male"
    ? ["auto", "fransen", "moore", "mirwald", "consensus", ...(showSitar ? ["sitar" as MaturationEngine] : [])]
    : ["auto", "sherar", "moore", "mirwald", "consensus", ...(showSitar ? ["sitar" as MaturationEngine] : [])];

  const getEngineTranslatedLabel = (engine: MaturationEngine): string => {
    const labels: Record<MaturationEngine, string> = {
      auto: t("maturationMethods.auto"),
      fransen: t("maturationMethods.fransen"),
      moore: t("maturationMethods.moore"),
      mirwald: t("maturationMethods.mirwald"),
      sherar: t("maturationMethods.sherar"),
      sitar: t("maturationMethods.sitar"),
      consensus: t("maturationMethods.consensus"),
    };
    return labels[engine];
  };

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
          onClick={() => setShowAdjustments(true)}
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
              <Link href="/community" className="text-xs text-violet-700 font-medium hover:underline">
                {t("maturationMethods.communityLink")}
              </Link>

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
                      <span className="font-medium text-slate-700">
                        {getEngineTranslatedLabel(engine)}
                        {engine === "sitar" && (
                          <span className="ml-2 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded-full">
                            AUTO ≥3
                          </span>
                        )}
                        {engine === "auto" && measurementCount >= 3 && sex === "male" && (
                          <span className="ml-2 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded-full">
                            {t("maturationMethods.sitarActive")}
                          </span>
                        )}
                      </span>
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

    </div>
  );
}