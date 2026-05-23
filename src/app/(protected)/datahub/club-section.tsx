"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";
import { createPortal } from "react-dom";
import { useSearchParams, useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { useLocale } from "@/lib/i18n/locale-context";
import { useAppState } from "@/lib/store/app-state";
import { cn } from "@/lib/utils";
import { Beaker, Plus, Trash2, Users, Palette, Shield, Edit2, Search, X, Check, User, BarChart2, Activity, ChevronRight, ChevronDown, FileSpreadsheet, UploadCloud, Eye, Play, FileText, Zap, Brain, Target, Dumbbell } from "lucide-react";
import type { PerformanceArea, PerformanceDefinition, ClubUser, ClubUserRole, ClubUserPermissions } from "@/lib/types";
import { DEFAULT_USER_PERMISSIONS } from "@/lib/types";
import { performancePresets, performanceAreaLabels } from "./performance-constants";
import { FormErrorBanner } from "@/components/form-error-banner";
import { FieldError, invalidInputClass } from "@/components/field-error";
import {
  createClubUserAction,
  updateClubUserAction,
  deleteClubUserAction,
} from "@/lib/actions/club-users";
import {
  clearFieldError,
  validateClubAthlete,
  validateClubTeam,
  validateTestDefinition,
  type FieldErrors,
} from "@/lib/form-errors";

function clubInputClass(hasError: boolean, extra?: string) {
  return cn(
    "w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-accent/50 font-sans",
    hasError ? invalidInputClass : "border-line",
    extra,
  );
}

const areaStyles: Record<string, {
  icon: React.ElementType;
  chipClass: string;
  badgeClass: string;
  iconClass: string;
}> = {
  physical: {
    icon: Zap,
    chipClass: "border-orange-200 bg-orange-50 text-orange-800 hover:border-orange-400 hover:bg-orange-100",
    badgeClass: "bg-orange-100 text-orange-700",
    iconClass: "text-orange-500",
  },
  technicalTactical: {
    icon: Target,
    chipClass: "border-blue-200 bg-blue-50 text-blue-800 hover:border-blue-400 hover:bg-blue-100",
    badgeClass: "bg-blue-100 text-blue-700",
    iconClass: "text-blue-500",
  },
  psychological: {
    icon: Brain,
    chipClass: "border-purple-200 bg-purple-50 text-purple-800 hover:border-purple-400 hover:bg-purple-100",
    badgeClass: "bg-purple-100 text-purple-700",
    iconClass: "text-purple-500",
  },
  motorSkills: {
    icon: Dumbbell,
    chipClass: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400 hover:bg-emerald-100",
    badgeClass: "bg-emerald-100 text-emerald-700",
    iconClass: "text-emerald-500",
  },
};

function downloadSheet(filename: string, rows: Array<Record<string, unknown>>, sheet: string) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheet);
  XLSX.writeFile(workbook, filename);
}

