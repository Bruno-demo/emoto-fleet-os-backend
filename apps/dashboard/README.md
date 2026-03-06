# Dashboard App

Next.js fleet dashboard app for eMoto Fleet OS.

## Run

From repo root:

```bash
npm run dev:dashboard
```

Dashboard runs on `http://localhost:3001`.

## Env

Set API base URL in root `.env` or dashboard shell env:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## OpenAPI Type Generation

Generate typed client models from backend Swagger JSON:

```bash
npm run gen:types -w apps/dashboard
```

This pulls from `${NEXT_PUBLIC_API_URL}/docs-json` and writes `src/lib/api-types.ts`.
