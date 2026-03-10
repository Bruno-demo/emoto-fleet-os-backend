# Dashboard UX Plan

## Top 8 UX Issues
1. Shell structure is inconsistent across pages: repeated card patterns, uneven spacing, and no responsive sidebar collapse state.
2. Tables are all bespoke, which creates inconsistent filters, spacing, empty states, and loading behavior.
3. Severity and status colors are not standardized, so the same event/incident meaning looks different between pages.
4. Live Operations splits attention poorly: map, feed, command actions, and bike context compete for space instead of forming a clear command center hierarchy.
5. Incidents require too much scanning to triage; status filters, primary actions, and evidence-pack state are visually secondary.
6. Realtime feedback is noisy and incomplete: toast behavior is per-page, not grouped, and websocket connection state is invisible.
7. Forms rely on ad-hoc inline styles with weak validation affordances, especially in zones and login.
8. Loading and empty states are sparse, so pages jump from blank to full content and do not guide the next action.

## Token Decisions
- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 with 40+ only for shell sections.
- Radius: 12 for controls, 18 for panels, 24 for primary surfaces, full for pills.
- Typography: compact uppercase label, 14px body, 16px emphasis, 24-32px page titles, display font only for headings.
- Surfaces: app background, elevated panel, muted inset panel, interactive hover surface, strong border contrast.
- Elevation: one soft panel shadow and one stronger drawer/modal shadow only.
- Severity palette:
  - LOW: slate
  - MEDIUM: blue
  - HIGH: amber
  - CRITICAL: rose
- Status badges: use the same badge component for incidents, bikes, commands, connectivity, and report chips.

## Shared Components To Standardize
- `AppShell` with responsive sidebar, topbar actions, and connection state.
- `DashboardCard` and `MetricCard` primitives for all surfaces.
- `DataTable` with shared filter bar, loading rows, empty state, and pagination slot.
- `Skeleton` variants for cards, table rows, and drawer blocks.
- `EmptyState` with optional CTA.
- `Badge` for severity, status, and stat chips.
- `Drawer` for bike and incident details.
- `ConfirmModal` for destructive or safety-critical actions.
- `ToastCenter` with grouped realtime notifications.
