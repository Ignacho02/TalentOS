"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ChartColumnBig,
  Database,
  FlaskConical,
  Globe2,
  LogOut,
  Orbit,
  Users,
  Search,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import { useAppState } from "@/lib/store/app-state";
import type { Locale } from "@/lib/types";
import { GlobalSearch } from "./command-palette";
import { useEffect } from "react";

interface NavItem {
  labelKey: string;
  href: string;
  hasSubmenu?: boolean;
  sections?: NavItem[];
}

const analysisAreas: NavItem[] = [
  { labelKey: "analysis.tabs.individual", href: "/analysis?tab=individual" },
  { labelKey: "analysis.tabs.collective", href: "/analysis?tab=collective" },
  { labelKey: "analysis.tabs.assistant", href: "/analysis?tab=assistant" },
];

const navigation = [
  { href: "/hub", key: "nav.hub", icon: Orbit },
  { href: "/datahub", key: "nav.datahub", icon: Database, hasSubmenu: true },
  { href: "/analysis", key: "nav.analysis", icon: ChartColumnBig, hasSubmenu: true },
  { href: "/community", key: "nav.community", icon: Users },
  { href: "/research", key: "nav.research", icon: FlaskConical },
];

const datahubAreas: NavItem[] = [
  { labelKey: "datahubNav.club", href: "/datahub?tab=club" },
  { labelKey: "datahubNav.maturation", href: "/datahub?tab=maturation" },
  {
    labelKey: "datahubNav.performance",
    hasSubmenu: true,
    href: "/datahub?tab=performance",
    sections: [
      {
        labelKey: "perfTab.tests",
        hasSubmenu: true,
        href: "/datahub?tab=performance",
        sections: [
          { labelKey: "datahub.performancePhysical", href: "/datahub?tab=physical" },
          { labelKey: "datahub.performanceTechnicalTactical", href: "/datahub?tab=technicalTactical" },
          { labelKey: "datahub.performancePsychological", href: "/datahub?tab=psychological" },
          { labelKey: "datahub.performanceMotorSkills", href: "/datahub?tab=performance&area=motorSkills" },
        ],
      },
      { labelKey: "perfTab.trainingLoad", href: "/datahub?tab=performance&view=trainingLoad" },
      { labelKey: "perfTab.gps", href: "/datahub?tab=performance&view=gps" },
    ],
  },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, setLocale: setLiveLocale, t } = useLocale();
  const { state, setLocale } = useAppState();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [activeSubMenu, setActiveSubMenu] = useState<string | null>(null);
  const [activeThirdLevel, setActiveThirdLevel] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function changeLocale(nextLocale: Locale) {
    setLiveLocale(nextLocale);
    setLocale(nextLocale);
  }

  return (
    <nav className="border-b border-line bg-white/95 backdrop-blur-sm sticky top-0 z-50" aria-label="Main navigation">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo/Nombre */}
          <div className="flex items-center gap-3">
            {state.club.badgeUrl && (
              <div suppressHydrationWarning>
                <img
                  src={state.club.badgeUrl}
                  alt={`${state.club.name} badge`}
                  className="h-10 w-10 object-contain rounded"
                  suppressHydrationWarning
                />
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                {t("common.appName")}
              </p>
              <p className="font-semibold text-zinc-900" suppressHydrationWarning>{state.club.name}</p>
            </div>
          </div>

          {/* Menú horizontal */}
          <div className="hidden md:flex items-center gap-1" role="menubar">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.includes("datahub");
              const hasSubmenu = item.hasSubmenu;

              return (
                <div
                  key={item.href}
                  className="relative"
                  role="none"
                  onMouseEnter={() => hasSubmenu && setActiveDropdown(item.href)}
                  onMouseLeave={() => {
                    setActiveDropdown(null);
                    setActiveSubMenu(null);
                    setActiveThirdLevel(null);
                  }}
                  onFocus={() => hasSubmenu && setActiveDropdown(item.href)}
                  onBlur={() => {
                    setActiveDropdown(null);
                    setActiveSubMenu(null);
                    setActiveThirdLevel(null);
                  }}
                >
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg transition",
                      active
                        ? "bg-accent/10 text-accent"
                        : "text-zinc-700 hover:bg-white/70",
                    )}
                    role="menuitem"
                    aria-haspopup={hasSubmenu ? "true" : undefined}
                    aria-expanded={hasSubmenu && activeDropdown === item.href ? "true" : undefined}
                  >
                    <Icon className="h-4 w-4" />
                    {t(item.key)}
                  </Link>

                  {/* Dropdown solo para items con submenu */}
                  {hasSubmenu && activeDropdown === item.href && (
                    <div
                      className="absolute top-full left-0 mt-0 w-56 bg-white border border-line rounded-lg shadow-lg"
                      role="menu"
                      aria-label={t(item.key)}
                    >
                      <div className="p-2">
                        {(item.href === "/datahub" ? datahubAreas : analysisAreas).map((area: NavItem) => (
                          <div
                            key={area.labelKey}
                            className="relative"
                            role="none"
                            onMouseEnter={() => area.hasSubmenu && setActiveSubMenu(area.labelKey)}
                            onMouseLeave={() => {
                              setActiveSubMenu(null);
                              setActiveThirdLevel(null);
                            }}
                            onFocus={() => area.hasSubmenu && setActiveSubMenu(area.labelKey)}
                            onBlur={() => {
                              setActiveSubMenu(null);
                              setActiveThirdLevel(null);
                            }}
                          >
                            {area.hasSubmenu ? (
                              <button
                                type="button"
                                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-zinc-700 hover:bg-accent/10 hover:text-accent rounded transition mb-1 last:mb-0"
                                role="menuitem"
                                aria-haspopup="true"
                                aria-expanded={activeSubMenu === area.labelKey ? "true" : undefined}
                              >
                                <span className="text-sm font-medium">{t(area.labelKey)}</span>
                                <span className="text-xs" aria-hidden="true">→</span>
                              </button>
                            ) : (
                              <Link
                                href={area.href ?? "/datahub"}
                                className="block px-4 py-3 text-sm text-zinc-700 hover:bg-accent/10 hover:text-accent rounded transition mb-1 last:mb-0"
                                role="menuitem"
                              >
                                <span className="text-sm font-medium">{t(area.labelKey)}</span>
                              </Link>
                            )}

                            {/* Submenú hacia la derecha (solo si tiene submenu) */}
                            {area.hasSubmenu && activeSubMenu === area.labelKey && (
                              <div
                                className="absolute left-full top-0 w-48 bg-white border border-line rounded-lg shadow-lg"
                                role="menu"
                                aria-label={t(area.labelKey)}
                              >
                                <div className="p-2">
                                  {area.sections?.map((section: NavItem) => (
                                    <div
                                      key={section.labelKey}
                                      className="relative"
                                      role="none"
                                      onMouseEnter={() => section.hasSubmenu && setActiveThirdLevel(section.labelKey)}
                                      onMouseLeave={() => setActiveThirdLevel(null)}
                                      onFocus={() => section.hasSubmenu && setActiveThirdLevel(section.labelKey)}
                                      onBlur={() => setActiveThirdLevel(null)}
                                    >
                                      {section.hasSubmenu ? (
                                        <button
                                          type="button"
                                          className="flex w-full items-center justify-between px-4 py-2 text-sm text-zinc-700 hover:bg-accent/10 hover:text-accent rounded transition"
                                          role="menuitem"
                                          aria-haspopup="true"
                                          aria-expanded={activeThirdLevel === section.labelKey ? "true" : undefined}
                                        >
                                          <span className="text-sm font-medium">{t(section.labelKey)}</span>
                                          <span className="text-xs" aria-hidden="true">→</span>
                                        </button>
                                      ) : (
                                        <Link
                                          href={section.href ?? "/datahub"}
                                          className="block px-4 py-2 text-sm text-zinc-700 hover:bg-accent/10 hover:text-accent rounded transition"
                                          role="menuitem"
                                        >
                                          <span className="text-sm font-medium">{t(section.labelKey)}</span>
                                        </Link>
                                      )}

                                      {/* Tercer nivel de submenú */}
                                      {section.hasSubmenu && activeThirdLevel === section.labelKey && (
                                        <div
                                          className="absolute left-full top-0 w-48 bg-white border border-line rounded-lg shadow-lg"
                                          role="menu"
                                          aria-label={t(section.labelKey)}
                                        >
                                          <div className="p-2">
                                            {section.sections?.map((subSection: NavItem) => (
                                              <Link
                                                key={subSection.labelKey}
                                                href={subSection.href}
                                                className="block px-4 py-2 text-sm text-zinc-700 hover:bg-accent/10 hover:text-accent rounded transition"
                                                role="menuitem"
                                              >
                                                <span className="text-sm font-medium">{t(subSection.labelKey)}</span>
                                              </Link>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Controles derechos */}
          <div className="flex items-center gap-2">
            {/* Buscador */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-2 rounded-full border border-line bg-white/70 text-zinc-500 hover:text-accent hover:bg-accent/5 transition flex items-center justify-center"
              aria-label={t("common.search")}
              title="Ctrl+K"
            >
              <Search className="h-4 w-4" />
            </button>

            <div className="hidden sm:inline-flex items-center gap-1 rounded-full border border-line bg-white/70 p-1" role="radiogroup" aria-label="Language selector">
              <div className="flex items-center gap-1 px-2 text-zinc-700">
                <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
              </div>
              {(["es", "en"] as Locale[]).map((item) => (
                <button
                  key={item}
                  className={cn(
                    "rounded-full px-2 py-1 text-xs font-medium transition",
                    locale === item ? "bg-accent text-white" : "text-zinc-500 hover:text-zinc-900",
                  )}
                  onClick={() => changeLocale(item)}
                  role="radio"
                  aria-checked={locale === item}
                >
                  {item.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-white/70 px-3 py-2 text-sm text-zinc-700 transition hover:bg-white"
              aria-label={t("common.logout")}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t("common.logout")}</span>
            </button>
          </div>
        </div>
      </div>
      <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </nav>
  );
}
