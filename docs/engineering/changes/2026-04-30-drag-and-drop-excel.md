# Drag and Drop Excel Support

Implemented drag and drop functionality for Excel files in all data import zones within the DataHub.

## Changes

### 1. Reusable Drag & Drop Pattern
Added a consistent set of event handlers (`onDragOver`, `onDragLeave`, `onDrop`) to the upload zones in:
- **Maturation Section**: Bulk import of anthropometric measurements.
- **Club Section**: Bulk import of players in the "Add Player" modal.
- **Performance Section**: Bulk import of test results in the "Add Result" modal.

### 2. Visual Feedback
- Upload zones now change their border color to emerald and background to a soft green when a file is dragged over them.
- Smooth transitions ensure a premium feel.

### 3. File Validation
- The system automatically filters dropped files to only accept `.xlsx` and `.xls` formats, triggering the same import logic as the manual selection.

## Technical Details
The implementation uses native browser drag-and-drop events and simulates a `React.ChangeEvent<HTMLInputElement>` to reuse existing import functions without major refactorings.

**Files modified:**
- `src/app/(protected)/datahub/maturation-section.tsx`
- `src/app/(protected)/datahub/club-section.tsx`
- `src/app/(protected)/datahub/performance-section.tsx`
