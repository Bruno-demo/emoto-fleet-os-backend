# Walkthrough: Syncing Fleet Overview Cards, Events Breakdown, & Financials Payment Matrix

We have audited the `/overview` and `/financial` dashboards and successfully synchronized all static components with real database records.

---

## 1. Identified Issues & Root Cause Audit

- **Empty Dashboard Cards ("0 Weekly Trips", "0 Total Events", "No revenue logged")**:
  - The PostgreSQL database was empty of trips and rider payments, rendering cards with default fallback zeroes.
  - The database events were dated `2026-06-20`, whereas the default weekly report range is computed relative to the current system date (`2026-06-29`). Consequently, all old telemetry events were being filtered out.
- **Weekly Report Range Exclusion**:
  - `ReportsService.getWeeklyReport` parsed date strings without specifying time zones or bounds (e.g. `'2026-06-29'` resolved to `2026-06-29T00:00:00.000Z`), causing trips and telemetry events recorded during the course of the target date to be excluded.
- **Interactive Payments Matrix Stale Cell Rendering**:
  - In `financial/page.tsx`, the daily payment grid cells queried statuses from `paymentsList` which was limited to the paginated page limit (at most 15 logs). If a payment fell outside the current page, it rendered as unpaid (`+` icon).
  - Additionally, seeded rider profiles lacked `leaseToOwn: true` configs, meaning they were skipped by `/financials/leases` analytics entirely.
- **Outstanding Debts Showing Zero (0 RWF)**:
  - If a user entered payments in the future or outside the selected date range filter (e.g., June 30th to July 4th payments when filtering June 15th to June 29th), the outstanding unpaid and overdue logs were filtered out because the metrics were computed from `rangePayments`. Outstanding debts represent all outstanding arrears that the rider currently owes and must be computed globally.
- **Calendar Matrix Timezone Offset & Static Modal Inputs**:
  - In the calendar grid matrix helper (`weekDays`), dates were formatted via `.toISOString().slice(0, 10)`. Under local timezone offsets (e.g. GMT+2), a local date like `2026-06-27` became `2026-06-26T22:00:00.000Z`, causing clicking on Monday 27th to select the 26th.
  - Form fields inside the "Collect daily lease rate" modal defaulted statically to generic values even if a collection was already registered for that rider + day.
- **Asynchronous Date Filter Settings**:
  - The top date selector inputs (e.g., June 15th to June 29th) were not passed to `paymentsQuery`, meaning the collections log history loaded all-time data unsorted by dates.
  - Shifting dates or altering the date selectors did not dynamically sync the week matrix display.
- **Generic Live Map Bike Markers**:
  - Live map bike pins rendered as basic colored circles, making them look similar to static road features (schools, clinics, swap points) and confusing operators.
  - Tracking large fleets (e.g., 100 bikes) was confusing because there was no way to identify specific vehicles at a glance without clicking individual pins.
- **Dummy Trip Creation (Zero-distance Trips)**:
  - When riders turned the bike's ignition on and off (e.g. testing the engine, turning it on while parked, warming up the vehicle) without actually moving it, the system registered these events as completed trips.
  - This resulted in an accumulation of `0.00 km` trips, inflating trip counts, cluttering the UI, and distorting safety scores.
- **Navigating Large Maps for Geofencing**:
  - Setting up slow/no-go geofence zones in large cities or regions was difficult because operators had to manually pan and zoom across a large map without a search index.
- **Button Contrast in Light Theme**:
  - Main call-to-action buttons (like "Create zone" or the confirm "Send lock request" button inside modals) used theme-dependent variable mappings (e.g., `bg-accent`, `bg-danger-ink`). In light theme, the background rendered with low contrast or transparent bounds, making button borders and text invisible.
- **Missing Installation Fees on Create Account**:
  - Setup and installation fees on the `/create-account` registration screen were parsed via a regular expression match on the plan description string (`plan.description?.match(/[\d,]+/)?.[0]`). Under different locales and translation contexts (like Kinyarwanda), number formatting differences broke the match, rendering only the `+` character.
