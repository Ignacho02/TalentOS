import type { PerformanceArea } from "@/lib/types";
import { getDataHubPerformanceArea } from "@/lib/maturation/selectors";

export type DataHubSection = "landing" | "club" | "maturation" | "performance";

export function resolveDataHubRouteState(
  tab: string | null,
  area: string | null,
  player?: string | null,
  playerArea?: string | null,
): {
  section: DataHubSection;
  performanceArea: PerformanceArea;
  expandedAthleteId: string | null;
  selectedPanel: { areaKey: PerformanceArea; athleteId: string } | null;
} {
  const PERF_AREAS: PerformanceArea[] = ["physical", "technicalTactical", "psychological", "motorSkills"];

  if (tab === "anthropometric" || tab === "maturation") {
    return {
      section: "maturation",
      performanceArea: "physical",
      expandedAthleteId: player ?? null,
      selectedPanel: null,
    };
  }

  if (
    tab === "physical" ||
    tab === "technicalTactical" ||
    tab === "psychological" ||
    tab === "performance"
  ) {
    const perfArea = getDataHubPerformanceArea(tab, area);
    const resolvedPlayerArea: PerformanceArea =
      playerArea && PERF_AREAS.includes(playerArea as PerformanceArea)
        ? (playerArea as PerformanceArea)
        : perfArea;

    return {
      section: "performance",
      performanceArea: perfArea,
      expandedAthleteId: null,
      selectedPanel:
        player
          ? { areaKey: resolvedPlayerArea, athleteId: player }
          : null,
    };
  }

  if (tab === "club") {
    return { section: "club", performanceArea: "physical", expandedAthleteId: null, selectedPanel: null };
  }

  return { section: "landing", performanceArea: "physical", expandedAthleteId: null, selectedPanel: null };
}