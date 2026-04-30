# UUID Validation in Server Actions

Fixed a critical issue where the application would crash when trying to delete or update items that had temporary client-side IDs.

## The Problem
The application uses optimistic updates with temporary IDs (e.g., `ath_asm0hzdb`). When a user attempts to delete an item that was recently added (and potentially not yet fully persisted or failed to persist in Supabase), the server action was receiving the temporary ID string. Supabase, expecting a UUID for its primary keys, would throw an "invalid input syntax for type uuid" error.

## The Fix
1.  **Utility Function**: Added `isUUID(id: string)` to `src/lib/utils.ts` to validate if a string follows the UUID format.
2.  **Action Guards**: Implemented guards in all major server actions:
    - `src/lib/actions/athletes.ts`
    - `src/lib/actions/records.ts`
    - `src/lib/actions/teams.ts`
3.  **Behavior**: If an action receives a non-UUID ID, it now returns silently. This prevents the database error and allows the UI to continue its optimistic removal of the item without showing a crash report to the user.

## Files Modified
- `src/lib/utils.ts`
- `src/lib/actions/athletes.ts`
- `src/lib/actions/records.ts`
- `src/lib/actions/teams.ts`
