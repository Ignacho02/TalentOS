"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
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
  Menu,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import { useAppState } from "@/lib/store/app-state";
import type { Locale } from "@/lib/types";
import { GlobalSearch } from "./command-palette";

interface NavItem {
  labelKey: string;
  href: string;
  hasSubmenu?: boolean;
  sections?: NavItem[];
}

const analysisAreas: NavItem[] = [
  { labelKey: "analysis.tabs.individual", href: "/analysis?tab=individual" },
  { labelKey: "analysis.tabs.collective", href: "/analysis?tab=collective" },
  { labelKey: "analysis.tabs.intelligence", href: "/analysis?tab=intelligence" },
];

const navigation = [
  { href: "/hub", key: "nav.hub", icon: Orbit },
  { href: "/datahub", key: "nav.datahub", icon: Database, hasSubmenu: true },
  { href: "/analysis", key: "nav.analysis", icon: ChartColumnBig, hasSubmenu: true },
  { href: "/community", key: "nav.community", icon: Users },
  { href: "/research", key: "nav.research", icon: FlaskConical },
];

const datahubAreas: NavItem[] = [
  {
    labelKey: "datahubNav.club",
    href: "/datahub?tab=club",
    hasSubmenu: true,
    sections: [
      { labelKey: "club.structure", href: "/datahub?tab=club&view=plantilla" },
      { labelKey: "club.settings",  href: "/datahub?tab=club&view=admin" },
    ],
  },
  {
    labelKey: "datahubNav.sports",
    href: "/datahub?tab=maturation",
    hasSubmenu: true,
    sections: [
      { labelKey: "datahubNav.maturation", href: "/datahub?tab=maturation" },
      {
        labelKey: "datahubNav.performance",
        href: "/datahub?tab=performance",
        hasSubmenu: true,
        sections: [
          { labelKey: "club.testBattery",      href: "/datahub?tab=performance&view=testBattery" },
          { labelKey: "perfTab.tests",         href: "/datahub?tab=performance&view=tests" },
          { labelKey: "perfTab.trainingLoad",  href: "/datahub?tab=performance&view=trainingLoad" },
        ],
      },
    ],
  },
];

