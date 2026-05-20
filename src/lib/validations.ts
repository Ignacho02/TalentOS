import { z } from "zod";

const isoDate = z
  .string()
  .min(1, "required")
  .regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date");

const requiredPositive = () =>
  z.number().refine((v) => v > 0, { message: "required" });

// Anthropometric validation schema
export const AnthropometricRecordSchema = z
  .object({
    athleteName: z.string().trim().min(1, "required").max(100),
    sex: z.enum(["male", "female"]),
    ageGroup: z.string().trim().min(1, "required").max(20),
    clubName: z.string().trim().min(1, "required").max(50),
    teamName: z.string().optional(),
    position: z.string().optional(),
    dob: isoDate,
    dataCollectionDate: isoDate,
    statureCm: requiredPositive().refine((v) => v >= 120 && v <= 230, { message: "stature_range" }),
    bodyMassKg: requiredPositive().refine((v) => v >= 20 && v <= 150, { message: "mass_range" }),
    sittingHeightCm: requiredPositive().refine((v) => v >= 60 && v <= 120, { message: "sitting_range" }),
    motherHeightCm: z
      .number()
      .min(140, "parent_height_range")
      .max(220, "parent_height_range")
      .nullable()
      .optional(),
    fatherHeightCm: z
      .number()
      .min(140, "parent_height_range")
      .max(220, "parent_height_range")
      .nullable()
      .optional(),
  })
  .refine(
    (data) => {
      const collectionDate = new Date(data.dataCollectionDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return collectionDate <= today;
    },
    {
      message: "future_date",
      path: ["dataCollectionDate"],
    },
  )
  .refine((data) => data.sittingHeightCm < data.statureCm, {
    message: "sitting_vs_stature",
    path: ["sittingHeightCm"],
  });

export const MaturationPlayerProfileSchema = z.object({
  athleteName: z.string().trim().min(1, "required").max(100),
  sex: z.enum(["male", "female"]),
  ageGroup: z.string().trim().min(1, "required").max(20),
  dob: isoDate,
  teamName: z.string().optional(),
  position: z.string().optional(),
});

export const ClubAthleteSchema = z.object({
  name: z.string().trim().min(1, "required").max(100),
  ageGroup: z.string().trim().min(1, "required").max(20),
  dob: isoDate,
  teamId: z.string().trim().min(1, "required"),
});

export const ClubTeamSchema = z.object({
  name: z.string().trim().min(1, "required").max(80),
  ageGroup: z.string().trim().min(1, "required").max(20),
});

export const TestDefinitionSchema = z.object({
  name: z.string().trim().min(1, "required").max(80),
  unit: z.string().trim().min(1, "required").max(20),
});

export const PerformanceEntrySchema = z.object({
  athleteName: z.string().trim().min(1, "required").max(100),
  measurementDate: isoDate,
  testName: z.string().trim().min(1, "required").max(80),
  value: z.number(),
  ratingLevel: z.string().optional(),
  ratingValue: z.number().optional(),
});

// Legacy performance record validation schema (imports / API)
export const PerformanceRecordSchema = z.object({
  athleteName: z.string().min(1, "required").max(100),
  testCategory: z.enum(["Physical", "Technical-Tactical", "Psychological"]),
  testName: z.string().min(1, "required").max(50),
  testValue: z.number().min(0),
  testUnit: z.string().min(1, "required").max(20),
  dataCollectionDate: isoDate,
});

export const UserPreferencesSchema = z.object({
  locale: z.enum(["en", "es"]),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "required"),
});

export type AnthropometricRecordValidated = z.infer<typeof AnthropometricRecordSchema>;
export type PerformanceRecordInput = z.infer<typeof PerformanceRecordSchema>;
export type UserPreferencesInput = z.infer<typeof UserPreferencesSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
