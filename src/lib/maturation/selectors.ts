import type { Athlete, MaturationResult, PerformanceArea } from "@/lib/types";

export function getLatestAssessmentsByAthlete(assessments: MaturationResult[]) {
  const latest = new Map<string, MaturationResult>();

  for (const assessment of assessments) {
    const current = latest.get(assessment.inputs.athleteId);
    if (!current || current.inputs.dataCollectionDate < assessment.inputs.dataCollectionDate) {
      latest.set(assessment.inputs.athleteId, assessment);
    }
  }

  return Array.from(latest.values()).sort((a, b) =>
    a.inputs.athleteName.localeCompare(b.inputs.athleteName),
  );
}

export function getUniqueAthleteTeams(athletes: Athlete[]) {
  return Array.from(new Set(athletes.map((athlete) => athlete.teamName).filter(Boolean))) as string[];
}

export function getUniqueAthletePositions(athletes: Athlete[]) {
  return Array.from(
    new Set(athletes.map((athlete) => athlete.position).filter(Boolean)),
  ) as string[];
}

export function filterAssessmentsForDataHub({
  assessments,
  athletes,
  query,
  teamFilter,
  positionFilter,
  ageMin,
  ageMax,
  heightMin,
  heightMax,
}: {
  assessments: MaturationResult[];
  athletes: Athlete[];
  query: string;
  teamFilter: string;
  positionFilter: string;
  ageMin: number;
  ageMax: number;
  heightMin: number;
  heightMax: number;
}) {
  return assessments.filter((row) => {
    const athlete = athletes.find((candidate) => candidate.id === row.inputs.athleteId);
    const haystack = [
      row.inputs.athleteName,
      athlete?.teamName ?? row.inputs.teamName ?? "",
      athlete?.position ?? row.inputs.position ?? "",
    ]
      .join(" ")
      .toLowerCase();

    if (query && !haystack.includes(query.toLowerCase())) return false;
    if (teamFilter !== "all" && row.inputs.teamName !== teamFilter) return false;
    if (positionFilter !== "all" && (athlete?.position ?? row.inputs.position) !== positionFilter) {
      return false;
    }
    if (ageMin && row.derivedMetrics.chronologicalAge < ageMin) return false;
    if (ageMax && row.derivedMetrics.chronologicalAge > ageMax) return false;
    if (heightMin && row.inputs.statureCm < heightMin) return false;
    if (heightMax && row.inputs.statureCm > heightMax) return false;

    return true;
  });
}

export function getLatestParentHeightsByAthleteName(assessments: MaturationResult[]) {
  const latestParents = new Map<
    string,
    { motherHeightCm?: number | null; fatherHeightCm?: number | null; date: string }
  >();

  for (const assessment of assessments) {
    const existing = latestParents.get(assessment.inputs.athleteName);
    if (!existing || assessment.inputs.dataCollectionDate > existing.date) {
      latestParents.set(assessment.inputs.athleteName, {
        motherHeightCm: assessment.inputs.motherHeightCm,
        fatherHeightCm: assessment.inputs.fatherHeightCm,
        date: assessment.inputs.dataCollectionDate,
      });
    }
  }

  return latestParents;
}

export function getAssessmentsForTeam(
  assessments: MaturationResult[],
  teamName: string | undefined,
) {
  return assessments.filter((assessment) => assessment.inputs.teamName === teamName);
}

export function getAssessmentsForBand(
  assessments: MaturationResult[],
  maturityBand: MaturationResult["classification"]["maturityBand"] | undefined,
) {
  return assessments.filter(
    (assessment) => assessment.classification.maturityBand === maturityBand,
  );
}

export function getDataHubPerformanceArea(
  tab: string | null,
  area: string | null,
): PerformanceArea {
  if (tab === "physical" || tab === "technicalTactical" || tab === "psychological") {
    return tab;
  }

  if (tab === "performance" && area === "motorSkills") {
    return "motorSkills";
  }

  return "physical";
}
