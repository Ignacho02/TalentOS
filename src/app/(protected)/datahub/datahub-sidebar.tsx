"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/locale-context";
import { Building2, Brain, Dumbbell, Menu } from "lucide-react";

const sections = [
  { id: "club" as const, icon: Building2, key: "datahubNav.club", tab: "club" },
  { id: "maturation" as const, icon: Brain, key: "datahubNav.maturation", tab: "maturation" },
  { id: "performance" as const, icon: Dumbbell, key: "datahubNav.performance", tab: "performance" },
];

export function DataHubSidebar({
  activeSection,
  onSelect,
}: {
  activeSection: "club" | "maturation" | "performance" | "landing";
  onSelect: (section: "club" | "maturation" | "performance" | "landing") => void;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  function handleSelect(section: "club" | "maturation" | "performance" | "landing") {
    onSelect(section);
    if (section === "landing") {
      router.push("/datahub");
    } else {
      const area = sections.find((s) => s.id === section);
      if (area) {
        router.push(`/datahub?tab=${area.tab}`);
      }
    }
  }

  return (
    <nav
      className={cn(
        "border-r border-line bg-white/95 flex-shrink-0 transition-all duration-200 ease-in-out",
        collapsed ? "w-14" : "w-56",
      )}
      aria-label="DataHub sections"
    >
      <div className="p-2 space-y-1">
        {/* Hamburger toggle */}
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="w-full flex items-center justify-center rounded-xl px-2 py-3 text-zinc-500 hover:bg-zinc-100 transition"
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="border-t border-line pt-2">
          {sections.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                title={collapsed ? t(item.key) : undefined}
                className={cn(
                  "w-full flex items-center rounded-xl py-3 text-sm font-medium transition",
                  collapsed ? "justify-center px-2" : "gap-3 px-4",
                  active
                    ? "bg-accent text-white"
                    : "text-zinc-600 hover:bg-zinc-100",
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{t(item.key)}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}