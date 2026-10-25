FROM node:24-alpine AS base

# ---- Prepare Stage ----
FROM base AS prepare

WORKDIR /app
RUN npm install -g turbo

COPY . .
RUN turbo prune api web --docker


# ---- Builder Stage ----
FROM base AS builder
WORKDIR /app

# Vite inlines VITE_* values at build time. VITE_API_URL stays unset so the
# SPA calls the API on its own origin.
ARG VITE_FAKE_AUTH=false
ENV VITE_FAKE_AUTH=$VITE_FAKE_AUTH

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate
RUN npm install -g turbo

# Copy lockfile + package.json manifests
COPY --from=prepare /app/out/json/ .

# Copy source code
COPY --from=prepare /app/out/full/ .

# Install all dependencies
RUN CI=true pnpm install --frozen-lockfile

# Build the API and the SPA
RUN turbo run build

# ---- Runtime Stage ----
FROM node:24-alpine AS runtime

WORKDIR /app

ENV HUSKY=0
# Unset it to serve the SPA elsewhere and keep this image API-only.
ENV SERVE_STATIC_DIR=/app/apps/web/dist

RUN apk add --no-cache postgresql-client curl jq

RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

COPY --from=prepare /app/out/json/ .
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist

# Runtime dependencies of the API only; the SPA is static files.
RUN CI=true pnpm install --prod --frozen-lockfile --filter api...

COPY deployment/entrypoint.app.sh /entrypoint.app.sh

RUN chmod +x /entrypoint.app.sh

# Run as the unprivileged user built into the node image
USER node

EXPOSE 3000

ENTRYPOINT ["/entrypoint.app.sh"]