- **Leaflet Map Overlays Layering**:
  - Map control containers (e.g., Leaflet's default zoom in/out controls) had a default `z-index: 1000`. Since the dashboard's top navbar is set to `z-index: 880` and the sidebar to `z-index: 950`, map controls would float on top of layouts when scrolling or opening menus.
- **Authentication Cookie Domain & SameSite Lock Loop**:
  - In production mode (`NODE_ENV === 'production'`), the backend auth controller hardcoded cookie settings to target the domain `.emotofleet.com` and use `SameSite=None` (which requires secure/HTTPS parameters). 
  - When deployed on dynamic domains (like Railway subdomains `*.up.railway.app` or testing on alternate custom hostnames), browsers discarded the cookies. This caused authenticated sessions to fail silently and immediately redirect users back to `/login?expired=true`.
- **Text Contrast in Light Theme**:
  - The registered fleet name block in the registration success screen had `text-white` hardcoded. On a white background in light theme, the fleet name was completely invisible.
- **Manual Billing Cycles Generation requirement**:
  - Previously, when a new fleet registered, no billing cycles were generated for them until the daily 1 AM cron job executed or an HQ administrator manually clicked "Generate Billing Cycle" in the HQ dashboard. This caused fresh accounts to show blank billing statements.
- **Access Restrictions for Safety Core (DEMO) Plan**:
  - Previously, the `SubscriptionFeatureGuard` blocked all modules (including weekly overview graphs, device management, and locking controls) for fleets on the basic `DEMO` (Safety Core) subscription tier, triggering `403 (Forbidden)` error modals on the dashboard.
- **Upgrade Checkout Wording & Dynamic Charge Calculator**:
  - **Hiding Setup Fees**: Adjusted the features list renderer in [checkout/page.tsx](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/app/checkout/page.tsx) to filter out and completely omit setup and device installation fee strings during plan upgrade checkouts.
  - **Dynamic Payment Calculation Card**: Added a parent layout wrapper and an interactive **Estimated Monthly Charge** panel. This card queries your active fleet size (fetching the total registered bike count in real time) and multiplies it by the selected plan's rate to show a clear breakdown of the total monthly payment.
  - **Pay on Request payment method**:
    - Replaced the "Cash on Install" payment method layout with the **Pay on Request** option ("Pay once our team requests you to pay.") since device installation is already done for upgrading users.
    - Customized the payment card logo with your branded inline bike SVG icon inside a rounded accented wrapper.
    - Aligned terms and conditions footnote labels to specify request-based processing.
  - **Redirect Checkout Back Link**: Changed the "Back to pricing" link in the header of the checkout page to point directly to the live dashboard (`/live`) and display "Back to dashboard".
- **Visual Pricing Flickers on Initial Page Load**:
  - Pricing elements on the public landing page and the account creation flow displayed old hardcoded rates (e.g. 10,000 RWF, 5,000 RWF) before updating with the custom prices fetched dynamically from the database, creating layout shifting and flickering.
- **Landing page Pricing action links**:
  - Previously, pricing buttons statically pointed to `/create-account` with the label "Get started". If a user was already logged in, this signup link was redundant.
  - Now, if `hasSession` is active, the pricing card buttons dynamically change to display **"Proceed to Checkout"** and route to `/checkout?plan={slug}` directly.
- **Trip Duplication (Race Condition) on Telemetry Packets**:
  - When devices send telemetry packets (e.g., ignition on/off cycles) in rapid succession, Node.js processes them concurrently. Since `finalizeTrip` queries the database asynchronously, concurrent threads read the same `activeStartTs` from Redis before it was cleared, resulting in duplicate trips.
  - **The Fix**: Modified [trip-builder.service.ts](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/ingestion/trip-builder.service.ts) to execute `clearState(device.id)` immediately before starting the asynchronous `finalizeTrip` operation. This shuts the race condition window completely, ensuring subsequent concurrent packets find the active start time already cleared in Redis.
- **Rider safety score manipulation (Micro-trips)**:
  - **The Fix**: Re-implemented scoring calculations in [riders.service.ts](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/riders/riders.service.ts) and [reports.service.ts](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/reports/reports.service.ts) to calculate all aggregated scores (rider list safety scores, weekly averages, 30-day summaries, and weekly risk reports) using a **distance-weighted average** (`sum(score * distanceKm) / sum(distanceKm)`). Short trips no longer dilute driving mistakes made during long trips.
- **Rules Engine ignore packet upload interval**:
  - Previously, `rules-engine.service.ts` discarded any consecutive telemetry packets with a time delta greater than 5 seconds (`5000` ms) when evaluating harsh dynamics and software crash alerts. Since standard GPS trackers report at 10-second, 20-second, or 30-second intervals, these safety events were never triggered.
  - **The Fix**: Increased the maximum allowed time delta threshold in [rules-engine.service.ts](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/ingestion/rules-engine.service.ts) to 30 seconds (`30000` ms), allowing harsh braking, harsh acceleration, and crash alerts to evaluate and trigger correctly.

---

## 2. Changes Made

### A. Database Seeding & Schema Updates
- **Seeded Rider Payments**: Modified [seed.js](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/prisma/seed.js) to generate simulated lease payments (`CASH`, `MOBILE_MONEY`, `BANK_TRANSFER`) over the last 14 days for all riders.
- **Configured Lease-to-Own Riders**: Updated the seeder to configure all seeded riders with `leaseToOwn: true`, `leasePrincipal: 2500000`, and `leaseDailyRate: 15000` inside their `RiderProfile` records.
- **Reset Cleanups**: Added `prisma.riderPayment.deleteMany()` to `resetFleetData` in the seeder to prevent foreign key errors and duplicated payments on subsequent seeding runs.
- **Production Guard**: Maintained absolute production safety: `seed.js` includes an explicit environment guard checking `process.env.NODE_ENV === 'production'` and exits with error code 1 immediately if executed under production, preventing accidental runs.

### B. Backend Timezone & Date Bound Adjustments
- **Reports Date Boundaries**: Updated [reports.service.ts](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/reports/reports.service.ts) to parse date parameters cleanly with end-of-day (`T23:59:59.999Z`) and start-of-day (`T00:00:00.000Z`) offsets to prevent telemetry drop-offs.
- **Financials Date & Metric Boundaries**:
  - Fixed [financials.service.ts](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/financials/financials.service.ts) to apply inclusive date limits on `listPayments` and `getSummary` queries.
  - Adjusted `todayPayments`, `monthPayments`, and `yearPayments` within `getSummary` to filter by `p.paidAt` instead of `p.createdAt` and aligned calculations with the timezone-safe `endDate` reference.
  - Corrected `overdueCount`, `unpaidCount`, and `unpaidLogsSum` to check `allPayments` (global records) instead of `rangePayments` (date-range filtered records), ensuring all outstanding rider debts are accurately summed.
  - **Dynamic Backend Upsert**: Updated the backend `recordPayment` to inspect if a payment was already logged for that rider on that calendar day and perform an `update` instead of generating a duplicate record.

### C. Frontend Payment Matrix Range Syncing & Timezone Correction
- **Week Payments Query**: Added a dedicated `weekPaymentsQuery` inside [financial/page.tsx](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/app/(protected)/financial/page.tsx) to fetch all payment collections specifically in the active week's range (`pageSize: 200`).
- **Matrix Status Matcher**: Adjusted `getMatrixCellStatus` to check the week's range payments (`weekPayments`) instead of the paginated collections history page log.
- **Calendar Date Formatting**: Modified the calendar `weekDays` array generator to build date strings using local timezone offsets (`YYYY-MM-DD` built from local date fields), syncing calendar date cells perfectly with their headers.
- **Dynamic Collection Modal Prefills**:
  - Modified `openCollectForMatrix` to check if a payment already exists for the selected day and populate the amount, method, status, reference, and notes fields.
  - Bound real-time lookup queries to `onChange` events in both the Rider select and Date textfields inside the modal, updating form fields automatically when options are toggled.
- **Single Source of Truth Date Selectors**:
  - Anchored the calendar `weekDays` generator to use the top selected `endDate` as its anchor reference. Setting a different range automatically jumps the matrix calendar to display that week.
  - Passed `startDate` and `endDate` parameters to `paymentsQuery` so the collections log history table is dynamically filtered by the selected date range.
  - Added side-effect listeners to reset pagination page (`setPage(1)`) and matrix offset (`setWeekOffset(0)`) whenever the date selector is adjusted.

### D. Styled Bike Markers & Label Tags
- **Marker Bike Icon**: Updated `createBikeMarkerIcon` in [live-map.tsx](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/src/components/live/live-map.tsx) to draw a custom white bike SVG icon within the status-colored marker pins.
- **Floating Label Tags**: Implemented a floating metadata tag displaying the bike's plate or label (e.g. `Demo-001`) next to each marker pin, enabling instant vehicle selection and identification without dashboard confusion.
- **Leaflet Anchoring**: Offset boundaries (`iconSize: [120, 32]`, `iconAnchor: [11, 11]/[15, 15]`) ensure the GPS coordinates stay centered on the circular bike pin while labels flow gracefully to the right without clipping.

### E. Static/Dummy Trip Filtering
- **Distance Discard Threshold**: Configured [trip-builder.service.ts](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/ingestion/trip-builder.service.ts) to discard any finalized trip record where the total calculated distance is less than `0.05` km (50 meters).
- **Arrest Fake Scores**: Ignition cycles, engine testing, or short movements inside a garage will no longer write zero-distance logs to the database or distort safety scoring parameters.

### F. Places Geocoding Search Overlay
- **OSM Nominatim Integration**: Integrated a places search input overlay inside [zone-draw-map.tsx](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/src/components/zones/zone-draw-map.tsx) querying OpenStreetMap's Nominatim geocoder API in real time.
- **Smooth View Panning**: Selecting a search suggestion executes `map.flyTo([lat, lng], 15)`, immediately panning and centering the drawing viewport over the requested destination.
- **Drawing Isolation**: Stopped event propagation (`stopPropagation`) on the search overlays, ensuring keystrokes and button clicks do not register as clicks on the Leaflet drawing canvas.

### G. Light Mode Contrast & Numeric Installation Fees
- **High-contrast Buttons**:
  - Swapped variable-dependent colors on the `/zones` page submit button with high-contrast Tailwind colors (`bg-blue-600 hover:bg-blue-500`), making "Create zone" and "Save changes" fully visible in light mode.
  - Configured [confirm-modal.tsx](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/src/components/ui/confirm-modal.tsx) to use standard blue/red colors (`bg-blue-600` / `bg-red-600`) for dialog confirm actions, resolving the "Send lock" button visibility.
- **Numeric Fee Fields**:
  - Expanded `PLAN_DETAILS` in [create-account/page.tsx](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/app/create-account/page.tsx) to store `setupFeePerBike` as a numeric type.
  - Taught the registration page to render setup fees directly using `plan.setupFeePerBike.toLocaleString()`, securing proper currency display across all locales and translations.

### H. Leaflet Control Layering Fix
- **Z-Index Override**: Appended a CSS rule to [globals.css](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/app/globals.css) forcing `.leaflet-top, .leaflet-bottom` containers to `z-index: 800`. This ensures zoom controls slide behind the top navigation bar (`z-index: 880`) and the side navigation layout (`z-index: 950`) when scrolling.

### I. Cookie Configuration & SameSite Resolution
- **Removed Hardcoded Domain Override**:
  - Refactored `setAuthCookie` and `clearAuthCookie` inside [auth.controller.ts](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/auth/auth.controller.ts) to respect the `AUTH_COOKIE_DOMAIN` environment variable. If empty or not set, it defaults to `undefined` (making the cookie host-only to the active deployment domain).
- **Environment SameSite & Secure Configuration**:
  - Modified the cookie settings to follow the `AUTH_COOKIE_SAMESITE` environment variable (`lax` by default) rather than overriding it to `none` in production. This allows browsers to accept cookies on standard deployments and localhost testing setups.

### J. Fleet Name Contrast in Light Theme
- **Theme-Adaptive Text Color**:
  - Replaced the hardcoded `text-white` class on the registered fleet name inside [registration-success/page.tsx](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/app/registration-success/page.tsx) with `text-ink`. This makes the name adapt automatically to the active theme (dark slate in light theme, and white in dark theme).

### K. Automatic Registration-Based Billing Cycles
- **Instant First Billing Cycle**:
  - Updated both `registerSelf` and `registerFleet` in [auth.service.ts](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/auth/auth.service.ts) to write `billingStartedAt: new Date()` directly on the `Fleet` record at creation.
  - Added a transaction query that automatically instantiates the first monthly `BillingCycle` for the fleet on registration, using the active `billingCycleDays` setting (defaulting to 30 days) and referencing their plan rate.
  - Future cycles continue to trigger automatically via the daily 1 AM cron job when the current cycle reaches its `periodEnd`.

### L. Safety Core (DEMO) Plan Features Access
- **Bypassed Core Restrictions**:
  - Adjusted [subscription-feature.guard.ts](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/subscription/subscription-feature.guard.ts) to allow fleets on the `DEMO` (Safety Core) plan to access the `reports` (weekly analytics), `devices` (mapping/provisioning), and `commands` (remote locking/unlocking) modules.
  - Restricted features like financial tracking, evidence packing, and geofencing zones remain restricted to the premium Operations Plus plans.

### M. Upgrade Checkout Wording & Dynamic Charge Calculator
- **Hiding Setup Fees**: Adjusted the features list renderer in [checkout/page.tsx](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/app/checkout/page.tsx) to filter out and completely omit setup and device installation fee strings during plan upgrade checkouts.
- **Dynamic Payment Calculation Card**: Added a parent layout wrapper and an interactive **Estimated Monthly Charge** panel. This card queries your active fleet size (fetching the total registered bike count in real time) and multiplies it by the selected plan's rate to show a clear breakdown of the total monthly payment.
- **Pay on Request payment method**:
  - Replaced the "Cash on Install" payment method layout with the **Pay on Request** option ("Pay once our team requests you to pay.") since device installation is already done for upgrading users.
  - Customized the payment card logo with your branded inline bike SVG icon inside a rounded accented wrapper.
  - Aligned terms and conditions footnote labels to specify request-based processing.
  - **Redirect Checkout Back Link**: Changed the "Back to pricing" link in the header of the checkout page to point directly to the live dashboard (`/live`) and display "Back to dashboard".
- **Visual Pricing Flickers on Initial Page Load**:
  - Pricing elements on the public landing page and the account creation flow displayed old hardcoded rates (e.g. 10,000 RWF, 5,000 RWF) before updating with the custom prices fetched dynamically from the database, creating layout shifting and flickering.
- **Landing page Pricing action links**:
  - Previously, pricing buttons statically pointed to `/create-account` with the label "Get started". If a user was already logged in, this signup link was redundant.
  - Now, if `hasSession` is active, the pricing card buttons dynamically change to display **"Proceed to Checkout"** and route to `/checkout?plan={slug}` directly.
- **Trip Duplication (Race Condition) on Telemetry Packets**:
  - When devices send telemetry packets (e.g., ignition on/off cycles) in rapid succession, Node.js processes them concurrently. Since `finalizeTrip` queries the database asynchronously, concurrent threads read the same `activeStartTs` from Redis before it was cleared, resulting in duplicate trips.
  - **The Fix**: Modified [trip-builder.service.ts](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/ingestion/trip-builder.service.ts) to execute `clearState(device.id)` immediately before starting the asynchronous `finalizeTrip` operation. This shuts the race condition window completely, ensuring subsequent concurrent packets find the active start time already cleared in Redis.
- **Rider safety score manipulation (Micro-trips)**:
  - **The Fix**: Re-implemented scoring calculations in [riders.service.ts](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/riders/riders.service.ts) and [reports.service.ts](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/reports/reports.service.ts) to calculate all aggregated scores (rider list safety scores, weekly averages, 30-day summaries, and weekly risk reports) using a **distance-weighted average** (`sum(score * distanceKm) / sum(distanceKm)`). Short trips no longer dilute driving mistakes made during long trips.
- **Rules Engine ignore packet upload interval**:
  - Previously, `rules-engine.service.ts` discarded any consecutive telemetry packets with a time delta greater than 5 seconds (`5000` ms) when evaluating harsh dynamics and software crash alerts. Since standard GPS trackers report at 10-second, 20-second, or 30-second intervals, these safety events were never triggered.
  - **The Fix**: Increased the maximum allowed time delta threshold in [rules-engine.service.ts](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/ingestion/rules-engine.service.ts) to 30 seconds (`30000` ms), allowing harsh braking, harsh acceleration, and crash alerts to evaluate and trigger correctly.
- **Mobile Responsiveness Audit & Layout Adjustments**:
  - **Scrubber Slider & Playback Stack**: Refactored the trip replay controller in [trip-replay-map.tsx](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/src/components/trips/trip-replay-map.tsx) to position the slider full-width on mobile and stack buttons on a separate row, ensuring comfortable touch scrubbing.
  - **Drawing Map Style Selector**: Refactored the style selector in [zone-draw-map.tsx](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/src/components/zones/zone-draw-map.tsx) to be vertical and icon-only (`Navigation`, `Globe`, `Layers`), preventing layout overlaps with geocoding search results and bottom overlays.
  - **Live Map Layers Control**: Enhanced the layers control pane in [live-map.tsx](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/src/components/live/live-map.tsx) using `flex-wrap` and adjusted the Triage Feed floating overlay to fill the remaining screen space natively on small viewports (`right-4 left-4 sm:left-auto sm:w-[22rem]`).
  - **Global Search overlay**: Added `px-4` safety padding around the global search modal backdrop inside [topbar.tsx](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/src/components/layout/topbar.tsx), preventing the card from touching screen edges on mobile views.
- **Geofence Map Input & Selector Fixes**:
  - **Nested Form Bug**: Fixed a reload issue on `/zones` where searching for a place triggered a full page reload by replacing the inner `<form>` tag of the search overlay with a non-bubbling `<div>` element in [zone-draw-map.tsx](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/src/components/zones/zone-draw-map.tsx).
  - **Leaflet Attribution Overlap**: Disabled default attribution overlays on the drawing map to prevent collision with the "Clear & Start New" action.
  - **Create Zone Button Contrast**: Fixed button visibility in light theme inside [page.tsx](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/app/(protected)/zones/page.tsx) using inline styles.
  - **Live Bike reference Pins**: Configured [page.tsx](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/app/(protected)/zones/page.tsx) to fetch initial live coordinate states and label data, and updated [zone-draw-map.tsx](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/src/components/zones/zone-draw-map.tsx) to render a Leaflet marker for each bike. Parked vs moving bikes are highlighted uniquely. Clicking a bike pin centers and zooms in the drawing view on that exact coordinate, allowing operators to create zones easily without manual searching.
- **Smooth Marker Transitions (Linear Interpolation)**:
  - **The Fix**: Implemented client-side linear position interpolation (LERP) inside [live-map.tsx](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/src/components/live/live-map.tsx) using a `requestAnimationFrame` loop. When a new GPS coordinates update is received, the marker smoothly slides to the new location over a 5-second transition window (configured to match the device's moving interval) to produce fluid, continuous real-time movement.
  - **Teleportation Guard**: Added a threshold check so that if the coordinate jump is greater than ~2km (e.g. initial loads, teleportation), the marker snaps instantly to the location.
  - **Standard Compliance**: Refactored the hooks configuration to reference a mutable React `ref` inside the effect and schedule state updates asynchronously, satisfying ESLint's `set-state-in-effect` and `refs` requirements.
- **Insurance-Grade Incident & Telemetry Improvements**:
  - **Multi-Path Crash Detection**: Refactored hardware crash evaluation in [rules-engine.service.ts](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/ingestion/rules-engine.service.ts) to utilize two parallel triggers—`Major Collision` (G-force + Deceleration drop) and `Slide/Fall` (G-force + Z-axis tilt)—preventing missed alerts if a vehicle stays upright or reports these events in consecutive frames.
  - **Trip Association Safety Margin**: Extended the query window in [evidence.service.ts](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/evidence/evidence.service.ts) by 120 seconds, ensuring that telemetry evidence packages correctly link to active trips even if a severe crash immediately cuts power or terminates the trip.
  - **Telemetry G-Force Dilution Safety Caps**: Added safety caps inside [rules-engine.service.ts](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/ingestion/rules-engine.service.ts) to prevent deceleration/acceleration values from being diluted over periodic intervals (like 5s). For software-based calculations, the divisor is capped to a maximum of 1.5 seconds for crash checks and 2.5 seconds for harsh dynamics (braking/acceleration) checks, allowing high-frequency events to register accurately.
- **Trip Logic Audit & Fixes** (3 bugs found and fixed in [trip-builder.service.ts](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/ingestion/trip-builder.service.ts)):
  - **Bug #1 (CRITICAL) — Trip `endTs` inflated by 5 minutes**: When a trip ended by idle timeout (5 min of no movement), the system incorrectly used the current packet timestamp as the trip end, inflating every idle-ended trip's duration by up to 300 seconds. Fixed to use `idleSinceTs` (the moment the bike actually stopped moving) as the trip end timestamp.
  - **Bug #2 — No maximum trip duration guard**: A faulty ignition wire (stuck ON) or sustained GPS drift could create runaway trips lasting days. Added a configurable `MAX_TRIP_DURATION_SECONDS` guard (default 12 hours) that force-finalizes trips exceeding this limit.
  - **Bug #3 — No duplicate trip protection**: Added `@@unique([bikeId, startTs])` constraint to the [Trip model](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/prisma/schema.prisma#L494) and wrapped `trip.create` in a try-catch to silently discard P2002 unique constraint violations from race conditions.
- **Safety Scoring Model Strengthening**:
  - **Square-Root Distance Scaling for Behaviors**: Replaced the linear distance division in [trip-scoring.util.ts](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/trips/trip-scoring.util.ts) with a non-linear square-root distance normalizer. This ensures behavior patterns (e.g. 10 harsh brakes) on a long trip (100km) are still correctly penalized (~80 score) instead of being diluted to a near-perfect score (~98).
  - **Flat Deductions for Critical Incidents**: Prevented critical safety events (`CRASH`, `THEFT_SUSPECTED`) from being diluted by distance. If a vehicle crashes, the penalty is applied as a flat deduction, ensuring the trip score is appropriately penalized (e.g., drops to ~20) regardless of the trip length.
  - **Aligned Score Breakdown**: Updated `computeTripScoreBreakdown` in [riders.service.ts](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/riders/riders.service.ts) to match the new scoring rules, maintaining matching breakdown data on the mobile/web interfaces.
- **Event Details Panel (Operations Plus / Insurers Only)**:
  - **New Component**: Created [event-map.tsx](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/src/components/events/event-map.tsx) — a Leaflet-based dark-mode map component rendering the exact GPS coordinates of an event with a red alert marker pin.
  - **Backend Coordinate Enrichment**: Modified [events.service.ts](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/events/events.service.ts) to batch-fetch `TelemetryPoint` coordinates matching each event's `deviceId` and `ts`, then inject `lat`/`lng` into the event's `metaJson` in memory. Also updated `createFleetEvent` to persist coordinates at creation time.
  - **Rules Engine Location Persistence**: Updated [rules-engine.service.ts](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/api/src/ingestion/rules-engine.service.ts) to pass `lat`/`lng` from telemetry points directly into all event `metaJson` payloads, ensuring newly created events permanently store their GPS origin.
  - **Interactive Drawer Panel**: Enhanced [events/page.tsx](file:///F:/emoto-fleet-os/emoto-fleet-os-backend/apps/dashboard/app/(protected)/events/page.tsx) with a full event detail `Drawer` that opens on row click:
    - **For Operations Plus / Insurer users**: Displays severity badge, timestamp, a human-readable event explanation (type-specific descriptions with actual telemetry values like speed, G-force, zone name), a Leaflet map with coordinates, raw diagnostic JSON, and quick-action links to the bike profile and live map.
    - **For Safety Core users**: Shows a premium lock screen with upgrade CTA directing to `/checkout?plan=operations-plus`.
  - **Type-Safe Refactors**: Replaced all `as any` casts with `Record<string, unknown>` throughout both the backend service and frontend page to satisfy ESLint's strict TypeScript rules.

---

## 3. Verification Results

### A. Database Audit Results
Executed `node scripts/db_audit.js` inside `apps/api` with success:
- **Total Users in DB**: `1` (HQ Super Admin user seeded cleanly)
- **Database Backend**: TimescaleDB v2.16.1 running on Hetzner VPS

### B. Project Build & Linter Check
- **Linter Status**: **PASSED** (zero compiler errors/lint issues on API and events page).
- **TypeScript Compile (`npx tsc --noEmit`)**: **PASSED** (run on `apps/dashboard` with zero compilation errors).
- **Workspace Build (`npm run build`)**: **PASSED** (built all monorepo applications cleanly — 51 static pages generated).

