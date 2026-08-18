# ── Stage 1: build the admin app ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/admin/package.json ./apps/admin/

RUN npm ci --workspace=@kidsproject/admin --include-workspace-root

COPY apps/admin/ ./apps/admin/

# Baked in at build time so the "share gallery" link points at the session app's actual port —
# admin has no runtime way to discover it, since they're two separate static builds. Must match
# the session service's SESSION_PORT if that's been overridden from the default.
ARG VITE_SESSION_PORT=3000
ENV VITE_SESSION_PORT=$VITE_SESSION_PORT

RUN npm run build -w @kidsproject/admin

# ── Stage 2: serve with nginx ─────────────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/apps/admin/dist/ /usr/share/nginx/html/

COPY docker/admin-nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
