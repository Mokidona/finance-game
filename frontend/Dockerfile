# --- 1. Сборка статики ---
FROM node:22-alpine AS build

WORKDIR /app

ENV NODE_OPTIONS=--max-old-space-size=1024

COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund --fetch-timeout=300000

COPY . .

RUN npm run build

# --- 2. Отдача статики + прокси на API ---
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