const mobileNav = [
  { href: "/hub", key: "nav.hub", icon: Orbit, children: null },
  {
    href: "/datahub",
    key: "nav.datahub",
    icon: Database,
    children: [
      { href: "/datahub?tab=club&view=plantilla",           key: "club.structure" },
      { href: "/datahub?tab=club&view=admin",               key: "club.settings" },
      { href: "/datahub?tab=maturation",                    key: "datahubNav.maturation" },
      { href: "/datahub?tab=performance&view=testBattery",  key: "club.testBattery" },
      { href: "/datahub?tab=performance&view=tests",        key: "perfTab.tests" },
      { href: "/datahub?tab=performance&view=trainingLoad", key: "perfTab.trainingLoad" },
    ],
  },
  {
    href: "/analysis",
    key: "nav.analysis",
    icon: ChartColumnBig,
    children: [
      { href: "/analysis?tab=individual", key: "analysis.tabs.individual" },
      { href: "/analysis?tab=collective", key: "analysis.tabs.collective" },
      { href: "/analysis?tab=intelligence",  key: "analysis.tabs.intelligence" },
    ],
  },
  { href: "/community", key: "nav.community", icon: Users,        children: null },
  { href: "/research",  key: "nav.research",  icon: FlaskConical, children: null },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, setLocale: setLiveLocale, t } = useLocale();
  const { state, setLocale } = useAppState();
  const [activeDropdown,   setActiveDropdown]  = useState<string | null>(null);
  const [activeSubMenu,    setActiveSubMenu]    = useState<string | null>(null);
  const [activeThirdLevel, setActiveThirdLevel] = useState<string | null>(null);
  const [isSearchOpen,     setIsSearchOpen]     = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileExpanded,   setMobileExpanded]   = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setMobileExpanded(null);
  }, [pathname]);

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

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isMobileMenuOpen]);

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
    <>
      <nav
        ref={navRef}
        className="border-b border-line bg-white/95 backdrop-blur-sm sticky top-0 z-50"
        aria-label="Main navigation"
      >
        <div className="px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">

            {/* ── Logo ── */}
            <Link href="/hub" className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink-0">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:h-10 sm:w-10">
                <Image
                  src="/talentos-mark.png"
                  alt="TalentOS logo"
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                  priority
                />
              </div>
              <p className="font-bold tracking-wide leading-none">
                <span className="text-lg text-zinc-900">Talent</span><span className="text-xl text-accent">OS</span>
              </p>
            </Link>

            {/* ── Desktop nav ── */}
            <div className="hidden md:flex items-center gap-1 flex-1 justify-center" role="menubar">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(item.href.split("?")[0]);
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
                        "flex items-center gap-2 px-3 lg:px-4 py-2.5 text-sm font-medium rounded-lg transition",
                        active ? "bg-accent/10 text-accent" : "text-zinc-700 hover:bg-zinc-50",
                      )}
                      role="menuitem"
                      aria-haspopup={hasSubmenu ? "true" : undefined}
                      aria-expanded={hasSubmenu && activeDropdown === item.href ? "true" : undefined}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="hidden lg:inline">{t(item.key)}</span>
                    </Link>

                    {/* ── Nivel 1 ── */}
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
                              onMouseEnter={() => {
                                setActiveSubMenu(area.hasSubmenu ? area.labelKey : null);
                                setActiveThirdLevel(null);
                              }}
                              onMouseLeave={() => {
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
                                  <ChevronRight className="h-3.5 w-3.5 opacity-40 flex-shrink-0 ml-2" aria-hidden="true" />
                                </button>
                              ) : (
                                <Link
                                  href={area.href}
                                  className="block px-4 py-3 text-sm text-zinc-700 hover:bg-accent/10 hover:text-accent rounded transition mb-1 last:mb-0"
                                  role="menuitem"
                                >
                                  <span className="text-sm font-medium">{t(area.labelKey)}</span>
                                </Link>
                              )}

                              {/* ── Nivel 2 ── */}
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
                                        onMouseEnter={() => setActiveThirdLevel(section.hasSubmenu ? section.labelKey : null)}
                                        onMouseLeave={() => setActiveThirdLevel(null)}
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
                                            <ChevronRight className="h-3.5 w-3.5 opacity-40 flex-shrink-0 ml-2" aria-hidden="true" />
                                          </button>
                                        ) : (
                                          <Link
                                            href={section.href}
                                            className="block px-4 py-2 text-sm text-zinc-700 hover:bg-accent/10 hover:text-accent rounded transition"
                                            role="menuitem"
                                          >
                                            <span className="text-sm font-medium">{t(section.labelKey)}</span>
                                          </Link>
                                        )}

                                        {/* ── Nivel 3 ── */}
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

            {/* ── Right controls ── */}
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
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
                {(["es", "en"] as Locale[]).map((lang) => (
                  <button
                    key={lang}
                    className={cn("rounded-full px-2 py-1 text-xs font-medium transition", locale === lang ? "bg-accent text-white" : "text-zinc-500 hover:text-zinc-900")}
                    onClick={() => changeLocale(lang)}
                    role="radio"
                    aria-checked={locale === lang}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>

              <button
                onClick={logout}
                className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-line bg-white/70 px-3 py-2 text-sm text-zinc-700 transition hover:bg-white"
                aria-label={t("common.logout")}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span className="hidden lg:inline">{t("common.logout")}</span>
              </button>

              <button
                className="md:hidden p-2 rounded-lg border border-line bg-white/70 text-zinc-700 hover:bg-white transition"
                onClick={() => setIsMobileMenuOpen((v) => !v)}
                aria-label={isMobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* ── Mobile drawer ── */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-line bg-white overflow-y-auto max-h-[calc(100dvh-4rem)]">
            <div className="px-4 py-3 space-y-1">
              {mobileNav.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(item.href.split("?")[0]);
                const hasChildren = !!item.children?.length;
                const isExpanded = mobileExpanded === item.href;

                return (
                  <div key={item.href}>
                    <div className="flex items-center">
                      <Link
                        href={item.href}
                        className={cn(
                          "flex-1 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition",
                          active ? "bg-accent/10 text-accent" : "text-zinc-700 hover:bg-zinc-100",
                        )}
                        onClick={() => !hasChildren && setIsMobileMenuOpen(false)}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        {t(item.key)}
                      </Link>
                      {hasChildren && (
                        <button
                          type="button"
                          onClick={() => setMobileExpanded(isExpanded ? null : item.href)}
                          className="p-3 rounded-xl text-zinc-400 hover:bg-zinc-100 transition"
                          aria-label={isExpanded ? "Colapsar" : "Expandir"}
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      )}
                    </div>

                    {hasChildren && isExpanded && (
                      <div className="ml-5 mt-1 mb-1 pl-4 border-l-2 border-accent/20 space-y-0.5">
                        {item.children!.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className="block px-4 py-2.5 rounded-lg text-sm text-zinc-600 hover:bg-zinc-100 hover:text-accent transition"
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            {t(child.key)}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Bottom actions */}
              <div className="border-t border-line pt-3 mt-2 space-y-1">
                <div className="flex items-center gap-3 px-4 py-2">
                  <Globe2 className="h-4 w-4 text-zinc-500 flex-shrink-0" />
                  <span className="text-sm text-zinc-500">{t("common.language") || "Idioma"}</span>
                  <div className="flex gap-1 ml-auto">
                    {(["es", "en"] as Locale[]).map((lang) => (
                      <button
                        key={lang}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-medium transition",
                          locale === lang ? "bg-accent text-white" : "border border-line text-zinc-600",
                        )}
                        onClick={() => changeLocale(lang)}
                      >
                        {lang.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition"
                >
                  <LogOut className="h-5 w-5 flex-shrink-0" />
                  {t("common.logout")}
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/20 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
