# Rider UX Plan

## Top 8 UX Issues
1. Screens use one-off styles, so the app feels inconsistent between auth, home, trips, nearby, and SOS.
2. Touch targets are small for mobile use in motion or outdoors, especially on login, trip pagination, and POI actions.
3. Loading states are generic full-screen spinners; there are no list or card skeletons for trips, nearby POIs, or home data.
4. Empty and error states do not explain the next action clearly, so users are left without guidance.
5. Home does not prioritize the rider’s weekly score, coaching, and latest trip strongly enough for fast glanceability.
6. Trips and trip detail screens are text-heavy and do not surface score, distance, and risky-event counts clearly.
7. Nearby POIs lacks strong permission UX, filter affordances, and action hierarchy for call vs directions.
8. SOS is functional but not safe enough visually; the primary emergency action and outcome state need stronger emphasis and confirmation.

## Token Decisions
- Spacing: 4 / 8 / 12 / 16 / 20 / 24 / 32
- Radius: 12 for inputs, 18 for buttons/list rows, 24 for cards, 32 for hero surfaces
- Typography: 12 meta, 14 body, 16 emphasis, 20 section title, 28 hero title
- Surfaces: warm light background, high-contrast white cards, soft tinted panels for secondary emphasis
- Borders/dividers: subtle cool-gray borders with stronger dividers for grouped sections
- Primary action: strong blue button with disabled/loading states
- Severity badges:
  - LOW: muted slate
  - MEDIUM: blue
  - HIGH: amber
  - CRITICAL: red

## Shared Components To Standardize
- Theme tokens module
- PrimaryButton + SecondaryButton
- AppCard
- ListItem
- Badge
- EmptyState
- ErrorState with retry CTA
- Skeleton blocks for cards and rows
- SectionHeader
- Confirmation modal for SOS
