FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/stream-processor/package.json apps/stream-processor/package.json

RUN npm ci

COPY apps/stream-processor ./apps/stream-processor

RUN npm run build -w apps/stream-processor

FROM node:22-alpine AS runtime

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/stream-processor/package.json ./apps/stream-processor/package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/stream-processor/dist ./apps/stream-processor/dist

RUN addgroup -S app && adduser -S app -G app

ENV NODE_ENV=production

USER app

CMD ["node", "apps/stream-processor/dist/index.js"]
