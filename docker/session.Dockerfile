# ── Stage 1: build the session app ───────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/session/package.json ./apps/session/

RUN npm ci --workspace=@kidsproject/session --include-workspace-root

COPY apps/session/ ./apps/session/

RUN npm run build -w @kidsproject/session

# ── Stage 2: serve with nginx ─────────────────────────────────────────────────
FROM nginx:alpine

# Session SPA build output
COPY --from=builder /app/apps/session/dist/ /usr/share/nginx/html/

# Game templates — served at /games/ for same-origin localStorage sharing
COPY apps/games/ /usr/share/nginx/games/

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
