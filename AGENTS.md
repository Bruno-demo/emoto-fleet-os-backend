# AGENTS.md

## Tech Stack
- Node.js + TypeScript + NestJS
- PostgreSQL with TimescaleDB extension
- Redis
- MQTT broker (EMQX) via Docker Compose

## Engineering Rules
- Always add short comments ABOVE non-trivial functions explaining what they do (`// ...`).
- Do not log PII (phone numbers, precise home locations). Mask identifiers in logs.
- Use strict TypeScript.
- Use Zod validation for external inputs.
- Use class-validator for DTOs where appropriate.
- Use RBAC everywhere (fleet isolation is mandatory).
- Every endpoint must have authentication + authorization checks.
- Add OpenAPI/Swagger docs for public endpoints.
- Add basic tests for critical pieces (auth + ingestion + scoring).

## Delivery Requirements
- Provide a README with setup commands and sample `.env`.
