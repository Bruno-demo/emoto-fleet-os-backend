# Event Details Panel Checklist

- [x] Create `apps/dashboard/src/components/events/event-map.tsx` Leaflet map component.
- [x] Modify `apps/api/src/events/events.service.ts` to batch-fetch and enrich `lat`/`lng` in `metaJson`.
- [x] Modify `apps/api/src/ingestion/rules-engine.service.ts` to write `lat`/`lng` to `metaJson` on creation.
- [x] Modify `apps/dashboard/app/(protected)/events/page.tsx` to add `Drawer`, plan entitlements checks, custom row clicks, detailed descriptions, and map preview.
- [x] Run `npm run build` to verify compilation.
- [x] Run `npm run lint` to verify eslint rules.
- [x] Commit and push.
