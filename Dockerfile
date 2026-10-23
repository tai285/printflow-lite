# syntax=docker/dockerfile:1

# ---- deps: all dependencies (needed to build the web app) ----
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: compile the React app ----
FROM deps AS build
COPY vite.config.ts tsconfig*.json ./
COPY web ./web
COPY shared ./shared
RUN npx vite build

# ---- runtime: production deps + server source + built web app ----
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY shared ./shared
COPY drizzle ./drizzle
COPY --from=build /app/dist/web ./dist/web

# The commit this image was built from, reported by /api/health.
ARG GIT_SHA=dev
ENV GIT_SHA=$GIT_SHA

# Node 24 runs the TypeScript sources directly, so there is no server build step.
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server/index.ts"]
