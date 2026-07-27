---
description: "Use when: adding or changing filters, filter buttons, clear-filter actions, filter drawers, search filters, status/group filters, or list filtering UX in React/Next.js screens."
applyTo: "apps/web/src/**/*.{ts,tsx,css}"
---
# Web Filter Components Pattern

- Use the shared filter action components from `@/components/filters/FilterActionButtons` for list filter controls:
  - `FilterButton` opens the filter surface and receives `activeCount` with the number of applied filters.
  - `ClearFiltersButton` clears all applied filters and should be disabled when no filter is active.
- Place filter actions together in `.filter-actions-row`, usually beside the list title/count.
- Prefer a right-side drawer for multi-field filters. Use the existing classes `.filter-drawer-layer`, `.filter-drawer-backdrop`, `.filter-drawer-panel`, `.filter-drawer-heading`, `.filter-drawer-fields`, and `.filter-drawer-actions` instead of creating one-off filter layouts.
- Drawer filters should have separate draft state and applied state when there is an `Aplicar filtros` button:
  - opening the drawer copies the current applied filters into draft state;
  - changing drawer fields updates only draft state;
  - clicking `Aplicar filtros` commits the draft values to applied state, closes the drawer, and triggers data loading;
  - clicking `Limpar filtros` clears both draft and applied state.
- Show the active filter count from applied state only. Do not count draft changes that have not been applied yet.
- Persist applied filters in `localStorage` when the screen is an operational list that users revisit during the same workflow, especially patient lists. Load saved filters before the first server-backed list request, and keep draft state synchronized when opening the drawer.
- Keep filtering server-backed for list screens. Build query params for every applied filter such as `limit`, `search`, `groupId`, and `status`, and include those same values in the frontend cache key.
- After mutations that can change filtered results, clear the list cache and refetch the current applied query instead of showing stale filtered data.
- Keep content visible while filters refresh the list. Use the existing inline loading pattern and disable only the affected list/actions when possible.
- Use clear, user-facing labels in Portuguese for filter fields and list-size controls, such as `Buscar usuario`, `Grupo`, `Status`, `Nº de usuarios exibidos`, and `Nº de pacientes exibidos`. Patient list screens should default this control to `40`.
- Validate filter changes with focused checks: `npm.cmd run typecheck`, focused `npx.cmd eslint <changed files>`, and a browser read/snapshot when the drawer or visual state changes.