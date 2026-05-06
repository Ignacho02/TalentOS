import React from 'react';
import { TrendingUp, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import type { MaturationResult } from '@/lib/types';
import { useLocale } from '@/lib/i18n/locale-context';

interface MaturationInsightsProps {
  result: MaturationResult;
  zScore?: {
    score: number;
    label: string;
  };
  baselineLabel?: string;
}

export function MaturationInsights({ result, zScore, baselineLabel }: MaturationInsightsProps) {
  const { t } = useLocale();
  const { maturityBand, primaryOffset } = result.classification;
  const { percentageAdultHeight, pahCm } = result.methodOutputs;

  const getBandColor = (band: string) => {
    switch (band) {
      case 'Pre-PHV': return 'text-teal-700 bg-teal-50 border-teal-200';
      case 'Mid-PHV': return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'Post-PHV': return 'text-slate-800 bg-slate-50 border-slate-200';
      default: return 'text-zinc-600 bg-zinc-50 border-zinc-200';
    }
  };

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
      {/* Maturity Status Card */}
      <div className={`rounded-2xl border p-5 ${getBandColor(maturityBand)}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm uppercase tracking-wider opacity-80">
            {t("analysis.individual.maturityStatus")}
          </h3>
          <div className="relative group/tooltip">
            <Info className="h-5 w-5 opacity-60 hover:opacity-100 cursor-help transition-all" />
            <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-10 shadow-xl pointer-events-none font-normal">
              {t("analysis.individual.maturityStatusExplanation")}
              <div className="absolute top-full right-1.5 border-4 border-transparent border-t-slate-800"></div>
            </div>
          </div>
        </div>
        <div suppressHydrationWarning className="text-3xl font-bold mb-1">{maturityBand}</div>
        <p suppressHydrationWarning className="text-sm opacity-90">
          {primaryOffset < 0 
            ? t("analysis.individual.yearsToPHV").replace("{years}", Math.abs(primaryOffset).toFixed(2))
            : t("analysis.individual.yearsSincePHV").replace("{years}", primaryOffset.toFixed(2))}
        </p>
      </div>

      {/* Adult Height Prediction Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-slate-500">
            {t("analysis.individual.adultHeightPredictionTitle")}
          </h3>
          <div className="relative group/tooltip">
            <Info className="h-5 w-5 text-teal-600 opacity-60 hover:opacity-100 cursor-help transition-all" />
            <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-10 shadow-xl pointer-events-none font-normal">
              {t("analysis.individual.adultHeightExplanation")}
              <div className="absolute top-full right-1.5 border-4 border-transparent border-t-slate-800"></div>
            </div>
          </div>
        </div>
        <div suppressHydrationWarning className="text-3xl font-bold text-slate-900 mb-1">
          {pahCm ? `${pahCm.toFixed(2)} cm` : 'N/A'}
        </div>
        <p suppressHydrationWarning className="text-sm text-slate-500">
          {percentageAdultHeight 
            ? t("analysis.individual.adultHeightReached").replace("{percent}", percentageAdultHeight.toFixed(2))
            : t("analysis.individual.missingParentData")}
        </p>
      </div>

      {/* Z-Score Card */}
      {zScore && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-center relative group">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-teal-600" />
              <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500">
                {t("analysis.individual.zScoreLabel")}
              </h3>
            </div>
            <div className="relative group/tooltip">
              <Info className="h-4 w-4 text-slate-300 hover:text-slate-500 cursor-help transition-colors" />
              <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-10 shadow-xl pointer-events-none font-normal">
                {t("analysis.individual.zScoreExplanation")}
                <div className="absolute top-full right-1.5 border-4 border-transparent border-t-slate-800"></div>
              </div>
            </div>
          </div>
          <div 
            suppressHydrationWarning
            className="text-4xl font-bold mb-2 text-teal-600"
          >
            {formatNumber(zScore.score, 2)}
          </div>
          <p className="text-xs text-slate-400">
            vs {baselineLabel || zScore.label}
          </p>
        </div>
      )}
    </div>
  );
}
