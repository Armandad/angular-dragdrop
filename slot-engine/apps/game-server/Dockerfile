FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace config
COPY package.json turbo.json tsconfig.base.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/math-engine/package.json packages/math-engine/
COPY packages/crypto-utils/package.json packages/crypto-utils/
COPY packages/game-defs/package.json packages/game-defs/
COPY apps/game-server/package.json apps/game-server/

# Install dependencies
RUN npm install --ignore-scripts

# Copy source
COPY packages/ packages/
COPY apps/game-server/ apps/game-server/

# Build
RUN npx turbo run build --filter=game-server

# ─── Production image ───────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy built output + dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-types/package.json ./packages/shared-types/
COPY --from=builder /app/packages/math-engine/dist ./packages/math-engine/dist
COPY --from=builder /app/packages/math-engine/package.json ./packages/math-engine/
COPY --from=builder /app/packages/crypto-utils/dist ./packages/crypto-utils/dist
COPY --from=builder /app/packages/crypto-utils/package.json ./packages/crypto-utils/
COPY --from=builder /app/packages/game-defs ./packages/game-defs
COPY --from=builder /app/apps/game-server/dist ./apps/game-server/dist
COPY --from=builder /app/apps/game-server/package.json ./apps/game-server/
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "apps/game-server/dist/main.js"]
