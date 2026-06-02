"use client";

import { ArrowRight, Building2, Dumbbell } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";

const sections = [
  {
    id: "club",
    href: "/datahub?tab=club",
    icon: Building2,
    titleKey: "datahubNav.club",
    descriptionKey: "datahub.sectionBodyClub",
    color: "bg-blue-50 text-blue-600 border border-blue-100",
  },
  {
    id: "sports",
    href: "/datahub?tab=maturation",
    icon: Dumbbell,
    titleKey: "datahubNav.sports",
    descriptionKey: "datahub.sectionBodySports",
    color: "bg-purple-50 text-purple-600 border border-purple-100",
  },
];

export function DataHubLanding({ onSelect }: { onSelect: (section: "club" | "sports") => void }) {
  const { t } = useLocale();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {t("datahub.landingTitle")}
        </h1>
        <p className="mt-1 text-slate-500">
          {t("datahub.landingSubtitle")}
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSelect(section.id as "club" | "sports")}
              className="group flex flex-col items-start p-8 bg-white rounded-2xl border border-slate-200 shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all text-left"
            >
              <div className={`p-4 rounded-2xl mb-6 transition-transform group-hover:scale-105 ${section.color}`}>
                <Icon className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                {t(section.titleKey)}
              </h3>
              <p className="text-slate-500 leading-relaxed">
                {t(section.descriptionKey)}
              </p>
              <div className="mt-8 flex items-center gap-2 text-sm font-bold text-slate-900 group-hover:translate-x-1 transition-transform">
                {t("common.open")}
                <ArrowRight className="h-4 w-4" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}