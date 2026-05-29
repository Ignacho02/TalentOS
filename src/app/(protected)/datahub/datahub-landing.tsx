"use client";

import Link from "next/link";
import { ArrowRight, Building2, Dumbbell } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";

const sections = [
  {
    id: "club",
    href: "/datahub?tab=club",
    icon: Building2,
    titleKey: "datahubNav.club",
    descriptionKey: "datahub.sectionBodyClub",
    color: "bg-blue-500",
    softColor: "bg-blue-100",
    textColor: "text-blue-600",
  },
  {
    id: "sports",
    href: "/datahub?tab=maturation",
    icon: Dumbbell,
    titleKey: "datahubNav.sports",
    descriptionKey: "datahub.sectionBodySports",
    color: "bg-purple-500",
    softColor: "bg-purple-100",
    textColor: "text-purple-600",
  },
];

export function DataHubLanding() {
  const { t } = useLocale();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          {t("datahub.landingTitle")}
        </h1>
        <p className="text-lg text-zinc-600">
          {t("datahub.landingSubtitle")}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.id}
              href={section.href}
              className="group relative overflow-hidden rounded-2xl border border-line bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft">
                <Icon className={`h-7 w-7 ${section.textColor}`} />
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
                {t(section.titleKey)}
              </h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                {t(section.descriptionKey)}
              </p>
              <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-accent">
                {t("common.open")}{" "}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
