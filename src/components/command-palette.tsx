"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Search, X, User, Users, FlaskConical, LayoutGrid, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/locale-context";
import { useAppState } from "@/lib/store/app-state";
import { cn } from "@/lib/utils";
import type { Athlete, Team, PerformanceDefinition } from "@/lib/types";

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: "athlete" | "team" | "test" | "area";
  href: string;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const router = useRouter();
  const { t } = useLocale();
  const { state } = useAppState();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter logic
  const filteredResults = useCallback(() => {
    if (!query.trim()) return [];

    const q = query.toLowerCase();
    const results: SearchResult[] = [];

    // Areas
    const areas: SearchResult[] = [
      { id: "hub", title: t("nav.hub"), type: "area", href: "/hub" },
      { id: "datahub", title: t("nav.datahub"), type: "area", href: "/datahub" },
      { id: "analysis", title: t("nav.analysis"), type: "area", href: "/analysis" },
      { id: "community", title: t("nav.community"), type: "area", href: "/community" },
      { id: "research", title: t("nav.research"), type: "area", href: "/research" },
    ];

    areas.forEach((area) => {
      if (area.title.toLowerCase().includes(q)) {
        results.push(area);
      }
    });

    // Athletes
    state.athletes.forEach((a: Athlete) => {
      if (a.name.toLowerCase().includes(q) || (a.position && a.position.toLowerCase().includes(q))) {
        results.push({
          id: `athlete-${a.id}`,
          title: a.name,
          subtitle: a.teamName || t("datahub.noTeam"),
          type: "athlete",
          href: `/datahub?tab=club&view=plantilla&player=${a.id}`,
        });
      }
    });

    // Teams
    state.teams.forEach((team: Team) => {
      if (team.name.toLowerCase().includes(q)) {
        results.push({
          id: `team-${team.id}`,
          title: team.name,
          subtitle: team.ageGroup,
          type: "team",
          href: `/datahub?tab=club&view=teams&id=${team.id}`,
        });
      }
    });

    // Tests
    state.performanceDefinitions.forEach((def: PerformanceDefinition) => {
      const name = def.nameKey ? t(def.nameKey) : def.name;
      if (name.toLowerCase().includes(q)) {
        results.push({
          id: `test-${def.id}`,
          title: name,
          subtitle: t(`datahub.${def.area}`),
          type: "test",
          href: `/datahub?tab=club&view=testBattery&id=${def.id}&area=${def.area}`,
        });
      }
    });

    return results.slice(0, 10);
  }, [query, state, t]);

  const results = filteredResults();

  // Keyboard navigation and outside click
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(results.length, 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % Math.max(results.length, 1));
      } else if (e.key === "Enter") {
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("mousedown", handleClickOutside);
    }
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, results, selectedIndex, onClose]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setSelectedIndex(0);
      setQuery("");
    }
  }, [isOpen]);

  const handleSelect = (result: SearchResult) => {
    router.push(result.href);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      ref={containerRef}
      className="fixed top-20 right-6 z-[100] w-full max-w-sm animate-in fade-in slide-in-from-top-4 duration-200"
    >
      {/* Search Bar Container */}
      <div className="bg-white rounded-xl shadow-2xl border border-line overflow-hidden flex flex-col max-h-[60vh]">
        {/* Search Input */}
        <div className="flex items-center px-3 py-3 border-b border-line gap-2">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-900 placeholder:text-zinc-400"
            placeholder={t("datahub.searchPlayerTeamTest")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button 
            onClick={onClose}
            className="p-1 hover:bg-zinc-100 rounded-lg transition text-zinc-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results Dropdown */}
        {query.trim() !== "" && (
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-1"
          >
            {results.length > 0 ? (
              <div className="space-y-0.5">
                {results.map((result, index) => {
                  const Icon = {
                    athlete: User,
                    team: Users,
                    test: FlaskConical,
                    area: LayoutGrid
                  }[result.type];

                  return (
                    <button
                      key={result.id}
                      className={cn(
                        "w-full flex items-center justify-between p-2 rounded-lg transition-all",
                        index === selectedIndex 
                          ? "bg-accent text-white" 
                          : "hover:bg-zinc-50 text-zinc-700"
                      )}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={cn(
                          "h-3.5 w-3.5",
                          index === selectedIndex ? "text-white" : "text-accent"
                        )} />
                        <div className="text-left">
                          <p className="font-medium text-xs">{result.title}</p>
                          {result.subtitle && (
                            <p className={cn(
                              "text-[10px]",
                              index === selectedIndex ? "text-white/80" : "text-zinc-500"
                            )}>
                              {result.subtitle}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center">
                <p className="text-xs text-zinc-500">{t("datahub.noMatches")}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}