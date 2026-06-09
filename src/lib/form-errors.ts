import type { ZodError, ZodIssue } from "zod";
export { invalidInputClass } from "@/components/field-error";
import type { AnthropometricRecordInput, PerformanceEntryInput } from "@/lib/types";
import {
  AnthropometricRecordSchema,
  ClubAthleteSchema,
  ClubTeamSchema,
  PerformanceEntrySchema,
  TestDefinitionSchema,
  MaturationPlayerProfileSchema,
} from "@/lib/validations";

export type FieldErrors = Record<string, string>;
export type TranslateFn = (key: string) => string;

const ISSUE_MESSAGE_KEYS: Record<string, string> = {
  invalid_date: "datahub.validations.issue.invalidDate",
  future_date: "datahub.validations.issue.futureDate",
  sitting_vs_stature: "datahub.validations.issue.sittingVsStature",
  stature_range: "datahub.validations.issue.statureRange",
  mass_range: "datahub.validations.issue.massRange",
  sitting_range: "datahub.validations.issue.sittingRange",
  parent_height_range: "datahub.validations.issue.parentHeightRange",
  value_required: "datahub.validations.issue.valueRequired",
  rating_required: "datahub.validations.issue.ratingRequired",
  athlete_not_found: "datahub.validations.issue.athleteNotFound",
};

const FIELD_REQUIRED_KEYS: Record<string, string> = {
  athleteName: "datahub.validations.required.athleteName",
  name: "datahub.validations.required.name",
  ageGroup: "datahub.validations.required.ageGroup",
  dob: "datahub.validations.required.dob",
  teamId: "datahub.validations.required.team",
  teamName: "datahub.validations.required.team",
  dataCollectionDate: "datahub.validations.required.measurementDate",
  measurementDate: "datahub.validations.required.measurementDate",
  statureCm: "datahub.validations.required.statureCm",
  bodyMassKg: "datahub.validations.required.bodyMassKg",
  sittingHeightCm: "datahub.validations.required.sittingHeightCm",
  testName: "datahub.validations.required.testName",
  unit: "datahub.validations.required.unit",
  value: "datahub.validations.required.value",
  ratingLevel: "datahub.validations.required.rating",
  clubName: "datahub.validations.required.clubName",
  sex: "datahub.validations.required.sex",
};

/** Short labels for error summary lists (banner). */
export const FIELD_LABEL_KEYS: Record<string, string> = {
  athleteName: "datahub.playerName",
  name: "datahub.playerName",
  ageGroup: "datahub.ageGroup",
  dob: "datahub.birthDate",
  teamId: "datahub.team",
  teamName: "datahub.team",
  dataCollectionDate: "datahub.measurement",
  measurementDate: "datahub.measurement",
  statureCm: "datahub.statureCm",
  bodyMassKg: "datahub.bodyMassKg",
  sittingHeightCm: "datahub.sittingHeightCm",
  testName: "datahub.test",
  unit: "datahub.metricUnit",
  value: "datahub.value",
  ratingLevel: "datahub.rating",
  motherHeightCm: "datahub.motherHeightCm",
  fatherHeightCm: "datahub.fatherHeightCm",
  sex: "datahub.sex",
};

export type FieldErrorListItem = { id: string; label: string; message: string };

export function fieldErrorsToListItems(
  t: TranslateFn,
  fieldErrors: FieldErrors,
): FieldErrorListItem[] {
  return Object.entries(fieldErrors).map(([field, message]) => ({
    id: field,
    label: FIELD_LABEL_KEYS[field] ? t(FIELD_LABEL_KEYS[field]) : field,
    message,
  }));
}

export function fieldErrorKey(field: string): string {
  return field;
}

export function parseZodErrors(error: ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : "_form";
    if (!errors[key]) {
      errors[key] = issue.message;
    }
  }
  return errors;
}

export function resolveValidationMessage(
  t: TranslateFn,
  field: string,
  issue: ZodIssue,
): string {
  const code = issue.message;
  if (code === "required" || issue.code === "too_small") {
    const fieldKey = FIELD_REQUIRED_KEYS[field];
    if (fieldKey) return t(fieldKey);
    return t("datahub.validations.issue.required");
  }
  if (ISSUE_MESSAGE_KEYS[code]) {
    return t(ISSUE_MESSAGE_KEYS[code]);
  }
  if (issue.code === "invalid_format" || code === "invalid_date") {
    const dateFields = new Set(["dob", "dataCollectionDate", "measurementDate"]);
    if (dateFields.has(field)) {
      return t("datahub.validations.issue.invalidDate");
    }
  }
  return t("datahub.validations.issue.generic");
}

export function zodToFieldErrors(t: TranslateFn, error: ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path.length > 0 ? String(issue.path[0]) : "_form";
    if (!result[field]) {
      result[field] = resolveValidationMessage(t, field, issue);
    }
  }
  return result;
}

export function validationSummary(t: TranslateFn, fieldErrors: FieldErrors): string {
  return t("datahub.validations.summary");
}

