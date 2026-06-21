FROM node:20-alpine

# better-sqlite3 requires native compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy workspace manifests so npm can resolve the monorepo
COPY package.json package-lock.json ./
COPY server/package.json ./server/

# Install server dependencies (hoisted to root node_modules)
RUN npm ci --workspace=server --include-workspace-root

# Copy server source (packages/ not needed — server uses its own server/ai/ layer)
COPY server/ ./server/

EXPOSE 3002

# tsx runs TypeScript directly — no compile step needed
CMD ["/app/node_modules/.bin/tsx", "/app/server/index.ts"]
