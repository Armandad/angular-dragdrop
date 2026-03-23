FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json turbo.json tsconfig.base.json ./
COPY apps/game-client/package.json apps/game-client/

RUN npm install --ignore-scripts

COPY apps/game-client/ apps/game-client/

WORKDIR /app/apps/game-client
RUN npx vite build

# ─── Serve with nginx ────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/apps/game-client/dist /usr/share/nginx/html

# Nginx config to proxy API to game server
RUN echo 'server { \
  listen 80; \
  location / { \
    root /usr/share/nginx/html; \
    try_files $uri $uri/ /index.html; \
  } \
  location /api/ { \
    proxy_pass http://game-server:3000; \
  } \
  location /aggregator/ { \
    proxy_pass http://game-server:3000; \
  } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