export function preprocessAnthropometricForm(
  form: AnthropometricRecordInput,
): AnthropometricRecordInput {
  return {
    ...form,
    athleteName: form.athleteName?.trim() ?? "",
    ageGroup: form.ageGroup?.trim() ?? "",
    clubName: form.clubName?.trim() ?? "",
    dob: form.dob?.trim() ?? "",
    dataCollectionDate: form.dataCollectionDate?.trim() ?? "",
    statureCm: form.statureCm > 0 ? form.statureCm : 0,
    bodyMassKg: form.bodyMassKg > 0 ? form.bodyMassKg : 0,
    sittingHeightCm: form.sittingHeightCm > 0 ? form.sittingHeightCm : 0,
  };
}

export function validateAnthropometric(
  t: TranslateFn,
  form: AnthropometricRecordInput,
  options?: { requireAthlete?: boolean },
) {
  const errors: FieldErrors = {};
  if (options?.requireAthlete && !form.athleteName.trim()) {
    errors.athleteName = t("datahub.validations.required.athleteName");
  }
  const parsed = AnthropometricRecordSchema.safeParse(preprocessAnthropometricForm(form));
  if (!parsed.success) {
    Object.assign(errors, zodToFieldErrors(t, parsed.error));
  }
  if (Object.keys(errors).length > 0) {
    return { success: false as const, fieldErrors: errors, summary: validationSummary(t, errors) };
  }
  return { success: true as const, data: parsed.data };
}

export function validateMaturationPlayerProfile(
  t: TranslateFn,
  input: Pick<AnthropometricRecordInput, "athleteName" | "sex" | "ageGroup" | "dob" | "teamName" | "position">,
) {
  const parsed = MaturationPlayerProfileSchema.safeParse({
    athleteName: input.athleteName?.trim() ?? "",
    sex: input.sex,
    ageGroup: input.ageGroup?.trim() ?? "",
    dob: input.dob?.trim() ?? "",
    teamName: input.teamName?.trim() || undefined,
    position: input.position?.trim() || undefined,
  });
  if (!parsed.success) {
    const fieldErrors = zodToFieldErrors(t, parsed.error);
    return { success: false as const, fieldErrors, summary: validationSummary(t, fieldErrors) };
  }
  return { success: true as const, data: parsed.data };
}

export function validateClubAthlete(
  t: TranslateFn,
  input: { name: string; ageGroup: string; dob: string; teamId: string },
) {
  const parsed = ClubAthleteSchema.safeParse({
    name: input.name.trim(),
    ageGroup: input.ageGroup.trim(),
    dob: input.dob.trim(),
    teamId: input.teamId.trim(),
  });
  if (!parsed.success) {
    const fieldErrors = zodToFieldErrors(t, parsed.error);
    return { success: false as const, fieldErrors, summary: validationSummary(t, fieldErrors) };
  }
  return { success: true as const, data: parsed.data };
}

export function validateClubTeam(
  t: TranslateFn,
  input: { name: string; ageGroup: string },
) {
  const parsed = ClubTeamSchema.safeParse({
    name: input.name.trim(),
    ageGroup: input.ageGroup.trim(),
  });
  if (!parsed.success) {
    const fieldErrors = zodToFieldErrors(t, parsed.error);
    return { success: false as const, fieldErrors, summary: validationSummary(t, fieldErrors) };
  }
  return { success: true as const, data: parsed.data };
}

export function validateTestDefinition(
  t: TranslateFn,
  input: { name: string; unit: string },
) {
  const parsed = TestDefinitionSchema.safeParse({
    name: input.name.trim(),
    unit: input.unit.trim(),
  });
  if (!parsed.success) {
    const fieldErrors = zodToFieldErrors(t, parsed.error);
    return { success: false as const, fieldErrors, summary: validationSummary(t, fieldErrors) };
  }
  return { success: true as const, data: parsed.data };
}

export function validatePerformanceEntry(
  t: TranslateFn,
  input: PerformanceEntryInput,
  options: { isRating: boolean },
) {
  const fieldErrors: FieldErrors = {};
  const parsed = PerformanceEntrySchema.safeParse({
    athleteName: input.athleteName?.trim() ?? "",
    measurementDate: input.measurementDate?.trim() ?? "",
    testName: input.testName?.trim() ?? "",
    value: input.value,
    ratingLevel: input.ratingLevel?.trim() || undefined,
    ratingValue: input.ratingValue,
  });
  if (!parsed.success) {
    Object.assign(fieldErrors, zodToFieldErrors(t, parsed.error));
  }

  if (options.isRating) {
    if (!input.ratingLevel?.trim()) {
      fieldErrors.ratingLevel = t("datahub.validations.required.rating");
    }
  } else if (!input.value || input.value <= 0) {
    fieldErrors.value = t("datahub.validations.required.value");
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false as const, fieldErrors, summary: validationSummary(t, fieldErrors) };
  }

  return { success: true as const, data: parsed.success ? parsed.data : input };
}

export function clearFieldError(
  fieldErrors: FieldErrors,
  field: string,
): FieldErrors {
  if (!fieldErrors[field]) return fieldErrors;
  const next = { ...fieldErrors };
  delete next[field];
  return next;
}