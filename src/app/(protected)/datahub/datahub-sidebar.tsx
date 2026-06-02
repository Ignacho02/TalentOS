"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/locale-context";
import { Building2, Dumbbell, Menu, X } from "lucide-react";

const sections = [
  { id: "club" as const, icon: Building2, key: "datahubNav.club" },
  { id: "sports" as const, icon: Dumbbell, key: "datahubNav.sports" },
];

export function DataHubSidebar({
  activeSection,
  onSelect,
}: {
  activeSection: "club" | "sports" | "landing";
  onSelect: (section: "club" | "sports" | "landing") => void;
}) {
  const { t } = useLocale();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile overlay on resize to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function handleSelect(section: "club" | "sports" | "landing") {
    onSelect(section);
    setMobileOpen(false);
  }

  const navItems = (
    <div className="p-2 space-y-1">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => { setCollapsed((p) => !p); setMobileOpen(false); }}
        className="hidden md:flex w-full items-center justify-center rounded-xl px-2 py-3 text-zinc-500 hover:bg-zinc-100 transition"
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
                active ? "bg-accent text-white" : "text-zinc-600 hover:bg-zinc-100",
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{t(item.key)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile trigger button — hidden on landing */}
      {activeSection !== "landing" && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="md:hidden fixed bottom-4 right-4 z-40 flex items-center justify-center w-12 h-12 rounded-full bg-accent text-white shadow-lg active:scale-95 transition"
          aria-label="Abrir navegación"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <div
        className={cn(
          "md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl border-r border-line transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-hidden={!mobileOpen}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-line">
          <span className="text-sm font-semibold text-zinc-700">DataHub</span>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 transition"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="p-3 space-y-1">
          {sections.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition",
                  active ? "bg-accent text-white" : "text-zinc-600 hover:bg-zinc-100",
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span>{t(item.key)}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Desktop sidebar */}
      <nav
        className={cn(
          "hidden md:flex flex-col border-r border-line bg-white/95 flex-shrink-0 transition-all duration-200 ease-in-out",
          collapsed ? "w-14" : "w-56",
        )}
        aria-label="DataHub sections"
      >
        {navItems}
      </nav>
    </>
  );
}