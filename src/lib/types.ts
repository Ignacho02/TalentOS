export type Locale = "es" | "en";

export type Sex = "male" | "female";

export type MaturityBand = "Pre-PHV" | "Mid-PHV" | "Post-PHV";

export type ModuleStatus = "live" | "beta" | "coming_soon";

export type PerformanceArea = "physical" | "technicalTactical" | "psychological" | "motorSkills";

export interface Club {
  id: string;
  name: string;
  region: string;
  sport?: "football" | "futsal";
  accentColor?: string;
  badgeUrl?: string;
}

export interface Team {
  id: string;
  clubId: string;
  name: string;
  ageGroup: string;
  photoUrl?: string | null;
}

export interface Athlete {
  id: string;
  clubId: string;
  teamId?: string;
  name: string;
  sex: Sex;
  ageGroup: string;
  clubName: string;
  teamName?: string;
  position?: string;
  dob: string;
  photoUrl?: string | null;
  displayOrder?: number;
  category?: string;
}

export interface AnthropometricRecordInput {
  athleteId?: string;
  athleteName: string;
  sex: Sex;
  ageGroup: string;
  clubName: string;
  teamName?: string;
  position?: string;
  dob: string;
  dataCollectionDate: string;
  statureCm: number;
  bodyMassKg: number;
  sittingHeightCm: number;
  motherHeightCm?: number | null;
  fatherHeightCm?: number | null;
}

export interface AnthropometricRecord extends AnthropometricRecordInput {
  id: string;
  athleteId: string;
  createdAt: string;
}

export interface MethodOutputs {
  pahCm: number | null;
  percentageAdultHeight: number | null;
  maturityZScore: number | null;
  mirwaldOffset: number;
  mirwaldAphv: number;
  mooreOffset: number;
  mooreAphv: number;
  fransenRatio: number | null;
  fransenAphv: number | null;
  fransenOffset: number | null;
  kozielMalinaPahCm: number | null;
  kozielMalinaPercentageAdultHeight: number | null;
  sherarOffset: number | null;
}

export interface DerivedMetrics {
  chronologicalAge: number;
  legLengthCm: number;
  sittingHeightRatio: number;
  growthVelocityCmPerYear: number | null;
}

export interface SitarOutputs {
  sitarAphv: number;
  sitarPhv: number;
  sitarPah: number;
  sitarActive: boolean;
}

export interface MaturationResult {
  inputs: AnthropometricRecord;
  derivedMetrics: DerivedMetrics;
  methodOutputs: MethodOutputs;
  sitarOutputs?: SitarOutputs;
  classification: {
    maturityBand: MaturityBand;
    pahBand: "≤ 85%" | "85-90%" | "90-95%" | "≥ 95%";
    primaryOffset: number;
    whoBmiZScore: number | null;
  };
  warnings: string[];
  algorithmVersion: string;
}

/**
 * CONCEPT-CENTRIC: Single unified maturity profile derived from ONE active engine
 * Prevents scientific redundancy (multiple APHV/Offset representations)
 * All metrics auto-derived from selected engine
 */
export interface UnifiedMaturityProfile {
  // Engine selection (never mix multiple methods simultaneously)
  selectedEngine: "auto" | "fransen" | "sherar" | "moore" | "mirwald" | "consensus";
  
  // Primary biological metrics (derived from selected engine)
  aphv: number | null;           // Age at peak height velocity
  offset: number | null;          // Offset from PHV (maturation status)
  maturityBand: MaturityBand;     // Pre/Mid/Post-PHV classification
  
  // PAH metrics
  pah: number | null;             // Predicted adult height
  pahPercentage: number | null;   // % of predicted adult height
  pahBand: "≤ 85%" | "85-90%" | "90-95%" | "≥ 95%";
  
  // Bio-banding strategy (how to group athletes)
  bioBandingStrategy: "offset" | "pah";  // Which metric drives grouping
  
  // Method label for display ("fransen", "auto", "consensus", etc)
  methodLabel: string;
  methodYear?: number;
  
  // Advanced: alternative methods (only shown if user enables)
  alternativeMethods?: Array<{
    engine: "fransen" | "sherar" | "moore" | "mirwald" | "consensus";
    aphv: number | null;
    offset: number | null;
    methodLabel: string;
  }>;
  
  // Source data
  result: MaturationResult;
  athleteSex: Sex;
}

export interface ImportRowResult {
  rowNumber: number;
  status: "accepted" | "rejected";
  message: string;
  normalized?: AnthropometricRecordInput;
}

export interface DashboardInsight {
  id: string;
  tone: "info" | "warning" | "success";
  titleKey: string;
  bodyKey: string;
}

export interface PerformanceEntryInput {
  athleteId?: string;
  athleteName: string;
  area: PerformanceArea;
  teamName?: string;
  position?: string;
  testName: string;
  unit: string;
  value: number;
  measurementDate: string;
  notes?: string;
  ratingLevel?: string;
  ratingValue?: number;
  attemptCount?: number;
  description?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
}

export interface PerformanceEntry extends PerformanceEntryInput {
  id: string;
  athleteId: string;
  createdAt: string;
}

export interface UserPreferences {
  locale: Locale;
}

export interface TrainingLoadEntry {
  id: string;
  athleteId: string;
  date: string;
  attended: boolean;
  sessionType: "training" | "match";
  minutesPlayed: number;
  rpe: number;
  load: number;
  notes?: string;
}

export interface PerformanceDefinition {
  id: string;
  name: string;
  nameKey?: string;
  area: PerformanceArea;
  unit: string;
  attempts: number;
  isRating: boolean;
  scoringStrategy: "best" | "average";
  interpretation: "higher_better" | "lower_better";
  description?: string;
  descriptionKey?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
}

export type ClubTab = "teams" | "players" | "testBattery" | "admin";

export type ClubUserRole = "admin" | "user";

/**
 * Permisos granulares de edición para usuarios con role "user".
 * Los admins siempre tienen todos los permisos; estos campos se ignoran para ellos.
 */
export interface ClubUserPermissions {
  /** Puede añadir/editar jugadores en sus equipos asignados */
  canEditAthletes: boolean;
  /** Puede añadir/editar mediciones antropométricas */
  canEditAnthropometry: boolean;
  /** Puede añadir/editar entradas de rendimiento y tests */
  canEditPerformance: boolean;
  /** Puede añadir/editar registros de carga de entrenamiento */
  canEditTrainingLoad: boolean;
}

export const DEFAULT_USER_PERMISSIONS: ClubUserPermissions = {
  canEditAthletes: true,
  canEditAnthropometry: true,
  canEditPerformance: true,
  canEditTrainingLoad: true,
};

export interface ClubUser {
  id: string;
  clubId: string;
  name: string;
  email: string;
  role: ClubUserRole;
  /** Team IDs this user can see. Empty array = all teams. */
  assignedTeamIds: string[];
  permissions: ClubUserPermissions;
  createdAt: string;
}

export interface AppState {
  club: Club;
  teams: Team[];
  athletes: Athlete[];
  records: AnthropometricRecord[];
  performanceEntries: PerformanceEntry[];
  trainingLoadEntries: TrainingLoadEntry[];
  performanceDefinitions: PerformanceDefinition[];
  preferences: UserPreferences;
  /** Club users list (managed by admin) */
  clubUsers: ClubUser[];
  /** The current logged-in user's club role */
  currentUserRole: ClubUserRole;
  /** Current user's assigned team IDs (empty = all teams) */
  currentUserTeamIds: string[];
  /** Current user's granular permissions */
  currentUserPermissions: ClubUserPermissions;
}