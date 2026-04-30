# Fix: Photo deletion not persisting + next.config cleanup

**Date:** 2026-04-30  
**Branch:** codex/supabase

---

## Problems fixed

### 1. Deleting a player/team photo did not persist after logout/login

**Root cause:**  
In `club-section.tsx`, both `handleSaveEdit` and `handleSaveAdd` passed:

```ts
photoUrl: photoUrl || undefined
```

When the user removed a photo, `photoUrl` became `""`. The expression `"" || undefined` evaluates to `undefined`. In `toAthleteUpdate` (`src/lib/actions/athletes.ts`), the field is only included in the Supabase UPDATE when `updates.photoUrl !== undefined`:

```ts
...(updates.photoUrl !== undefined ? { photo_url: updates.photoUrl ?? null } : {}),
```

Since `undefined` skipped that condition, `photo_url` was never sent to Supabase — the old URL remained in the database. The UI showed the photo as removed (local state spread `{ photoUrl: undefined }`) but after a page reload or re-login the photo reappeared from the DB.

**Fix:**  
Changed `photoUrl || undefined` → `photoUrl || null` in all four call sites (athlete add, athlete edit, team add, team edit). `null !== undefined` passes the condition, so Supabase receives `photo_url: null` and clears the field correctly.

Updated all relevant inline prop type annotations and the shared `Athlete` / `Team` interfaces in `src/lib/types.ts` to accept `photoUrl?: string | null`.

**Files changed:**
- `src/app/(protected)/datahub/club-section.tsx` — 4 call sites + 5 inline prop type annotations
- `src/lib/types.ts` — `Athlete.photoUrl` and `Team.photoUrl` now `string | null | undefined`

---

### 2. Invalid `api` key in `next.config.mjs` caused startup warning

**Root cause:**  
A previous change added a `api.bodyParser.sizeLimit` block to `next.config.mjs` to increase the request size limit for photo uploads. This key is only valid in the Pages Router (`pages/api/`). In the App Router (which this project uses), it is unrecognised and triggers:

```
⚠ Invalid next.config.mjs options detected:
⚠     Unrecognized key(s) in object: 'api'
```

The actual upload size limit for Server Actions is controlled by `experimental.serverActions.bodySizeLimit`, which was already correctly set to `'50mb'`.

**Fix:**  
Removed the `api` block entirely from `next.config.mjs`.

**Files changed:**
- `next.config.mjs` — removed invalid `api.bodyParser` block