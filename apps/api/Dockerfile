FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json

RUN npm ci

COPY apps/api ./apps/api

RUN DATABASE_URL=postgresql://postgres:postgres@postgres:5432/emoto_fleet \
    npm exec --workspace apps/api prisma generate --schema apps/api/prisma/schema.prisma
RUN npm run build -w apps/api

FROM node:22-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache curl

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY docker/api/entrypoint.sh /entrypoint.sh

ENV NODE_ENV=production

RUN chmod +x /entrypoint.sh

EXPOSE 3000

CMD ["/entrypoint.sh"]
