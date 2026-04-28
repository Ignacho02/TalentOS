import type { PerformanceArea } from "@/lib/types";
import { getDataHubPerformanceArea } from "@/lib/maturation/selectors";

export type DataHubSection = "landing" | "club" | "maturation" | "performance";

export function resolveDataHubRouteState(
  tab: string | null,
  area: string | null,
): { section: DataHubSection; performanceArea: PerformanceArea } {
  if (tab === "anthropometric" || tab === "maturation") {
    return { section: "maturation", performanceArea: "physical" };
  }

  if (
    tab === "physical" ||
    tab === "technicalTactical" ||
    tab === "psychological" ||
    tab === "performance"
  ) {
    return {
      section: "performance",
      performanceArea: getDataHubPerformanceArea(tab, area),
    };
  }

  if (tab === "club") {
    return { section: "club", performanceArea: "physical" };
  }

  return { section: "landing", performanceArea: "physical" };
}