export function ClubSection({ canEditAthletes = true }: { canEditAthletes?: boolean }) {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { state, addTeam, updateTeam, deleteTeam, addAthlete, updateAthlete, deleteAthlete, updateClub, addPerformanceDefinition, updatePerformanceDefinition, deletePerformanceDefinition, addClubUser, updateClubUser, deleteClubUser } = useAppState();
  
  const [activeTab, setActiveTab] = usePersistentState<"plantilla" | "testBattery" | "admin">("datahub_club_active_tab_v2", "plantilla");
  const [structureSubTab, setStructureSubTab] = usePersistentState<"teams" | "players">("datahub_club_sub_tab", "players");
  const [testBatteryArea, setTestBatteryArea] = usePersistentState<PerformanceArea>("datahub_club_test_battery_area", "physical");
  const [selectedTeamId, setSelectedTeamId] = usePersistentState<string | null>("datahub_club_selected_team_id", null);
  const [selectedAthleteId, setSelectedAthleteId] = usePersistentState<string | null>("datahub_club_selected_athlete_id", null);
  const [showAddTestForm, setShowAddTestForm] = useState(false);
  const [testDefErrors, setTestDefErrors] = useState<FieldErrors>({});
  const [testDefSummary, setTestDefSummary] = useState("");
  const [newDef, setNewDef] = useState({ name: "", nameKey: undefined as string | undefined, descriptionKey: undefined as string | undefined, unit: "", attempts: 1, isRating: false, scoringStrategy: "best" as "best" | "average", interpretation: "higher_better" as "higher_better" | "lower_better", description: "", mediaUrl: "", mediaType: undefined as "image" | "video" | undefined, subCategory: undefined as string | undefined });
  const [selectedDef, setSelectedDef] = usePersistentState<PerformanceDefinition | null>("datahub_club_selected_def", null);

  // Keep track of the initial mount phase to prevent usePersistentState lazy-load state updates from triggering fake transitions.
  const isMountedRef = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      isMountedRef.current = true;
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Clear sub-sub-area selections only when transitioning between sub-tabs or sub-sub-tabs.
  // This does not clear on initial load/refresh because prev variables start as null and we verify isMountedRef.
  const prevActiveTabRef = useRef<string | null>(null);
  useEffect(() => {
    const currentTab = activeTab;
    const prevTab = prevActiveTabRef.current;
    if (isMountedRef.current && prevTab !== null && prevTab !== currentTab) {
      setSelectedAthleteId(null);
      setSelectedTeamId(null);
      setSelectedDef(null);
      // Restore default sub-sub tab views when changing main tabs
      setStructureSubTab("players");
      setTestBatteryArea("physical");
    }
    prevActiveTabRef.current = currentTab;
  }, [activeTab, setStructureSubTab, setTestBatteryArea]);

  const prevStructureSubTabRef = useRef<string | null>(null);
  useEffect(() => {
    const currentSub = structureSubTab;
    const prevSub = prevStructureSubTabRef.current;
    if (isMountedRef.current && prevSub !== null && prevSub !== currentSub) {
      setSelectedAthleteId(null);
      setSelectedTeamId(null);
    }
    prevStructureSubTabRef.current = currentSub;
  }, [structureSubTab]);

  const testDefs = state.performanceDefinitions;

  function addDef(e: React.FormEvent) {
    e.preventDefault();
    const displayName = newDef.nameKey ? t(newDef.nameKey) : newDef.name;
    const result = validateTestDefinition(t, { name: displayName, unit: newDef.unit });
    if (!result.success) {
      setTestDefErrors(result.fieldErrors);
      setTestDefSummary(result.summary);
      return;
    }
    setTestDefErrors({});
    setTestDefSummary("");
    addPerformanceDefinition({
      name: result.data.name,
      nameKey: newDef.nameKey,
      area: testBatteryArea,
      unit: result.data.unit,
      attempts: newDef.attempts,
      isRating: newDef.isRating,
      scoringStrategy: newDef.scoringStrategy,
      interpretation: newDef.interpretation,
      description: newDef.description || undefined,
      descriptionKey: newDef.descriptionKey,
      mediaUrl: newDef.mediaUrl || undefined,
      mediaType: newDef.mediaType,
    });
    setNewDef({ name: "", nameKey: undefined, descriptionKey: undefined, unit: "", attempts: 1, isRating: false, scoringStrategy: "best", interpretation: "higher_better", description: "", mediaUrl: "", mediaType: undefined, subCategory: undefined });
    setShowAddTestForm(false);
  }

  function delDef(id: string) {
    deletePerformanceDefinition(id);
  }

  function handleMedia(e: React.ChangeEvent<HTMLInputElement>, type: "image" | "video") {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => { setNewDef(c => ({ ...c, mediaUrl: ev.target?.result as string, mediaType: type })); };
    r.readAsDataURL(f);
  }

  const areaTestDefs = testDefs.filter(d => d.area === testBatteryArea);

  return (
    <div className="space-y-6">
      {/* Main tab navigation - grouped */}
      <div className="flex gap-2">
        {[
          { id: "plantilla" as const, icon: Users, label: t("club.structure") },
          { id: "testBattery" as const, icon: Beaker, label: t("club.testBattery") },
          { id: "admin" as const, icon: Shield, label: t("club.settings") },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
              }}
              className={cn(
                "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition",
                activeTab === tab.id
                  ? "bg-accent text-white"
                  : "bg-white border border-line text-zinc-600 hover:bg-zinc-50",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Sub-tab navigation for Structure */}
      {activeTab === "plantilla" && (
        <div className="flex gap-2 ml-2">
          {[
            { id: "players" as const, label: t("club.players") },
            { id: "teams" as const, label: t("club.teams") },
          ].map((subTab) => (
            <button
              key={subTab.id}
              type="button"
              onClick={() => {
                setStructureSubTab(subTab.id);
              }}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition",
                structureSubTab === subTab.id
                  ? "bg-accent/10 text-accent"
                  : "text-zinc-600 hover:bg-zinc-50",
              )}
            >
              {subTab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === "plantilla" && structureSubTab === "teams" && (
        <TeamsTab
          teams={state.teams}
          athletes={state.athletes}
          addTeam={addTeam}
          updateTeam={updateTeam}
          deleteTeam={deleteTeam}
          selectedTeamId={selectedTeamId}
          setSelectedTeamId={(id) => {
            setSelectedTeamId(id);
          }}
          canEditAthletes={canEditAthletes}
        />
      )}
      {activeTab === "plantilla" && structureSubTab === "players" && (
        <PlayersTab
          athletes={state.athletes}
          teams={state.teams}
          addAthlete={addAthlete as (a: { name: string; sex: "male" | "female"; ageGroup: string; clubName: string; teamName?: string; teamId?: string; position?: string; dob: string }) => void}
          updateAthlete={updateAthlete as (id: string, updates: { name?: string; sex?: "male" | "female"; ageGroup?: string; teamName?: string; teamId?: string; position?: string; dob?: string }) => void}
          deleteAthlete={deleteAthlete}
          selectedAthleteId={selectedAthleteId}
          setSelectedAthleteId={(id) => {
            setSelectedAthleteId(id);
          }}
          canEditAthletes={canEditAthletes}
        />
      )}
      {activeTab === "testBattery" && (
        <TestBatteryTab
          testBatteryArea={testBatteryArea}
          setTestBatteryArea={(area) => {
            setTestBatteryArea(area);
          }}
          showAddTestForm={showAddTestForm}
          setShowAddTestForm={setShowAddTestForm}
          newDef={newDef}
          setNewDef={setNewDef}
          areaTestDefs={areaTestDefs}
          addDef={addDef}
          delDef={delDef}
          handleMedia={handleMedia}
          testDefErrors={testDefErrors}
          testDefSummary={testDefSummary}
          clearTestDefErrors={() => { setTestDefErrors({}); setTestDefSummary(""); }}
          setTestDefErrors={setTestDefErrors}
          updatePerformanceDefinition={updatePerformanceDefinition as (id: string, updates: Partial<PerformanceDefinition>) => void}
          t={t}
        />
      )}
      {activeTab === "admin" && (
        <AdminTab
          club={state.club}
          updateClub={updateClub}
          teams={state.teams}
          clubUsers={state.clubUsers}
          currentUserRole={state.currentUserRole}
          currentUserTeamIds={state.currentUserTeamIds}
          addClubUser={addClubUser}
          updateClubUser={updateClubUser}
          deleteClubUser={deleteClubUser}
        />
      )}
    </div>
  );
}

function TeamsTab({
  teams,
  athletes,
  addTeam,
  updateTeam,
  deleteTeam,
  selectedTeamId,
  setSelectedTeamId,
  canEditAthletes = true,
}: {
  teams: Array<{ id: string; name: string; ageGroup: string; clubId: string; photoUrl?: string | null }>;
  athletes: Array<{ id: string; name: string; teamId?: string; photoUrl?: string | null; position?: string; displayOrder?: number; category?: string }>;
  addTeam: (team: { name: string; ageGroup: string; clubId: string; photoUrl?: string | null }) => void;
  updateTeam: (id: string, updates: { name?: string; ageGroup?: string; photoUrl?: string | null }) => void;
  deleteTeam: (id: string) => void;
  selectedTeamId: string | null;
  setSelectedTeamId: (id: string | null) => void;
  canEditAthletes?: boolean;
}) {
  const { t } = useLocale();
  const { state, updateAthlete } = useAppState();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [formSummary, setFormSummary] = useState("");

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const teamRoster = athletes.filter(a => a.teamId === selectedTeamId);

  // Grouping logic
  const getCategory = (athlete: typeof athletes[0]) => {
    // 1. Prioritize explicit manual category
    if (athlete.category) return athlete.category;

    // 2. Fallback to auto-detection from position string
    const p = (athlete.position || "").toLowerCase().trim();
    if (/medio|midf|mc|mcd|mco|vol|piv|interior/i.test(p)) return "posMID";
    if (/^def|defensa|lat|centr|zaguero|ld|li|rb|lb|cb/i.test(p)) return "posDEF";
    if (/port|goalk|gk|por/i.test(p)) return "posGK";
    if (/delant|forw|strik|extr|wing|fwd|punta/i.test(p)) return "posFWD";
    return "posOTHER";
  };

  const categories = ["posGK", "posDEF", "posMID", "posFWD", "posOTHER"];

  // Build a categorized roster
  const categorizedSquad = categories.map(cat => {
    const playersInCat = teamRoster.filter(a => getCategory(a) === cat);
    // Sort players within each category by displayOrder
    return {
      id: cat,
      label: t(`datahub.${cat}`),
      players: [...playersInCat].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
    };
  });

  const groupedSquad = categorizedSquad.filter(group => group.players.length > 0);

  function moveAthlete(athleteId: string, direction: "up" | "down") {
    const athlete = teamRoster.find(a => a.id === athleteId);
    if (!athlete) return;

    const currentCat = getCategory(athlete);
    const catIndex = categories.indexOf(currentCat);
    const playersInCurrentCat = groupedSquad.find(g => g.id === currentCat)?.players || [];
    const indexInCat = playersInCurrentCat.findIndex(a => a.id === athleteId);

    if (direction === "up") {
      if (indexInCat > 0) {
        // Swap within same category
        const prev = playersInCurrentCat[indexInCat - 1];
        const newOrder = prev.displayOrder || 0;
        const currentOrder = athlete.displayOrder || indexInCat;
        updateAthlete(athlete.id, { displayOrder: newOrder });
        updateAthlete(prev.id, { displayOrder: currentOrder });
      } else if (catIndex > 0) {
        // Find previous category that has players OR just the previous one if we want to "jump"
        const prevCat = categories[catIndex - 1];
        // Move to the previous category, at the end
        const playersInPrev = categorizedSquad.find(g => g.id === prevCat)?.players || [];
        const lastOrder = playersInPrev.length > 0
          ? Math.max(...playersInPrev.map(p => p.displayOrder || 0)) + 1
          : 0;
        updateAthlete(athlete.id, { category: prevCat, displayOrder: lastOrder });
      }
    } else {
      // Down
      if (indexInCat < playersInCurrentCat.length - 1) {
        const next = playersInCurrentCat[indexInCat + 1];
        const newOrder = next.displayOrder || 0;
        const currentOrder = athlete.displayOrder || indexInCat;
        updateAthlete(athlete.id, { displayOrder: newOrder });
        updateAthlete(next.id, { displayOrder: currentOrder });
      } else if (catIndex < categories.length - 1) {
        const nextCat = categories[catIndex + 1];
        updateAthlete(athlete.id, { category: nextCat, displayOrder: 0 }); // Move to start of next
      }
    }
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  function openEdit(team: typeof teams[0]) {
    setEditingId(team.id);
    setName(team.name);
    setAgeGroup(team.ageGroup);
    setPhotoUrl(team.photoUrl || "");
  }

  function closeModals() {
    setShowAdd(false);
    setEditingId(null);
    setName("");
    setAgeGroup("");
    setPhotoUrl("");
    setFormErrors({});
    setFormSummary("");
  }

  function handleSaveAdd() {
    const result = validateClubTeam(t, { name, ageGroup });
    if (!result.success) {
      setFormErrors(result.fieldErrors);
      setFormSummary(result.summary);
      return;
    }
    addTeam({ name: result.data.name, ageGroup: result.data.ageGroup, clubId: state.club.id, photoUrl: photoUrl || null });
    closeModals();
  }

  function handleSaveEdit() {
    if (!editingId) return;
    const result = validateClubTeam(t, { name, ageGroup });
    if (!result.success) {
      setFormErrors(result.fieldErrors);
      setFormSummary(result.summary);
      return;
    }
    updateTeam(editingId, { name: result.data.name, ageGroup: result.data.ageGroup, photoUrl: photoUrl || null });
    closeModals();
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[500px] animate-in slide-in-from-right-4 duration-500">
      {/* List Area */}
      <div className={cn("flex-1 space-y-4", selectedTeamId && "hidden lg:block")}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{t("club.teams")}</h2>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent/90 shrink-0"
          >
            <Plus className="h-4 w-4" />
            {t("club.addTeam")}
          </button>
        </div>

        {teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50">
            <Users className="h-10 w-10 text-zinc-300 mb-3" />
            <p className="text-sm text-zinc-500">{t("club.noTeams")}</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {teams.map((team) => (
              <button
                key={team.id}
                onClick={() => setSelectedTeamId(team.id === selectedTeamId ? null : team.id)}
                className={cn(
                  "group relative flex flex-col items-start rounded-2xl border p-4 text-left transition-all duration-300 hover:shadow-md",
                  selectedTeamId === team.id
                    ? "border-accent bg-accent/[0.03] ring-1 ring-accent/20"
                    : "border-line bg-white hover:border-accent/40"
                )}
              >
                <div className="flex w-full items-start gap-3">
                  <div className="h-12 w-12 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center overflow-hidden shrink-0">
                    {team.photoUrl ? (
                      <img src={team.photoUrl} alt={team.name} className="h-full w-full object-cover" />
                    ) : (
                      <Shield className="h-6 w-6 text-zinc-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pr-6">
                    <h3 className="font-bold text-zinc-900 group-hover:text-accent transition truncate leading-tight">{team.name}</h3>
                    <p className="text-xs font-medium text-zinc-500 mt-0.5">{t("club.ageGroup")}: {team.ageGroup}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {athletes.filter(a => a.teamId === team.id).slice(0, 3).map((a, idx) => (
                          <div key={idx} className="h-6 w-6 rounded-full border-2 border-white bg-zinc-100 overflow-hidden ring-1 ring-zinc-100">
                            {a.photoUrl ? (
                              <img src={a.photoUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <User className="h-3.5 w-3.5 text-zinc-400 m-auto mt-0.5" />
                            )}
                          </div>
                        ))}
                      </div>
                      <span className="text-[10px] text-zinc-400 font-medium lowercase">
                        {athletes.filter(a => a.teamId === team.id).length} {t("datahub.squad").toLowerCase()}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className={cn(
                    "absolute top-4 right-4 h-4 w-4 text-zinc-300 transition-all group-hover:text-accent",
                    selectedTeamId === team.id && "rotate-90 text-accent"
                  )} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail Area (Side Panel) */}
      <div className={cn(
        "lg:w-96 shrink-0 lg:sticky lg:top-0 h-fit",
        !selectedTeamId && "hidden"
      )}>
        {selectedTeam && (
          <div className="rounded-[2rem] border border-line bg-white p-6 shadow-xl space-y-6 animate-in slide-in-from-right-10 duration-500 overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {selectedTeam.photoUrl ? (
                    <img src={selectedTeam.photoUrl} alt={selectedTeam.name} className="h-full w-full object-cover" />
                  ) : (
                    <Shield className="h-8 w-8 text-zinc-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 leading-tight">{selectedTeam.name}</h3>
                  <p className="text-sm font-medium text-accent">{selectedTeam.ageGroup}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTeamId(null)}
                className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-zinc-100 text-zinc-400 lg:hidden"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => openEdit(selectedTeam)}
                className="flex items-center justify-center gap-2 rounded-xl bg-zinc-100 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-200"
              >
                <Edit2 className="h-4 w-4" />
                {t("datahub.editPlayerTitle").replace(t("datahub.player").toLowerCase(), t("datahub.team").toLowerCase())}
              </button>
              <button
                onClick={() => {
                  if (confirm(t("common.confirmDelete") || "Are you sure?")) {
                    deleteTeam(selectedTeam.id);
                    setSelectedTeamId(null);
                  }
                }}
                className="flex items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100/50"
              >
                <Trash2 className="h-4 w-4" />
                {t("datahub.delete")}
              </button>
            </div>

            <div className="space-y-6 overflow-y-auto max-h-[450px] pr-2 -mr-2">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t("datahub.squad")} ({teamRoster.length})</h4>
              </div>

              {teamRoster.length === 0 ? (
                <p className="text-xs text-zinc-400 italic py-4 text-center">No players assigned yet</p>
              ) : (
                <div className="space-y-6">
                  {groupedSquad.map(group => (
                    <div key={group.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-accent" />
                        <h5 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{group.label}</h5>
                        <div className="h-px bg-zinc-100 flex-1" />
                      </div>
                      <div className="grid gap-2">
                        {group.players.map((player, idx) => {
                          return (
                            <div key={player.id} className="flex items-center gap-3 p-2 rounded-xl border border-transparent hover:bg-zinc-50 transition group/item">
                              <div className="h-8 w-8 rounded-full bg-zinc-100 overflow-hidden shrink-0 border border-zinc-200">
                                {player.photoUrl ? (
                                  <img src={player.photoUrl} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <User className="h-4 w-4 text-zinc-400 m-auto mt-1" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-zinc-700 truncate">{player.name}</p>
                                <p className="text-[10px] text-zinc-400 font-medium">{player.position || "N/A"}</p>
                              </div>
                              <div className="hidden group-hover/item:flex items-center gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); moveAthlete(player.id, "up"); }}
                                  disabled={categories.indexOf(getCategory(player)) === 0 && idx === 0}
                                  className="p-1 hover:bg-white rounded border border-line text-zinc-400 hover:text-accent disabled:opacity-30 disabled:hover:bg-transparent"
                                >
                                  <ChevronRight className="h-3 w-3 -rotate-90" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); moveAthlete(player.id, "down"); }}
                                  disabled={categories.indexOf(getCategory(player)) === categories.length - 1 && idx === group.players.length - 1}
                                  className="p-1 hover:bg-white rounded border border-line text-zinc-400 hover:text-accent disabled:opacity-30 disabled:hover:bg-transparent"
                                >
                                  <ChevronRight className="h-3 w-3 rotate-90" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Team Modal */}
      {showAdd && (
        <Modal title={t("club.addTeam")} onClose={closeModals}>
          <div className="space-y-4">
            <FormErrorBanner summary={formSummary} fieldErrors={formErrors} t={t} />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">{t("club.teamNamePlaceholder")}</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); setFormErrors(clearFieldError(formErrors, "name")); }}
                  className={clubInputClass(Boolean(formErrors.name))}
                  autoFocus
                />
                <FieldError message={formErrors.name} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">{t("club.ageGroupPlaceholder")}</label>
                <input
                  type="text"
                  value={ageGroup}
                  onChange={e => { setAgeGroup(e.target.value); setFormErrors(clearFieldError(formErrors, "ageGroup")); }}
                  className={clubInputClass(Boolean(formErrors.ageGroup))}
                />
                <FieldError message={formErrors.ageGroup} />
              </div>
            </div>

            <div className="pt-2">
              <label className="text-xs font-medium text-zinc-500 mb-1 block">{t("datahub.photoOptional")}</label>
              <div className="flex items-center gap-4">
                {photoUrl ? (
                  <div className="h-12 w-12 rounded-xl border border-line overflow-hidden flex-shrink-0 bg-white">
                    <img src={photoUrl} alt="Team" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="h-12 w-12 rounded-xl border border-dashed border-zinc-300 flex items-center justify-center bg-zinc-50 flex-shrink-0">
                    <Shield className="h-5 w-5 text-zinc-400" />
                  </div>
                )}
                <label className="cursor-pointer rounded-lg border border-line bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition">
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  {t("datahub.selectPhoto")}
                </label>
                {photoUrl && (
                  <button type="button" onClick={() => setPhotoUrl("")} className="text-xs text-red-500 hover:underline">
                    {t("datahub.delete")}
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-line">
              <button
                onClick={handleSaveAdd}
                className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90"
              >
                {t("common.save")}
              </button>
              <button onClick={closeModals} className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold text-zinc-600">
                {t("datahub.cancel")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Team Modal */}
      {editingId && (
        <Modal title={t("datahub.editPlayerTitle").replace(t("datahub.player").toLowerCase(), t("datahub.team").toLowerCase())} onClose={closeModals}>
          <div className="space-y-4">
            <FormErrorBanner summary={formSummary} fieldErrors={formErrors} t={t} />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">{t("club.teamNamePlaceholder")}</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); setFormErrors(clearFieldError(formErrors, "name")); }}
                  className={clubInputClass(Boolean(formErrors.name))}
                />
                <FieldError message={formErrors.name} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">{t("club.ageGroupPlaceholder")}</label>
                <input
                  type="text"
                  value={ageGroup}
                  onChange={e => { setAgeGroup(e.target.value); setFormErrors(clearFieldError(formErrors, "ageGroup")); }}
                  className={clubInputClass(Boolean(formErrors.ageGroup))}
                />
                <FieldError message={formErrors.ageGroup} />
              </div>
            </div>

            <div className="pt-2">
              <label className="text-xs font-medium text-zinc-500 mb-1 block">{t("datahub.photoOptional")}</label>
              <div className="flex items-center gap-4">
                {photoUrl ? (
                  <div className="h-12 w-12 rounded-xl border border-line overflow-hidden flex-shrink-0 bg-white">
                    <img src={photoUrl} alt="Team" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="h-12 w-12 rounded-xl border border-dashed border-zinc-300 flex items-center justify-center bg-zinc-50 flex-shrink-0">
                    <Shield className="h-5 w-5 text-zinc-400" />
                  </div>
                )}
                <label className="cursor-pointer rounded-lg border border-line bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition">
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  {t("datahub.selectPhoto")}
                </label>
                {photoUrl && (
                  <button type="button" onClick={() => setPhotoUrl("")} className="text-xs text-red-500 hover:underline">
                    {t("datahub.delete")}
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-line">
              <button
                onClick={handleSaveEdit}
                className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90"
              >
                {t("common.save")}
              </button>
              <button onClick={closeModals} className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold text-zinc-600">
                {t("datahub.cancel")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PlayersTab({
  athletes,
  teams,
  addAthlete,
  updateAthlete,
  deleteAthlete,
  selectedAthleteId,
  setSelectedAthleteId,
  canEditAthletes = true,
}: {
  athletes: Array<{ id: string; name: string; sex: string; ageGroup: string; teamName?: string; position?: string; dob: string; clubName: string; teamId?: string; photoUrl?: string | null }>;
  teams: Array<{ id: string; name: string }>;
  addAthlete: (a: { name: string; sex: "male" | "female"; ageGroup: string; clubName: string; teamName?: string; teamId?: string; position?: string; dob: string; photoUrl?: string | null }) => void;
  updateAthlete: (id: string, updates: { name?: string; sex?: "male" | "female"; ageGroup?: string; teamName?: string; teamId?: string; position?: string; dob?: string; photoUrl?: string | null }) => void;
  deleteAthlete: (id: string) => void;
  selectedAthleteId: string | null;
  setSelectedAthleteId: (id: string | null) => void;
  canEditAthletes?: boolean;
}) {
  const { t } = useLocale();
  const { state } = useAppState();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [sex, setSex] = useState<"male" | "female">("male");
  const [ageGroup, setAgeGroup] = useState("");
  const [teamId, setTeamId] = useState("");
  const [position, setPosition] = useState("");
  const [dob, setDob] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [formSummary, setFormSummary] = useState("");

  const selectedAthlete = athletes.find(a => a.id === selectedAthleteId);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoUrl(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const [importFeedback, setImportFeedback] = useState("");

  async function downloadTemplate() {
    const isEn = t("datahub.title") === "DataHub";
    const headers = isEn
      ? ["Name", "Sex", "Age Group", "Team", "Position", "DOB (YYYY-MM-DD)"]
      : ["Nombre", "Sexo", "Grupo de Edad", "Equipo", "Posicion", "Fecha de Nacimiento (AAAA-MM-DD)"];

    // Dynamic import to avoid heavy initial bundle
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(isEn ? "Players" : "Jugadores");

    worksheet.addRow(headers);
    worksheet.getRow(1).font = { bold: true };
    worksheet.columns.forEach(c => { c.width = 25; });

    const sexOptions = isEn ? '"male,female"' : '"masculino,femenino"';

    // Hidden sheet for teams to avoid 255 character limit in list formulae
    const teamSheetName = "HiddenTeams";
    if (teams.length > 0) {
      const teamSheet = workbook.addWorksheet(teamSheetName, { state: 'hidden' });
      teams.forEach((t, i) => {
        teamSheet.getCell(`A${i + 1}`).value = t.name;
      });
    }

    for (let i = 2; i <= 1000; i++) {
      // Sex column is B (2)
      worksheet.getCell(i, 2).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [sexOptions],
        showErrorMessage: true,
        errorStyle: 'error',
        errorTitle: 'Valor incorrecto',
        error: 'Por favor, selecciona un valor de la lista.'
      };

      // Team column is D (4)
      if (teams.length > 0) {
        worksheet.getCell(i, 4).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`'${teamSheetName}'!$A$1:$A$${teams.length}`],
          showErrorMessage: true,
          errorStyle: 'warning',
          errorTitle: 'Nuevo equipo',
          error: 'Puedes escribir un equipo nuevo que se creará automáticamente.'
        };
      }
    }

    // Set a sample row
    const sampleRow = isEn
      ? ["Sample Athlete", "male", "U14", teams[0]?.name || "U14 Boys", "Winger", "2012-02-14"]
      : ["Ej: Juan Perez", "masculino", "Sub-14", teams[0]?.name || "Juvenil A", "Delantero", "2012-02-14"];
    worksheet.addRow(sampleRow);
    // Explicitly apply validation to sample row cells too
    worksheet.getCell(2, 2).value = sampleRow[1];
    worksheet.getCell(2, 4).value = sampleRow[3];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = isEn ? "add-players-template.xlsx" : "anadir-jugadores-plantilla.xlsx";
    a.click();
    window.URL.revokeObjectURL(url);
  }

  async function handleImportExcel(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]]);

      let count = 0;
      let skipped = 0;
      for (const raw of rows) {
        const map: Record<string, string> = { "Nombre": "Name", "Sexo": "Sex", "masculino": "male", "femenino": "female", "Grupo de Edad": "Age Group", "Equipo": "Team", "Posicion": "Position", "Fecha de Nacimiento (AAAA-MM-DD)": "DOB", "DOB (YYYY-MM-DD)": "DOB", "Fecha de Nacimiento": "DOB" };
        const row: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(raw)) row[map[key] ?? key] = value;

        const athleteName = String(row["Name"] ?? "").trim();
        const sexValue = String(row["Sex"] ?? "").trim().toLowerCase();
        let dobStr = String(row["DOB"] ?? "").trim();

        // Handling Excel date strings if it outputs serial numbers
        if (!isNaN(Number(dobStr)) && dobStr !== "") {
          const excelEpoch = new Date(1899, 11, 30);
          const dateVal = new Date(excelEpoch.getTime() + Number(dobStr) * 86400000);
          dobStr = dateVal.toISOString().split('T')[0];
        }

        if (!athleteName || athleteName.includes("Ej: ") || athleteName.includes("Sample Athlete")) {
          skipped++;
          continue;
        }

        const teamName = String(row["Team"] ?? "").trim();
        const teamMatch = teams.find(team => team.name.toLowerCase() === teamName.toLowerCase());
        const ageGroup = String(row["Age Group"] ?? "").trim();
        const validation = validateClubAthlete(t, {
          name: athleteName,
          ageGroup,
          dob: dobStr,
          teamId: teamMatch?.id ?? "",
        });

        if (!validation.success) {
          skipped++;
          continue;
        }

        addAthlete({
          name: validation.data.name,
          sex: sexValue === "female" ? "female" : "male",
          ageGroup: validation.data.ageGroup,
          clubName: state.club.name,
          teamName: teamMatch?.name,
          teamId: teamMatch?.id,
          position: String(row["Position"] ?? "").trim() || undefined,
          dob: validation.data.dob,
        });
        count++;
      }

      if (count > 0) {
        const successMsg = skipped > 0
          ? t("datahub.bulkAddPartial")
              .replace("{imported}", String(count))
              .replace("{skipped}", String(skipped))
          : (t("datahub.bulkAddSuccess")?.replace("{count}", count.toString()) || `✅ ${count} jugadores añadidos con éxito.`);
        setImportFeedback(successMsg);
        setTimeout(() => {
          setImportFeedback("");
          closeModals();
        }, 2000);
      } else {
        const errMsg = skipped > 0
          ? t("datahub.bulkAddValidationError").replace("{skipped}", String(skipped))
          : (t("datahub.bulkAddError") || "❌ No se encontraron jugadores válidos en el archivo.");
        setImportFeedback(errMsg);
        setTimeout(() => setImportFeedback(""), 3000);
      }
    } catch (e) {
      setImportFeedback(t("datahub.bulkAddErrorProcess") || "❌ Error al procesar el archivo Excel.");
      setTimeout(() => setImportFeedback(""), 3000);
    }
    event.target.value = "";
  }

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTeam, setFilterTeam] = useState("all");
  const [filterPosition, setFilterPosition] = useState("all");

  // Group / sort state (mirroring maturation section)
  const [groupByTeam, setGroupByTeam] = useState(false);
  const [groupByPosition, setGroupByPosition] = useState(false);
  const [sortPlayers, setSortPlayers] = useState<"name" | "age">("name");

  // Get unique positions for filter
  const positions = Array.from(new Set(athletes.map(a => a.position).filter(Boolean))).sort() as string[];

  // Filter + sort athletes
  const filteredAthletes = athletes
    .filter(a => {
      const matchesSearch = !searchQuery || a.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTeam = filterTeam === "all" || a.teamId === filterTeam;
      const matchesPosition = filterPosition === "all" || a.position === filterPosition;
      return matchesSearch && matchesTeam && matchesPosition;
    })
    .sort((a, b) => {
      if (sortPlayers === "age") {
        return (a.dob ?? "").localeCompare(b.dob ?? "");
      }
      return a.name.localeCompare(b.name);
    });

  type AthleteGroup = {
    label: string;
    players: typeof filteredAthletes;
    subgroups?: Array<{ label: string; players: typeof filteredAthletes }>;
  };

  // Grouped view: team and position toggles can be combined.
  const groupedAthletes = useMemo<AthleteGroup[] | null>(() => {
    if (!groupByTeam && !groupByPosition) return null;

    const makeGroups = (
      items: typeof filteredAthletes,
      getLabel: (athlete: typeof filteredAthletes[number]) => string
    ) => {
      const map = new Map<string, typeof filteredAthletes>();
      for (const athlete of items) {
        const label = getLabel(athlete);
        if (!map.has(label)) map.set(label, []);
        map.get(label)!.push(athlete);
      }
      return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, players]) => ({ label, players }));
    };

    if (groupByTeam && groupByPosition) {
      return makeGroups(filteredAthletes, (athlete) => athlete.teamName ?? "—").map((group) => ({
        ...group,
        subgroups: makeGroups(group.players, (athlete) => athlete.position ?? "—"),
      }));
    }

    return groupByTeam
      ? makeGroups(filteredAthletes, (athlete) => athlete.teamName ?? "—")
      : makeGroups(filteredAthletes, (athlete) => athlete.position ?? "—");
  }, [groupByPosition, groupByTeam, filteredAthletes]);

  function openEdit(athlete: typeof athletes[0]) {
    setEditingId(athlete.id);
    setName(athlete.name);
    setSex(athlete.sex as "male" | "female");
    setAgeGroup(athlete.ageGroup);
    setTeamId(athlete.teamId || "");
    setPosition(athlete.position || "");
    setDob(athlete.dob);
    setPhotoUrl(athlete.photoUrl || "");
  }

  function closeModals() {
    setEditingId(null);
    setShowAdd(false);
    setName("");
    setSex("male");
    setAgeGroup("");
    setTeamId("");
    setPosition("");
    setDob("");
    setPhotoUrl("");
    setFormErrors({});
    setFormSummary("");
  }

  function handleSaveEdit() {
    if (!editingId) return;
    const result = validateClubAthlete(t, { name, ageGroup, dob, teamId });
    if (!result.success) {
      setFormErrors(result.fieldErrors);
      setFormSummary(result.summary);
      return;
    }

    const team = teams.find((item) => item.id === result.data.teamId);
    updateAthlete(editingId, {
      name: result.data.name,
      sex,
      ageGroup: result.data.ageGroup,
      teamName: team?.name,
      teamId: team?.id,
      position: position.trim() || undefined,
      dob: result.data.dob,
      photoUrl: photoUrl || null,
    });
    closeModals();
  }

  function handleSaveAdd() {
    const result = validateClubAthlete(t, { name, ageGroup, dob, teamId });
    if (!result.success) {
      setFormErrors(result.fieldErrors);
      setFormSummary(result.summary);
      return;
    }

    const team = teams.find((item) => item.id === result.data.teamId);
    addAthlete({
      name: result.data.name,
      sex,
      ageGroup: result.data.ageGroup,
      clubName: state.club.name,
      teamName: team?.name,
      teamId: team?.id,
      position: position.trim() || undefined,
      dob: result.data.dob,
      photoUrl: photoUrl || null,
    });
    closeModals();
  }

  const hasActiveFilters = searchQuery || filterTeam !== "all" || filterPosition !== "all";

  const renderGroupHeader = (label: string, nested = false) => (
    <tr>
      <td colSpan={6} className={cn("px-4 pb-1", nested ? "pt-2 pl-8" : "pt-4")}>
        <div className="flex items-center gap-2">
          <div className={cn("rounded-full bg-accent", nested ? "h-1 w-1 opacity-60" : "h-1.5 w-1.5")} />
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{label}</span>
          <div className="h-px flex-1 bg-zinc-100" />
        </div>
      </td>
    </tr>
  );

  const renderAthleteRow = (a: typeof athletes[number]) => (
    <tr
      key={a.id}
      onClick={() => setSelectedAthleteId(a.id)}
      className={cn("border-t border-line/50 hover:bg-zinc-50/50 transition cursor-pointer", selectedAthleteId === a.id && "bg-accent/5")}
    >
      <td className="px-4 py-3 font-medium text-zinc-900">{a.name}</td>
      <td className="px-4 py-3 text-zinc-600">{a.sex === "male" ? t("datahub.male") : t("datahub.female")}</td>
      <td className="px-4 py-3 text-zinc-600">{a.teamName ?? "—"}</td>
      <td className="px-4 py-3 text-zinc-600">{a.position ?? "—"}</td>
      <td className="px-4 py-3 text-zinc-600">{a.dob}</td>
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); openEdit(a); }}
          disabled={!canEditAthletes}
          className="rounded-full p-2 hover:bg-accent/10 text-zinc-400 hover:text-accent transition disabled:opacity-50 disabled:cursor-not-allowed"
          title={t("datahub.edit")}
        >
          <Edit2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t("club.players")}</h2>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          disabled={!canEditAthletes}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
          {t("club.addPlayer")}
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-line bg-white p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder={t("datahub.searchPlayerPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent/50 font-sans"
          />
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setFilterTeam("all");
                setFilterPosition("all");
              }}
              className="rounded-lg border border-line px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent/50 font-sans"
          >
            <option value="all">{t("datahub.allTeams")}</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
          <select
            value={filterPosition}
            onChange={(e) => setFilterPosition(e.target.value)}
            className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent/50 font-sans"
          >
            <option value="all">{t("datahub.position")}</option>
            {positions.map((pos) => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Group / Sort toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-medium text-zinc-600">{t("datahub.groupLabel")}:</span>
          <button
            type="button"
            onClick={() => setGroupByTeam(v => !v)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition",
              groupByTeam ? "bg-accent text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            )}
          >
            {t("datahub.groupByTeam")}
          </button>
          <button
            type="button"
            onClick={() => setGroupByPosition(v => !v)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition",
              groupByPosition ? "bg-accent text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            )}
          >
            {t("datahub.groupByPosition")}
          </button>
        </div>
        <span className="text-zinc-300 shrink-0">|</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-medium text-zinc-600">{t("datahub.sortLabel")}:</span>
          <select
            value={sortPlayers}
            onChange={(e) => setSortPlayers(e.target.value as "name" | "age")}
            className="rounded-full border border-line bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 outline-none cursor-pointer"
          >
            <option value="name">{t("datahub.sortByName")}</option>
            <option value="age">{t("datahub.sortByAge")}</option>
          </select>
        </div>
      </div>

      {filteredAthletes.length === 0 && (
        <p className="text-sm text-zinc-500">
          {hasActiveFilters ? t("datahub.noMatches") : t("club.noPlayers")}
        </p>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        <div className={cn("rounded-xl border border-line bg-white overflow-hidden flex-1", selectedAthleteId && "hidden lg:block lg:w-2/3")}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-zinc-50">
                  <th className="text-left px-4 py-3 font-medium text-zinc-600">{t("datahub.playerName")}</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-600">{t("datahub.sex")}</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-600">{t("datahub.team")}</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-600">{t("datahub.position")}</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-600">{t("datahub.birthDate")}</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody suppressHydrationWarning>
                {groupedAthletes
                  ? groupedAthletes.map((group) => (
                    <React.Fragment key={group.label}>
                      {renderGroupHeader(group.label)}
                      {"subgroups" in group && group.subgroups
                        ? group.subgroups.map((subgroup) => (
                          <React.Fragment key={`${group.label}-${subgroup.label}`}>
                            {renderGroupHeader(subgroup.label, true)}
                            {subgroup.players.map(renderAthleteRow)}
                          </React.Fragment>
                        ))
                        : group.players.map(renderAthleteRow)}
                    </React.Fragment>
                  ))
                  : filteredAthletes.map(renderAthleteRow)}
              </tbody>
            </table>
          </div>
        </div>

        {selectedAthlete && (
          <div className="w-full lg:w-1/3 rounded-xl border border-line bg-white shadow-lg p-5 flex flex-col space-y-6 animate-in slide-in-from-right-4 duration-200 self-start lg:sticky lg:top-24 h-fit">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {selectedAthlete.photoUrl ? (
                    <img src={selectedAthlete.photoUrl} alt="Player avatar" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-8 w-8 text-zinc-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 leading-tight">{selectedAthlete.name}</h3>
                  <p className="text-sm text-zinc-500">{selectedAthlete.teamName ?? "—"}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAthleteId(null)}
                className="rounded-full p-1.5 hover:bg-zinc-100 text-zinc-400 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => openEdit(selectedAthlete)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-100 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-200"
            >
              <Edit2 className="h-4 w-4" />
              {t("datahub.edit")}
            </button>

            <div className="grid grid-cols-2 gap-3 text-sm border-y border-line py-4">
              <div>
                <p className="text-zinc-500 text-xs mb-0.5">{t("datahub.position")}</p>
                <p className="font-medium text-zinc-900">{selectedAthlete.position || "—"}</p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs mb-0.5">{t("datahub.ageGroup")}</p>
                <p className="font-medium text-zinc-900">{selectedAthlete.ageGroup || "—"}</p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs mb-0.5">{t("datahub.sex")}</p>
                <p className="font-medium text-zinc-900">{selectedAthlete.sex === "male" ? t("datahub.male") : t("datahub.female")}</p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs mb-0.5">{t("datahub.birthDate")}</p>
                <p className="font-medium text-zinc-900">{selectedAthlete.dob}</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-zinc-900">Análisis y Rendimiento</h4>
              <button className="w-full flex items-center justify-between p-3 rounded-lg border border-line hover:border-accent hover:bg-accent/5 transition group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-accent/10 text-accent">
                    <BarChart2 className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-zinc-700 group-hover:text-zinc-900 text-sm">Ver gráficas de rendimiento</span>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:text-accent" />
              </button>
              <button className="w-full flex items-center justify-between p-3 rounded-lg border border-line hover:border-accent hover:bg-accent/5 transition group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-accent/10 text-accent">
                    <Activity className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-zinc-700 group-hover:text-zinc-900 text-sm">Evaluación y maduración</span>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:text-accent" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Player Modal */}
      {showAdd && (
        <Modal
          title={t("datahub.addNewPlayerTitle")}
          onClose={closeModals}
        >
          <div className="space-y-4">
            {/* Excel Import/Export Section */}
            <div
              onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLElement).classList.add("border-emerald-500", "bg-emerald-50"); }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLElement).classList.remove("border-emerald-500", "bg-emerald-50"); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                (e.currentTarget as HTMLElement).classList.remove("border-emerald-500", "bg-emerald-50");
                const files = e.dataTransfer.files;
                if (files && files.length > 0) {
                  const file = files[0];
                  if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
                    const mockEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
                    handleImportExcel(mockEvent);
                  }
                }
              }}
              className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 mb-2 shrink-0 transition-colors"
            >
              <p className="text-sm text-zinc-600 mb-3 text-center">
                {t("datahub.bulkAddTitle")}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 rounded-lg bg-white border border-line px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition shadow-sm"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  {t("common.downloadTemplate")}
                </button>
                <label className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 cursor-pointer transition shadow-sm">
                  <UploadCloud className="h-4 w-4" />
                  {t("datahub.uploadExcel")}
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    className="hidden"
                    onChange={handleImportExcel}
                  />
                </label>
              </div>
              {importFeedback && (
                <div className={cn("mt-3 p-2 text-center text-sm font-medium rounded-lg", importFeedback.includes("✅") ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800")}>
                  {importFeedback}
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 py-1 shrink-0">
              <div className="h-px bg-line flex-1"></div>
              <span className="text-xs font-semibold uppercase text-zinc-400">{t("datahub.bulkAddManualOpts")}</span>
              <div className="h-px bg-line flex-1"></div>
            </div>

            <FormErrorBanner summary={formSummary} fieldErrors={formErrors} t={t} />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">{t("datahub.playerName")}</label>
                <input
                  type="text"
                  placeholder={t("datahub.playerName")}
                  value={name}
                  onChange={(e) => { setName(e.target.value); setFormErrors(clearFieldError(formErrors, "name")); }}
                  className={clubInputClass(Boolean(formErrors.name))}
                  autoFocus
                />
                <FieldError message={formErrors.name} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">{t("datahub.sex")}</label>
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value as "male" | "female")}
                  className={clubInputClass(false)}
                >
                  <option value="male">{t("datahub.male")}</option>
                  <option value="female">{t("datahub.female")}</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">{t("datahub.ageGroup")}</label>
                <input
                  type="text"
                  placeholder={t("datahub.ageGroup")}
                  value={ageGroup}
                  onChange={(e) => { setAgeGroup(e.target.value); setFormErrors(clearFieldError(formErrors, "ageGroup")); }}
                  className={clubInputClass(Boolean(formErrors.ageGroup))}
                />
                <FieldError message={formErrors.ageGroup} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">{t("datahub.team")}</label>
                <select
                  value={teamId}
                  onChange={(e) => { setTeamId(e.target.value); setFormErrors(clearFieldError(formErrors, "teamId")); }}
                  className={clubInputClass(Boolean(formErrors.teamId))}
                >
                  <option value="">{t("club.selectTeam")}</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
                <FieldError message={formErrors.teamId} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">{t("datahub.position")}</label>
                <input
                  type="text"
                  placeholder={t("datahub.position")}
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className={clubInputClass(false)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">{t("datahub.birthDate")}</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => { setDob(e.target.value); setFormErrors(clearFieldError(formErrors, "dob")); }}
                  className={clubInputClass(Boolean(formErrors.dob))}
                />
                <FieldError message={formErrors.dob} />
              </div>
            </div>

            <div className="pt-2">
              <label className="text-xs font-medium text-zinc-500 mb-1 block">{t("datahub.photoOptional")}</label>
              <div className="flex items-center gap-4">
                {photoUrl ? (
                  <div className="h-12 w-12 rounded-full border border-line overflow-hidden flex-shrink-0 bg-white">
                    <img src={photoUrl} alt="Player" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="h-12 w-12 rounded-full border border-dashed border-zinc-300 flex items-center justify-center bg-zinc-50 flex-shrink-0">
                    <User className="h-5 w-5 text-zinc-400" />
                  </div>
                )}
                <label className="cursor-pointer rounded-lg border border-line bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  {t("datahub.selectPhoto")}
                </label>
                {photoUrl && (
                  <button
                    type="button"
                    onClick={() => setPhotoUrl("")}
                    className="text-xs text-red-500 hover:underline"
                  >
                    {t("datahub.delete")}
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-line">
              <button
                type="button"
                onClick={handleSaveAdd}
                className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90"
              >
                {t("common.save")}
              </button>
              <button
                type="button"
                onClick={closeModals}
                className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50"
              >
                {t("datahub.cancel")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Player Modal */}
      {editingId && (
        <Modal
          title={t("datahub.editPlayerTitle")}
          onClose={closeModals}
        >
          <div className="space-y-4">
            <FormErrorBanner summary={formSummary} fieldErrors={formErrors} t={t} />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">{t("datahub.playerName")}</label>
                <input
                  type="text"
                  placeholder={t("datahub.playerName")}
                  value={name}
                  onChange={(e) => { setName(e.target.value); setFormErrors(clearFieldError(formErrors, "name")); }}
                  className={clubInputClass(Boolean(formErrors.name))}
                />
                <FieldError message={formErrors.name} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">{t("datahub.sex")}</label>
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value as "male" | "female")}
                  className={clubInputClass(false)}
                >
                  <option value="male">{t("datahub.male")}</option>
                  <option value="female">{t("datahub.female")}</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">{t("datahub.ageGroup")}</label>
                <input
                  type="text"
                  placeholder={t("datahub.ageGroup")}
                  value={ageGroup}
                  onChange={(e) => { setAgeGroup(e.target.value); setFormErrors(clearFieldError(formErrors, "ageGroup")); }}
                  className={clubInputClass(Boolean(formErrors.ageGroup))}
                />
                <FieldError message={formErrors.ageGroup} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">{t("datahub.team")}</label>
                <select
                  value={teamId}
                  onChange={(e) => { setTeamId(e.target.value); setFormErrors(clearFieldError(formErrors, "teamId")); }}
                  className={clubInputClass(Boolean(formErrors.teamId))}
                >
                  <option value="">{t("club.selectTeam")}</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
                <FieldError message={formErrors.teamId} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">{t("datahub.position")}</label>
                <input
                  type="text"
                  placeholder={t("datahub.position")}
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className={clubInputClass(false)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">{t("datahub.birthDate")}</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => { setDob(e.target.value); setFormErrors(clearFieldError(formErrors, "dob")); }}
                  className={clubInputClass(Boolean(formErrors.dob))}
                />
                <FieldError message={formErrors.dob} />
              </div>
            </div>

            <div className="pt-2">
              <label className="text-xs font-medium text-zinc-500 mb-1 block">{t("datahub.photoOptional")}</label>
              <div className="flex items-center gap-4">
                {photoUrl ? (
                  <div className="h-12 w-12 rounded-full border border-line overflow-hidden flex-shrink-0 bg-white">
                    <img src={photoUrl} alt="Player" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="h-12 w-12 rounded-full border border-dashed border-zinc-300 flex items-center justify-center bg-zinc-50 flex-shrink-0">
                    <User className="h-5 w-5 text-zinc-400" />
                  </div>
                )}
                <label className="cursor-pointer rounded-lg border border-line bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  {t("datahub.selectPhoto")}
                </label>
                {photoUrl && (
                  <button
                    type="button"
                    onClick={() => setPhotoUrl("")}
                    className="text-xs text-red-500 hover:underline"
                  >
                    {t("datahub.delete")}
                  </button>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-line flex flex-col gap-3">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90"
                >
                  {t("common.save")}
                </button>
                <button
                  type="button"
                  onClick={closeModals}
                  className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50"
                >
                  {t("datahub.cancel")}
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (confirm(t("common.confirmDelete") || "Are you sure?")) {
                    deleteAthlete(editingId!);
                    closeModals();
                  }
                }}
                disabled={!canEditAthletes}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="h-4 w-4" />
                {t("datahub.delete")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-all animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between shrink-0">
          <h3 className="text-xl font-bold text-zinc-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto pr-2 -mr-2">
          {children}
        </div>
      </div>
    </div>
  );
}

function AdminTab({
  club,
  updateClub,
  teams,
  clubUsers,
  currentUserRole,
  currentUserTeamIds,
  addClubUser,
  updateClubUser,
  deleteClubUser,
}: {
  club: { name: string; region: string; sport?: "football" | "futsal"; accentColor?: string; badgeUrl?: string };
  updateClub: (updates: { name?: string; region?: string; sport?: "football" | "futsal"; accentColor?: string; badgeUrl?: string }) => void;
  teams: Array<{ id: string; name: string; ageGroup: string }>;
  clubUsers: ClubUser[];
  currentUserRole: ClubUserRole;
  currentUserTeamIds: string[];
  addClubUser: (user: Omit<ClubUser, "id" | "createdAt">) => void;
  updateClubUser: (id: string, updates: Partial<Omit<ClubUser, "id" | "clubId" | "createdAt">>) => void;
  deleteClubUser: (id: string) => void;
}) {
  const { t } = useLocale();
  const { resetState } = useAppState();
  const isAdmin = currentUserRole === "admin";

  // Club info state
  const [name, setName] = useState(club.name);
  const [region, setRegion] = useState(club.region);
  const [sport, setSport] = useState<"football" | "futsal" | "">(club.sport || "");
  const [accentColor, setAccentColor] = useState(club.accentColor || "#0d9488");
  const [badgeUrl, setBadgeUrl] = useState(club.badgeUrl || "");
  const [badgePreview, setBadgePreview] = useState<string | null>(club.badgeUrl || null);
  const [clubFeedback, setClubFeedback] = useState<"" | "saving" | "saved" | "error">("");
  const [clubError, setClubError] = useState("");

  // User form state
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState<{
    name: string;
    email: string;
    role: ClubUserRole;
    assignedTeamIds: string[];
    permissions: ClubUserPermissions;
  }>({ name: "", email: "", role: "user", assignedTeamIds: [], permissions: { ...DEFAULT_USER_PERMISSIONS } });

  const handleBadgeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setBadgePreview(result);
      setBadgeUrl(result);
    };
    reader.readAsDataURL(file);
  };

  function adjustColor(hex: string, amount: number): string {
    const clean = hex.replace("#", "");
    const r = Math.max(0, Math.min(255, parseInt(clean.substring(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(clean.substring(2, 4), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(clean.substring(4, 6), 16) + amount));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  async function handleSaveClub() {
    setClubFeedback("saving");
    setClubError("");
    // Call updateClub which will update state immediately and sync to Supabase
    updateClub({ name, region, sport: sport || undefined, accentColor, badgeUrl });
    // Show saved feedback after a brief moment
    setTimeout(() => {
      setClubFeedback("saved");
      setTimeout(() => setClubFeedback(""), 3000);
    }, 300);
  }

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", accentColor);
    root.style.setProperty("--accent-strong", adjustColor(accentColor, -20));
    root.style.setProperty("--accent-soft", `${accentColor}1a`);
  }, [accentColor]);

  function openAddUser() {
    setEditingUserId(null);
    setUserForm({ name: "", email: "", role: "user", assignedTeamIds: [], permissions: { ...DEFAULT_USER_PERMISSIONS } });
    setShowAddUser(true);
  }

  function openEditUser(user: ClubUser) {
    setEditingUserId(user.id);
    setUserForm({ name: user.name, email: user.email, role: user.role, assignedTeamIds: user.assignedTeamIds, permissions: { ...user.permissions } });
    setShowAddUser(true);
  }

  const [userSaving, setUserSaving] = useState(false);
  const [userSaveError, setUserSaveError] = useState<string | null>(null);

  async function handleSaveUser() {
    if (!userForm.name.trim() || !userForm.email.trim()) return;
    setUserSaving(true);
    setUserSaveError(null);
    try {
      if (editingUserId) {
        await updateClubUserAction({
          memberId: editingUserId,
          name: userForm.name.trim(),
          role: userForm.role,
          teamIds: userForm.assignedTeamIds,
          permissions: userForm.permissions,
        });
        updateClubUser(editingUserId, {
          name: userForm.name.trim(),
          email: userForm.email.trim(),
          role: userForm.role,
          assignedTeamIds: userForm.assignedTeamIds,
          permissions: userForm.permissions,
        });
      } else {
        await createClubUserAction({
          email: userForm.email.trim(),
          name: userForm.name.trim(),
          role: userForm.role,
          teamIds: userForm.assignedTeamIds,
          permissions: userForm.permissions,
        });
        addClubUser({
          clubId: club.name,
          name: userForm.name.trim(),
          email: userForm.email.trim(),
          role: userForm.role,
          assignedTeamIds: userForm.assignedTeamIds,
          permissions: userForm.permissions,
        });
      }
      setShowAddUser(false);
      setEditingUserId(null);
    } catch (err) {
      setUserSaveError(err instanceof Error ? err.message : "Error desconocido al guardar el usuario.");
    } finally {
      setUserSaving(false);
    }
  }

  function toggleTeam(teamId: string) {
    setUserForm((f) => ({
      ...f,
      assignedTeamIds: f.assignedTeamIds.includes(teamId)
        ? f.assignedTeamIds.filter((id) => id !== teamId)
        : [...f.assignedTeamIds, teamId],
    }));
  }

  const assignedTeams = teams.filter((t) => currentUserTeamIds.includes(t.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t("club.settings")}</h2>
      </div>

      {/* ── ADMIN VIEW ── */}
      {isAdmin ? (
        <>
          {/* Club info & appearance */}
          <div className="rounded-xl border border-line bg-white p-6 space-y-5">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-zinc-400" />
              <h3 className="font-medium">{t("club.adminClubInfoSection")}</h3>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-zinc-700">{t("club.clubName")}</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">{t("club.region")}</label>
                <input type="text" value={region} onChange={(e) => setRegion(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">{t("club.sport")}</label>
                <select value={sport} onChange={(e) => setSport(e.target.value as "football" | "futsal" | "")} className="mt-1 w-full rounded-lg border border-line px-3 py-2">
                  <option value="">{t("club.selectSport")}</option>
                  <option value="football">{t("club.football")}</option>
                  <option value="futsal">{t("club.futsal")}</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Palette className="h-5 w-5 text-zinc-400" />
              <h3 className="font-medium">{t("club.appearance")}</h3>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-zinc-700">{t("club.accentColor")}</label>
                <div className="mt-1 flex items-center gap-2">
                  <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-10 w-10 rounded border border-line" />
                  <input type="text" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="flex-1 rounded-lg border border-line px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">{t("club.badgeUrl")}</label>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={badgeUrl}
                      onChange={(e) => { setBadgeUrl(e.target.value); setBadgePreview(e.target.value); }}
                      placeholder={t("club.badgeUrlPlaceholder")}
                      className="flex-1 rounded-lg border border-line px-3 py-2"
                    />
                    <label className="cursor-pointer rounded-lg border border-line bg-white/70 px-4 py-2 text-sm text-zinc-700 hover:bg-white transition">
                      <input type="file" accept="image/*" className="hidden" onChange={handleBadgeUpload} />
                      {t("club.uploadBadge")}
                    </label>
                  </div>
                  {badgePreview && (
                    <div className="rounded-lg border border-line bg-white/50 p-3">
                      <p className="text-xs text-zinc-600 mb-2">{t("club.badgePreview")}</p>
                      <img src={badgePreview} alt="Club badge preview" className="h-24 w-auto object-contain rounded border border-line/50" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 items-end">
              <button
                type="button"
                onClick={handleSaveClub}
                disabled={clubFeedback === "saving"}
                className={cn(
                  "rounded-full px-6 py-2 text-sm font-medium text-white transition",
                  clubFeedback === "saving"
                    ? "bg-zinc-400 cursor-not-allowed"
                    : clubFeedback === "saved"
                      ? "bg-emerald-500 hover:bg-emerald-600"
                      : clubFeedback === "error"
                        ? "bg-red-500 hover:bg-red-600"
                        : "bg-accent hover:bg-accent/90"
                )}
              >
                {clubFeedback === "saving" ? t("common.saving") || "Guardando..." : t("common.save")}
              </button>
              {clubFeedback === "saved" && (
                <span className="text-sm text-emerald-600 font-medium">✓ {t("common.saved") || "Guardado"}</span>
              )}
              {clubFeedback === "error" && (
                <span className="text-sm text-red-600 font-medium">{clubError || "Error al guardar"}</span>
              )}
            </div>
          </div>

          {/* User management */}
          <div className="rounded-xl border border-line bg-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-zinc-400" />
                <h3 className="font-medium">{t("club.adminUsersSection")}</h3>
              </div>
              <button
                type="button"
                onClick={openAddUser}
                className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-white transition hover:bg-accent/90"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("club.adminAddUser")}
              </button>
            </div>

            <p className="text-sm text-zinc-500">{t("club.adminUsersHint")}</p>

            {clubUsers.length === 0 ? (
              <p className="text-sm text-zinc-400 py-4 text-center">{t("club.adminNoUsers")}</p>
            ) : (
              <div className="space-y-2">
                {clubUsers.map((user) => {
                  const userTeams = teams.filter((tm) => user.assignedTeamIds.includes(tm.id));
                  return (
                    <div key={user.id} className="flex items-center gap-3 rounded-xl border border-line bg-zinc-50/50 px-4 py-3">
                      <div className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold flex-shrink-0",
                        user.role === "admin" ? "bg-accent/10 text-accent" : "bg-zinc-200 text-zinc-600",
                      )}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-zinc-900 truncate">{user.name}</p>
                          <span className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0",
                            user.role === "admin"
                              ? "bg-accent/10 text-accent"
                              : "bg-zinc-100 text-zinc-600",
                          )}>
                            {user.role === "admin" ? t("club.adminRoleAdmin") : t("club.adminRoleUser")}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                        {user.role === "user" && (
                          <p className="text-xs text-zinc-400 mt-0.5">
                            {userTeams.length > 0
                              ? userTeams.map((tm) => tm.name).join(", ")
                              : t("club.adminAllTeams")}
                          </p>
                        )}
                        {user.role === "user" && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(
                              [
                                { key: "canEditAthletes" as const, label: t("club.permAthletes") || "Jugadores" },
                                { key: "canEditAnthropometry" as const, label: t("club.permAnthropometry") || "Antro." },
                                { key: "canEditPerformance" as const, label: t("club.permPerformance") || "Rend." },
                                { key: "canEditTrainingLoad" as const, label: t("club.permTrainingLoad") || "Carga" },
                              ]
                            ).map((p) => (
                              <span
                                key={p.key}
                                className={cn(
                                  "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                                  user.permissions[p.key]
                                    ? "bg-accent/8 text-accent"
                                    : "bg-zinc-100 text-zinc-300 line-through",
                                )}
                              >
                                {p.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditUser(user)}
                          className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-accent transition"
                          title={t("club.adminEditUser")}
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await deleteClubUserAction(user.id);
                              deleteClubUser(user.id);
                            } catch (err) {
                              alert(err instanceof Error ? err.message : "Error al eliminar el usuario.");
                            }
                          }}
                          className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition"
                          title={t("club.adminDeleteUser")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add/edit user form */}
            {showAddUser && (
              <div className="rounded-xl border border-accent/20 bg-accent/5 p-5 space-y-4 mt-2">
                <h4 className="text-sm font-semibold text-zinc-800">
                  {editingUserId ? t("club.adminEditUser") : t("club.adminAddUser")}
                </h4>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">{t("club.adminUserName")}</label>
                    <input
                      type="text"
                      value={userForm.name}
                      onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                      placeholder="Nombre completo"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">{t("club.adminUserEmail")}</label>
                    <input
                      type="email"
                      value={userForm.email}
                      onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))}
                      className="w-full rounded-lg border border-line px-3 py-2 text-sm"
                      placeholder="usuario@club.es"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-2">{t("club.adminUserRole")}</label>
                  <div className="flex gap-2">
                    {(["admin", "user"] as ClubUserRole[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setUserForm((f) => ({ ...f, role: r }))}
                        className={cn(
                          "flex-1 rounded-lg border px-3 py-2.5 text-left transition",
                          userForm.role === r
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-line bg-white text-zinc-600 hover:bg-zinc-50",
                        )}
                      >
                        <p className="text-sm font-medium">{r === "admin" ? t("club.adminRoleAdmin") : t("club.adminRoleUser")}</p>
                        <p className="text-xs mt-0.5 opacity-70">{r === "admin" ? t("club.adminRoleAdminDesc") : t("club.adminRoleUserDesc")}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {userForm.role === "user" && teams.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">{t("club.adminUserTeams")}</label>
                    <p className="text-xs text-zinc-400 mb-2">{t("club.adminUserTeamsHint")}</p>
                    <div className="flex flex-wrap gap-2">
                      {teams.map((tm) => (
                        <button
                          key={tm.id}
                          type="button"
                          onClick={() => toggleTeam(tm.id)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium transition",
                            userForm.assignedTeamIds.includes(tm.id)
                              ? "border-accent bg-accent/10 text-accent"
                              : "border-line bg-white text-zinc-600 hover:bg-zinc-50",
                          )}
                        >
                          {userForm.assignedTeamIds.includes(tm.id) && <Check className="inline h-3 w-3 mr-1" />}
                          {tm.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Permisos de edición — solo para role "user" */}
                {userForm.role === "user" && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-2">
                      {t("club.adminUserPermissions") || "Permisos de edición"}
                    </label>
                    <p className="text-xs text-zinc-400 mb-3">
                      {t("club.adminUserPermissionsHint") || "Elige qué puede modificar este usuario. Siempre podrá ver los datos."}
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {(
                        [
                          { key: "canEditAthletes" as const, label: t("club.permAthletes") || "Gestionar jugadores" },
                          { key: "canEditAnthropometry" as const, label: t("club.permAnthropometry") || "Mediciones antropométricas" },
                          { key: "canEditPerformance" as const, label: t("club.permPerformance") || "Tests de rendimiento" },
                          { key: "canEditTrainingLoad" as const, label: t("club.permTrainingLoad") || "Carga de entrenamiento" },
                        ]
                      ).map((perm) => (
                        <button
                          key={perm.key}
                          type="button"
                          onClick={() =>
                            setUserForm((f) => ({
                              ...f,
                              permissions: {
                                ...f.permissions,
                                [perm.key]: !f.permissions[perm.key],
                              },
                            }))
                          }
                          className={cn(
                            "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition",
                            userForm.permissions[perm.key]
                              ? "border-accent/40 bg-accent/5 text-accent"
                              : "border-zinc-200 bg-zinc-50 text-zinc-400",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition",
                              userForm.permissions[perm.key]
                                ? "border-accent bg-accent"
                                : "border-zinc-300 bg-white",
                            )}
                          >
                            {userForm.permissions[perm.key] && (
                              <Check className="h-2.5 w-2.5 text-white" />
                            )}
                          </span>
                          {perm.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-1 flex-col">
                  {userSaveError && (
                    <p className="text-sm text-red-500">{userSaveError}</p>
                  )}
                  <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveUser}
                    disabled={!userForm.name.trim() || !userForm.email.trim() || userSaving}
                    className="rounded-full bg-accent px-5 py-1.5 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-40"
                  >
                    {userSaving ? "Guardando…" : t("club.adminSaveUser")}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddUser(false); setEditingUserId(null); }}
                    className="rounded-full border border-line px-5 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
                  >
                    {t("club.adminCancelUser")}
                  </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Danger zone */}
          <div className="rounded-[1.75rem] border border-red-200 bg-red-50/50 p-6">
            <h3 className="text-lg font-semibold text-red-900 mb-2">{t("club.dangerZone") || "Zona de peligro"}</h3>
            <p className="text-sm text-red-700 mb-4">
              {t("club.resetWarning") || "Si algo no funciona o quieres empezar de cero con los datos de demo, puedes restablecer la aplicación."}
            </p>
            <button onClick={resetState} className="rounded-full bg-red-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-red-700">
              {t("club.resetApp") || "Restablecer aplicación"}
            </button>
          </div>
        </>
      ) : (
        /* ── USER VIEW (read-only) ── */
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-white p-6 space-y-4">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-zinc-400" />
              <h3 className="font-medium">{t("club.adminMyAccess")}</h3>
            </div>
            <p className="text-sm text-zinc-500">{t("club.adminMyAccessHint")}</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-zinc-50 border border-line p-4">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">{t("club.adminCurrentRole")}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700">
                    <Shield className="h-3.5 w-3.5" />
                    {t("club.adminRoleUser")}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-2">{t("club.adminRoleUserDesc")}</p>
              </div>

              <div className="rounded-lg bg-zinc-50 border border-line p-4">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1">{t("club.adminAssignedTeams")}</p>
                {assignedTeams.length === 0 ? (
                  <p className="text-sm text-zinc-400 mt-2">{t("club.adminNoTeamsAssigned")}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {assignedTeams.map((tm) => (
                      <span key={tm.id} className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                        {tm.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Read-only club info */}
          <div className="rounded-xl border border-line bg-white p-6 space-y-3">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-zinc-400" />
              <h3 className="font-medium">{t("club.clubInfo")}</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-zinc-500">{t("club.clubName")}</p>
                <p className="text-sm font-medium text-zinc-900 mt-0.5">{club.name}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500">{t("club.region")}</p>
                <p className="text-sm font-medium text-zinc-900 mt-0.5">{club.region || "—"}</p>
              </div>
              {club.sport && (
                <div>
                  <p className="text-xs font-medium text-zinc-500">{t("club.sport")}</p>
                  <p className="text-sm font-medium text-zinc-900 mt-0.5">
                    {club.sport === "football" ? t("club.football") : t("club.futsal")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TestBatteryTab({
  testBatteryArea,
  setTestBatteryArea,
  showAddTestForm,
  setShowAddTestForm,
  newDef,
  setNewDef,
  areaTestDefs,
  addDef,
  delDef,
  handleMedia,
  testDefErrors,
  testDefSummary,
  clearTestDefErrors,
  setTestDefErrors,
  updatePerformanceDefinition,
  t,
}: {
  testBatteryArea: PerformanceArea;
  setTestBatteryArea: (area: PerformanceArea) => void;
  showAddTestForm: boolean;
  setShowAddTestForm: (show: boolean) => void;
  newDef: { name: string; nameKey: string | undefined; descriptionKey: string | undefined; unit: string; attempts: number; isRating: boolean; scoringStrategy: "best" | "average"; interpretation: "higher_better" | "lower_better"; description: string; mediaUrl: string; mediaType: "image" | "video" | undefined; subCategory: string | undefined };
  setNewDef: React.Dispatch<React.SetStateAction<typeof newDef>>;
  areaTestDefs: PerformanceDefinition[];
  addDef: (e: React.FormEvent) => void;
  delDef: (id: string) => void;
  handleMedia: (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "video") => void;
  testDefErrors: FieldErrors;
  testDefSummary: string;
  clearTestDefErrors: () => void;
  setTestDefErrors: React.Dispatch<React.SetStateAction<FieldErrors>>;
  updatePerformanceDefinition: (id: string, updates: Partial<PerformanceDefinition>) => void;
  t: (key: string) => string;
}) {
  const { state } = useAppState();
  const searchParams = useSearchParams();
  const [selectedTestDef, setSelectedTestDef] = useState<PerformanceDefinition | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState<{ name: string; unit: string; attempts: number; isRating: boolean; scoringStrategy: "best" | "average"; interpretation: "higher_better" | "lower_better"; description: string; mediaUrl: string; mediaType: "image" | "video" | undefined }>({ name: "", unit: "", attempts: 1, isRating: false, scoringStrategy: "best", interpretation: "higher_better", description: "", mediaUrl: "", mediaType: undefined });

  function openDetail(def: PerformanceDefinition) {
    setSelectedTestDef(def);
    setEditMode(false);
    setEditFields({ name: def.name, unit: def.unit, attempts: def.attempts, isRating: def.isRating ?? false, scoringStrategy: def.scoringStrategy ?? "best", interpretation: def.interpretation ?? "higher_better", description: def.description ?? "", mediaUrl: def.mediaUrl ?? "", mediaType: def.mediaType });
  }

  function closeDetail() {
    setSelectedTestDef(null);
    setEditMode(false);
  }

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      const def = state.performanceDefinitions.find(d => d.id === id);
      if (def) {
        setTestBatteryArea(def.area);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        openDetail(def);
      }
    }
  }, [searchParams, setTestBatteryArea, state.performanceDefinitions]);

  function saveEdit() {
    if (!selectedTestDef) return;
    updatePerformanceDefinition(selectedTestDef.id, {
      name: editFields.name.trim() || selectedTestDef.name,
      nameKey: undefined,
      unit: editFields.unit.trim() || selectedTestDef.unit,
      attempts: editFields.attempts,
      isRating: editFields.isRating,
      scoringStrategy: editFields.scoringStrategy,
      interpretation: editFields.interpretation,
      description: editFields.description || undefined,
      descriptionKey: undefined,
      mediaUrl: editFields.mediaUrl || undefined,
      mediaType: editFields.mediaType,
    });
    closeDetail();
  }

  function handleEditMedia(e: React.ChangeEvent<HTMLInputElement>, type: "image" | "video") {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => { setEditFields(c => ({ ...c, mediaUrl: ev.target?.result as string, mediaType: type })); };
    r.readAsDataURL(f);
  }

  return (
    <section className="panel rounded-[1.75rem] p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t("club.testBattery")}</h2>
          <p className="mt-2 text-sm text-zinc-600">{t("datahub.createMetricsBody")}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddTestForm(!showAddTestForm)}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
            showAddTestForm
              ? "bg-zinc-200 text-zinc-700"
              : "bg-accent text-white hover:bg-accent/90"
          )}
        >
          {showAddTestForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showAddTestForm ? t("datahub.cancel") : t("club.addTest")}
        </button>
      </div>

      {/* Area selector */}
      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {(Object.keys(performanceAreaLabels) as PerformanceArea[]).map(item => {
          const style = areaStyles[item] ?? areaStyles.physical;
          const AreaIcon = style.icon;
          const isActive = testBatteryArea === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => setTestBatteryArea(item as PerformanceArea)}
              className={cn(
                "rounded-2xl border-2 px-5 py-4 text-left transition-all duration-200 hover:shadow-lg",
                isActive ? "border-accent bg-accent text-white shadow-md" : "border-gray-300 bg-white hover:bg-gray-50"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <AreaIcon className={cn("h-5 w-5", isActive ? "text-white/90" : style.iconClass)} />
                <p className="text-base font-semibold leading-tight">{t(performanceAreaLabels[item as PerformanceArea])}</p>
              </div>
              <p className={cn("text-sm", isActive ? "text-white/80" : "text-zinc-500")}>
                {item === "physical" ? t("datahub.physicalDesc") : item === "technicalTactical" ? t("datahub.technicalTacticalDesc") : item === "psychological" ? t("datahub.psychologicalDesc") : t("datahub.motorSkillsDesc")}
              </p>
            </button>
          );
        })}
      </section>

      {/* Chips list */}
      {areaTestDefs.length > 0 ? (
        <div className="rounded-[1.75rem] border border-line bg-white/50 p-6">
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-zinc-900">{t("datahub.testsAvailable")}</h3>
            <p className="mt-1 text-sm text-zinc-600">{areaTestDefs.length} {t("datahub.testsRegistered")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {areaTestDefs.map(d => {
              const style = areaStyles[d.area] ?? areaStyles.physical;
              const AreaIcon = style.icon;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => { openDetail(d); }}
                  className={cn("inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-all duration-150", style.chipClass)}
                >
                  <AreaIcon className={cn("h-3.5 w-3.5 flex-shrink-0", style.iconClass)} />
                  {d.nameKey ? t(d.nameKey) : d.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        !showAddTestForm && (
          <div className="rounded-[1.75rem] border border-dashed border-line bg-white/30 p-12 text-center">
            <Beaker className="h-12 w-12 mx-auto mb-4 text-zinc-400" />
            <p className="text-sm text-zinc-600 mb-4">{t("club.noTestsDefined")}</p>
            <button
              type="button"
              onClick={() => setShowAddTestForm(true)}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent/90"
            >
              <Plus className="h-4 w-4" />
              {t("club.addTest")}
            </button>
          </div>
        )
      )}

      {/* Test Detail / Edit — centred overlay, same style as Modal */}
      {selectedTestDef && typeof document !== "undefined" && createPortal((
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200"
          onClick={closeDetail}
        >
          <div
            className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-line shrink-0">
              <div className="flex min-w-0 items-center gap-4 pr-3">
                {(() => {
                  const style = areaStyles[selectedTestDef.area] ?? areaStyles.physical;
                  const AreaIcon = style.icon;
                  return (
                    <div className={cn("h-14 w-14 rounded-full flex items-center justify-center border flex-shrink-0", style.badgeClass)}>
                      <AreaIcon className="h-7 w-7" />
                    </div>
                  );
                })()}
                <div className="min-w-0">
                  {editMode ? (
                    <input
                      className="w-full rounded-lg border border-line bg-zinc-50 px-3 py-2 text-xl font-bold text-zinc-900 outline-none focus:bg-white focus:ring-2 focus:ring-accent/20"
                      value={editFields.name}
                      onChange={e => setEditFields(c => ({ ...c, name: e.target.value }))}
                    />
                  ) : (
                    <h3 className="text-xl font-bold text-zinc-900 leading-tight">{selectedTestDef.nameKey ? t(selectedTestDef.nameKey) : selectedTestDef.name}</h3>
                  )}
                  {(() => {
                    const style = areaStyles[selectedTestDef.area] ?? areaStyles.physical;
                    const AreaIcon = style.icon;
                    return (
                      <span className={cn("inline-flex items-center gap-1.5 mt-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", style.badgeClass)}>
                        <AreaIcon className="h-3 w-3" />
                        {t(performanceAreaLabels[selectedTestDef.area as PerformanceArea] ?? selectedTestDef.area)}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <button
                type="button"
                onClick={closeDetail}
                className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto px-6 py-5 space-y-6">
              {editMode ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">{t("datahub.metricUnit")}</label>
                      <input
                        className="w-full rounded-lg border border-line bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:bg-white focus:border-accent/50"
                        value={editFields.unit}
                        onChange={e => setEditFields(c => ({ ...c, unit: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">{t("datahub.attemptsCount")}</label>
                      <input
                        type="number" min={1}
                        className="w-full rounded-lg border border-line bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:bg-white focus:border-accent/50"
                        value={editFields.attempts}
                        onChange={e => setEditFields(c => ({ ...c, attempts: Number(e.target.value) || 1 }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">{t("datahub.resultType")}</label>
                      <select
                        className="w-full rounded-lg border border-line bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:bg-white focus:border-accent/50"
                        value={editFields.isRating ? "rating" : "numeric"}
                        onChange={e => setEditFields(c => ({ ...c, isRating: e.target.value === "rating" }))}
                      >
                        <option value="numeric">{t("datahub.resultNumeric")}</option>
                        <option value="rating">{t("datahub.resultRating")}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">{t("datahub.metricGoal")}</label>
                      <select
                        className={cn("w-full rounded-lg border border-line px-3 py-2.5 text-sm text-zinc-900 outline-none transition", editFields.attempts === 1 ? "bg-zinc-100 opacity-50 cursor-not-allowed" : "bg-zinc-50 focus:bg-white focus:border-accent/50")}
                        value={editFields.scoringStrategy}
                        disabled={editFields.attempts === 1}
                        onChange={e => setEditFields(c => ({ ...c, scoringStrategy: e.target.value as "best" | "average" }))}
                      >
                        <option value="best">{t("datahub.calcBest")}</option>
                        <option value="average">{t("datahub.calcAverage")}</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-zinc-500 mb-1">{t("datahub.metricInterpretation")}</label>
                      <select
                        className="w-full rounded-lg border border-line bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:bg-white focus:border-accent/50"
                        value={editFields.interpretation}
                        onChange={e => setEditFields(c => ({ ...c, interpretation: e.target.value as "higher_better" | "lower_better" }))}
                      >
                        <option value="higher_better">{t("datahub.interpretHigher")}</option>
                        <option value="lower_better">{t("datahub.interpretLower")}</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">{t("datahub.testDescriptionOptional")}</label>
                    <textarea
                      className="w-full rounded-lg border border-line bg-zinc-50 px-3 py-2.5 text-sm text-zinc-900 outline-none focus:bg-white focus:border-accent/50 resize-none"
                      rows={3}
                      value={editFields.description}
                      onChange={e => setEditFields(c => ({ ...c, description: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-2">{t("datahub.mediaOptional")}</label>
                    <div className="flex gap-3">
                      <label className="flex-1 cursor-pointer">
                        <div className="flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50 py-3 hover:bg-zinc-100 transition text-zinc-500 text-sm font-medium">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          {t("datahub.image")}
                        </div>
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleEditMedia(e, "image")} />
                      </label>
                      <label className="flex-1 cursor-pointer">
                        <div className="flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50 py-3 hover:bg-zinc-100 transition text-zinc-500 text-sm font-medium">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          {t("datahub.video")}
                        </div>
                        <input type="file" accept="video/*" className="hidden" onChange={e => handleEditMedia(e, "video")} />
                      </label>
                    </div>
                    {editFields.mediaUrl && (
                      <div className="mt-3 rounded-xl border border-line bg-zinc-50 p-3 relative group">
                        <button type="button" onClick={() => setEditFields(c => ({ ...c, mediaUrl: "", mediaType: undefined }))} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"><X className="h-3 w-3" /></button>
                        {editFields.mediaType === "image" ? (
                          <img src={editFields.mediaUrl} alt="preview" className="max-h-56 w-full rounded-lg object-contain" />
                        ) : (
                          <video src={editFields.mediaUrl} className="max-h-56 w-full rounded-lg bg-black object-contain" controls />
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-zinc-50 px-3 py-2.5">
                      <p className="text-xs text-zinc-500 mb-0.5">{t("datahub.metricUnit")}</p>
                      <p className="font-medium text-zinc-900">{selectedTestDef.unit}</p>
                    </div>
                    <div className="rounded-xl bg-zinc-50 px-3 py-2.5">
                      <p className="text-xs text-zinc-500 mb-0.5">{t("datahub.attemptsCount")}</p>
                      <p className="font-medium text-zinc-900">{selectedTestDef.attempts}</p>
                    </div>
                    <div className="rounded-xl bg-zinc-50 px-3 py-2.5">
                      <p className="text-xs text-zinc-500 mb-0.5">{t("datahub.metricGoal")}</p>
                      <p className="font-medium text-zinc-900">{selectedTestDef.scoringStrategy === "average" ? t("datahub.calcAverage") : t("datahub.calcBest")}</p>
                    </div>
                    <div className="rounded-xl bg-zinc-50 px-3 py-2.5">
                      <p className="text-xs text-zinc-500 mb-0.5">{t("datahub.metricInterpretation")}</p>
                      <p className="font-medium text-zinc-900">{selectedTestDef.interpretation === "lower_better" ? t("datahub.interpretLower") : t("datahub.interpretHigher")}</p>
                    </div>
                    <div className="col-span-2 rounded-xl bg-zinc-50 px-3 py-2.5">
                      <p className="text-xs text-zinc-500 mb-0.5">{t("datahub.resultType")}</p>
                      <p className="font-medium text-zinc-900">{selectedTestDef.isRating ? t("datahub.resultRating") : t("datahub.resultNumeric")}</p>
                    </div>
                  </div>
                  {(selectedTestDef.descriptionKey || selectedTestDef.description) && (
                    <p className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-zinc-600 leading-relaxed">
                      {selectedTestDef.descriptionKey ? t(selectedTestDef.descriptionKey) : selectedTestDef.description}
                    </p>
                  )}
                  {selectedTestDef.mediaUrl && (
                    <div className="rounded-xl overflow-hidden border border-line bg-zinc-50">
                      {selectedTestDef.mediaType === "image" ? (
                        <img src={selectedTestDef.mediaUrl} alt="preview" className="max-h-[52vh] w-full object-contain" />
                      ) : (
                        <video src={selectedTestDef.mediaUrl} className="max-h-[52vh] w-full bg-black object-contain" controls />
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Footer actions */}
              <div className="flex items-center gap-3 pt-4 border-t border-line">
                {editMode ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditMode(false)}
                      className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition"
                    >
                      {t("datahub.cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={saveEdit}
                      className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-slate-950 hover:bg-accent-strong transition shadow-md shadow-accent/20"
                    >
                      {t("datahub.save")}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => { delDef(selectedTestDef.id); closeDetail(); }}
                      className="flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                      {t("datahub.delete")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditMode(true)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-slate-950 hover:bg-accent-strong transition shadow-md shadow-accent/20"
                    >
                      <Edit2 className="h-4 w-4" />
                      {t("datahub.edit")}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ), document.body)}

      {/* Add test — centred overlay, same style as Modal */}
      {showAddTestForm && typeof document !== "undefined" && createPortal((
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200"
          onClick={() => setShowAddTestForm(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between shrink-0">
              <h3 className="text-xl font-bold text-zinc-900">{t("datahub.addMetricTitle")}</h3>
              <button
                type="button"
                onClick={() => setShowAddTestForm(false)}
                className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={addDef} className="overflow-y-auto pr-1 -mr-1 space-y-4">
              <FormErrorBanner summary={testDefSummary} fieldErrors={testDefErrors} t={t} />
              {/* Preset Selector */}
              <div className="rounded-xl border-2 border-accent/20 bg-accent/5 p-4">
                <label className="block text-xs font-bold text-accent mb-2 uppercase tracking-tight">{t("datahub.usePreset") || "Usar test predefinido"}</label>
                <select
                  className="w-full rounded-lg border border-accent/30 bg-white px-3 py-2.5 text-sm text-zinc-700 outline-none focus:ring-2 focus:ring-accent/10 font-sans"
                  onChange={(e) => {
                    const preset = performancePresets[testBatteryArea].find(p => p.name === e.target.value);
                    if (preset) {
                      setNewDef({
                        name: preset.name,
                        nameKey: preset.nameKey,
                        descriptionKey: preset.descriptionKey,
                        unit: preset.unit,
                        attempts: preset.scoringStrategy === "average" ? 3 : 1,
                        isRating: preset.isRating,
                        scoringStrategy: preset.scoringStrategy,
                        interpretation: preset.interpretation,
                        description: "",
                        mediaUrl: "",
                        mediaType: undefined,
                        subCategory: undefined,
                      });
                    }
                  }}
                  value=""
                >
                  <option value="" disabled>{t("datahub.selectPreset") || "-- Seleccionar test --"}</option>
                  {performancePresets[testBatteryArea].map(p => (
                    <option key={p.name} value={p.name}>{p.nameKey ? t(p.nameKey) : p.name}</option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-zinc-500 italic">
                  {t("datahub.presetHint") || "Selecciona un test común para rellenar los campos automáticamente."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium text-zinc-500">{t("datahub.metricName")}</label>
                  <input
                    className={clubInputClass(Boolean(testDefErrors.name), "bg-zinc-50 focus:bg-white")}
                    placeholder={t("datahub.exampleMetricNames")}
                    value={newDef.nameKey ? t(newDef.nameKey) : newDef.name}
                    onChange={e => {
                      setNewDef(c => ({ ...c, name: e.target.value, nameKey: undefined, descriptionKey: undefined }));
                      setTestDefErrors(prev => clearFieldError(prev, "name"));
                    }}
                  />
                  <FieldError message={testDefErrors.name} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-500">{t("datahub.metricUnit")}</label>
                  <input
                    className={clubInputClass(Boolean(testDefErrors.unit), "bg-zinc-50 focus:bg-white")}
                    placeholder={t("datahub.exampleMetricUnit")}
                    value={newDef.unit}
                    onChange={e => {
                      setNewDef(c => ({ ...c, unit: e.target.value }));
                      setTestDefErrors(prev => clearFieldError(prev, "unit"));
                    }}
                  />
                  <FieldError message={testDefErrors.unit} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-500">{t("datahub.attemptsCount")}</label>
                  <input
                    type="number" min={1}
                    className="w-full rounded-lg border border-line bg-zinc-50 px-3 py-2.5 text-sm outline-none focus:bg-white focus:border-accent/50 font-sans"
                    placeholder={t("datahub.exampleAttempts")}
                    value={newDef.attempts}
                    onChange={e => setNewDef(c => ({ ...c, attempts: Number(e.target.value) || 1 }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-500">{t("datahub.resultType")}</label>
                  <select
                    className="w-full rounded-lg border border-line bg-zinc-50 px-3 py-2.5 text-sm outline-none focus:bg-white focus:border-accent/50 font-sans"
                    value={newDef.isRating ? "rating" : "numeric"}
                    onChange={e => setNewDef(c => ({ ...c, isRating: e.target.value === "rating" }))}
                  >
                    <option value="numeric">{t("datahub.resultNumeric")}</option>
                    <option value="rating">{t("datahub.resultRating")}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-500">{t("datahub.metricGoal")}</label>
                  <select
                    className={cn("w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none font-sans transition", newDef.attempts === 1 ? "bg-zinc-100 opacity-50 cursor-not-allowed" : "bg-zinc-50 focus:bg-white focus:border-accent/50")}
                    value={newDef.scoringStrategy}
                    disabled={newDef.attempts === 1}
                    onChange={e => setNewDef(c => ({ ...c, scoringStrategy: e.target.value as "best" | "average" }))}
                  >
                    <option value="best">{t("datahub.calcBest")}</option>
                    <option value="average">{t("datahub.calcAverage")}</option>
                  </select>
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium text-zinc-500">{t("datahub.metricInterpretation")}</label>
                  <select
                    className="w-full rounded-lg border border-line bg-zinc-50 px-3 py-2.5 text-sm outline-none focus:bg-white focus:border-accent/50 font-sans"
                    value={newDef.interpretation}
                    onChange={e => setNewDef(c => ({ ...c, interpretation: e.target.value as "higher_better" | "lower_better" }))}
                  >
                    <option value="higher_better">{t("datahub.interpretHigher")}</option>
                    <option value="lower_better">{t("datahub.interpretLower")}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-500">{t("datahub.testDescriptionOptional")}</label>
                <textarea
                  className="w-full rounded-lg border border-line bg-zinc-50 px-3 py-2.5 text-sm outline-none focus:bg-white focus:border-accent/50 font-sans resize-none"
                  placeholder={t("datahub.exampleTestDescription")}
                  rows={3}
                  value={newDef.descriptionKey ? t(newDef.descriptionKey) : newDef.description}
                  onChange={e => setNewDef(c => ({ ...c, description: e.target.value, descriptionKey: undefined }))}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-500 mb-2 block">{t("datahub.mediaOptional")}</label>
                <div className="flex gap-3">
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50 py-4 hover:bg-zinc-100 transition text-zinc-500 text-sm font-medium">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      {t("datahub.image")}
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleMedia(e, "image")} />
                  </label>
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50 py-4 hover:bg-zinc-100 transition text-zinc-500 text-sm font-medium">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {t("datahub.video")}
                    </div>
                    <input type="file" accept="video/*" className="hidden" onChange={e => handleMedia(e, "video")} />
                  </label>
                </div>
                {newDef.mediaUrl && (
                  <div className="mt-3 rounded-xl border border-line bg-zinc-50 p-3 relative group">
                    <button type="button" onClick={() => setNewDef(c => ({ ...c, mediaUrl: "", mediaType: undefined }))} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"><X className="h-3 w-3" /></button>
                    <p className="text-xs text-zinc-500 mb-2 font-semibold uppercase tracking-wide">{t("datahub.selectedMedia")} — {newDef.mediaType}</p>
                    {newDef.mediaType === "image" ? (
                      <img src={newDef.mediaUrl} alt="preview" className="max-h-56 w-full rounded-lg object-contain" />
                    ) : (
                      <video src={newDef.mediaUrl} className="max-h-56 w-full rounded-lg bg-black object-contain" controls />
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { clearTestDefErrors(); setShowAddTestForm(false); }}
                  className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition"
                >
                  {t("datahub.cancel")}
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-slate-950 hover:bg-accent-strong transition shadow-md shadow-accent/20"
                >
                  {t("datahub.createMetric")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ), document.body)}
    </section>
  );
}