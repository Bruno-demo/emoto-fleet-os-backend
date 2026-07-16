FROM node:22 AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY apps/gateway/package.json apps/gateway/package.json
COPY apps/stream-processor/package.json apps/stream-processor/package.json
COPY apps/rider/package.json apps/rider/package.json

RUN npm ci

ARG CACHEBUST=1
COPY apps/api ./apps/api

RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    npm exec --workspace apps/api prisma generate --schema apps/api/prisma/schema.prisma
RUN npm run build -w apps/api

FROM node:22 AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y curl postgresql-client && rm -rf /var/lib/apt/lists/*

RUN groupadd -r app && useradd -r -g app app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY docker/api/entrypoint.sh /entrypoint.sh

ENV NODE_ENV=production
ENV NODE_PATH=/app/apps/api/node_modules:/app/node_modules

RUN chmod +x /entrypoint.sh

USER app

EXPOSE 3000

CMD ["/entrypoint.sh"]
