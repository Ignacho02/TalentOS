import React from 'react';
import { TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { MaturationResult } from '@/lib/types';
import { useLocale } from '@/lib/i18n/locale-context';

interface MaturationInsightsProps {
  result: MaturationResult;
}

export function MaturationInsights({ result }: MaturationInsightsProps) {
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

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Maturity Status Card */}
      <div className={`rounded-2xl border p-5 ${getBandColor(maturityBand)}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm uppercase tracking-wider opacity-80">
            {t("analysis.individual.maturityStatus")}
          </h3>
          <AlertCircle className="h-5 w-5 opacity-60" />
        </div>
        <div suppressHydrationWarning className="text-3xl font-bold mb-1">{maturityBand}</div>
        <p suppressHydrationWarning className="text-sm opacity-90">
          {primaryOffset < 0 
            ? t("analysis.individual.yearsToPHV").replace("{years}", Math.abs(primaryOffset).toFixed(1))
            : t("analysis.individual.yearsSincePHV").replace("{years}", primaryOffset.toFixed(1))}
        </p>
      </div>

      {/* Adult Height Prediction Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-slate-500">
            {t("analysis.individual.adultHeightPredictionTitle")}
          </h3>
          <TrendingUp className="h-5 w-5 text-teal-600 opacity-60" />
        </div>
        <div suppressHydrationWarning className="text-3xl font-bold text-slate-900 mb-1">
          {pahCm ? `${pahCm.toFixed(1)} cm` : 'N/A'}
        </div>
        <p suppressHydrationWarning className="text-sm text-slate-500">
          {percentageAdultHeight 
            ? t("analysis.individual.adultHeightReached").replace("{percent}", percentageAdultHeight.toFixed(1))
            : t("analysis.individual.missingParentData")}
        </p>
      </div>

      {/* Recommendations Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1 md:col-span-2">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-slate-500">
            {t("analysis.individual.bioBandingRecommendation")}
          </h3>
          <CheckCircle2 className="h-5 w-5 text-emerald-500 opacity-60" />
        </div>
        <div className="text-lg font-medium text-slate-900">
          {maturityBand === 'Pre-PHV' && t("analysis.individual.recPrePHV")}
          {maturityBand === 'Mid-PHV' && t("analysis.individual.recMidPHV")}
          {maturityBand === 'Post-PHV' && t("analysis.individual.recPostPHV")}
        </div>
      </div>
    </div>
  );
}
