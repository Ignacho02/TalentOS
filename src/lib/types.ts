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
}

export interface DerivedMetrics {
  chronologicalAge: number;
  legLengthCm: number;
}

export interface MaturationResult {
  inputs: AnthropometricRecord;
  derivedMetrics: DerivedMetrics;
  methodOutputs: MethodOutputs;
  classification: {
    maturityBand: MaturityBand;
    primaryOffset: number;
  };
  warnings: string[];
  algorithmVersion: string;
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

export interface ClubUser {
  id: string;
  clubId: string;
  name: string;
  email: string;
  role: ClubUserRole;
  /** Team IDs this user can manage (only relevant for role "user") */
  assignedTeamIds: string[];
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
  /** The current logged-in user's club role (simulated; in production comes from Supabase auth metadata) */
  currentUserRole: ClubUserRole;
  /** Current user's assigned team IDs (empty means all, only relevant for role "user") */
  currentUserTeamIds: string[];
}