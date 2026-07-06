# Implementation Plan: Add Event Details Panel with Location and Explanations

## Goal Description
On the `/events` page, we want to allow users to click on any event row to open a detailed side panel (Drawer) explaining what happened and showing exactly where it happened on a Leaflet map. 

Access constraints:
- This detailed view is restricted to **Operations Plus** and **Insurers** only.
- Core plan users will see a lock/upgrade state explaining they need to upgrade to Operations Plus to view coordinates and detailed reports.

---

## Proposed Changes

### Backend changes (API)

#### [MODIFY] [events.service.ts](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/events/events.service.ts)
- Update `listEventsForUser` to batch-fetch matching `TelemetryPoint` coordinates for the returned page of events.
- Inject `lat` and `lng` properties into the returned event's `metaJson` in memory. This dynamically enriches all queried events (both past and future) with coordinates without requiring schema alterations.

#### [MODIFY] [rules-engine.service.ts](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/ingestion/rules-engine.service.ts)
- Update rule evaluations to write `lat` and `lng` directly into the `metaJson` payload of the events during creation. This ensures all newly created events permanently persist their location coordinates in the JSON metadata.

---

### Frontend changes (Dashboard)

#### [NEW] [event-map.tsx](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/src/components/events/event-map.tsx)
- Create a Leaflet-based map component that displays a map centered at the event's `lat`/`lng` coordinates with an exclamation marker.

#### [MODIFY] [events/page.tsx](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/app/(protected)/events/page.tsx)
- Import `Drawer` from `@/components/ui/drawer`.
- Import `useCurrentUser` and `getSubscriptionEntitlements` to detect user role and subscription tier.
- Add `selectedEvent` state.
- Add `onRowClick` handler to the `DataTable` component.
- Render the `Drawer` component:
  - If the user has access (is an `INSURER` or has `Operations Plus` tier), display:
    - Interactive dark-mode Leaflet Map showing the event location.
    - Localized human-readable description explaining the exact telemetry values and context behind the event.
    - Diagnostic metadata breakdown (G-force, speeds, delta speed, etc.).
    - Quick actions to open the linked bike detail or view it live on the map.
  - If the user does not have access (is on Safety Core), show a premium upgrade lock prompt.

---

## Verification Plan

### Automated Tests
- Run `npm run build` to verify frontend and backend TypeScript compilation.
- Run `npm run lint` on the API and Dashboard workspaces.

### Manual Verification
1. Log in as an **Admin/Owner** on the **Safety Core** plan:
   - Navigate to `/events` and click on an event row.
   - Verify that the details panel opens but displays the locked premium feature view.
2. Log in as an **Admin/Owner** on the **Operations Plus** plan (or an **Insurer** user):
   - Navigate to `/events` and click on an event row.
   - Verify that the details panel opens, rendering the Leaflet Map with the location coordinates, and showing the detailed, readable description.
