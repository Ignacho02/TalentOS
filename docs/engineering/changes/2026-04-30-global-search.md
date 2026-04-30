# Global Search Feature

## Overview
Implement a global search functionality accessible from the top navbar. This feature allows users to quickly find players, teams, areas, and tests through a Command Palette style interface.

## Goals
- Add a search icon (magnifying glass) next to the language selector in the `Navbar`.
- Implement a floating `GlobalSearch` bar that appears when the icon is clicked.
- Support searching for:
  - **Athletes**: Names, positions.
  - **Teams**: Names.
  - **Performance Tests**: Names.
  - **App Areas**: Navigation links.
- Keyboard shortcut support (`Ctrl+K` or `Cmd+K`).
- Simple aesthetic: Compact floating bar, no background dimming, no layout shifts.

## Technical Details

### Components
- `GlobalSearch`: Compact floating search bar.
- `SearchIcon`: Integrated into `Navbar`.

### Data Sources
The search will filter data from the global `AppState`:
- `state.athletes`
- `state.teams`
- `state.performanceDefinitions`
- Static `navigation` array from `Navbar.tsx`.

### UI/UX
- Compact floating bar below navbar.
- No backdrop blur (cleaner interaction).
- Dropdown results as you type.
- Keyboard navigation (Arrow keys, Enter).
- Empty state handling.

## Implementation Steps
1. Create `src/components/command-palette.tsx`.
2. Update `src/components/navbar.tsx` to include the search button and the palette.
3. Add i18n keys for search-related labels.
4. Test keyboard shortcuts and responsive design.
