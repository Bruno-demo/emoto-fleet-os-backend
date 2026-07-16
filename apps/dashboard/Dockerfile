FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY apps/gateway/package.json apps/gateway/package.json
COPY apps/stream-processor/package.json apps/stream-processor/package.json
COPY apps/rider/package.json apps/rider/package.json

RUN npm ci

COPY apps/dashboard ./apps/dashboard

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npm run build -w apps/dashboard

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache curl

RUN addgroup -S app && adduser -S app -G app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY apps/gateway/package.json apps/gateway/package.json
COPY apps/stream-processor/package.json apps/stream-processor/package.json
COPY apps/rider/package.json apps/rider/package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/dashboard/package.json ./apps/dashboard/package.json
COPY --from=build /app/apps/dashboard/.next ./apps/dashboard/.next
COPY --from=build /app/apps/dashboard/public ./apps/dashboard/public

USER app

EXPOSE 3001

CMD ["npm", "run", "start", "-w", "apps/dashboard", "--", "--port", "3001"]
