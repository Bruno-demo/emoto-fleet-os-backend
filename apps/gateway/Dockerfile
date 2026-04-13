FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/gateway/package.json apps/gateway/package.json

RUN npm ci

COPY apps/gateway ./apps/gateway

RUN npm run build -w apps/gateway

FROM node:22-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache curl

RUN addgroup -S app && adduser -S app -G app

COPY package.json package-lock.json ./
COPY apps/gateway/package.json ./apps/gateway/package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/gateway/dist ./apps/gateway/dist

ENV NODE_ENV=production

USER app

EXPOSE 8080

CMD ["node", "apps/gateway/dist/index.js"]
