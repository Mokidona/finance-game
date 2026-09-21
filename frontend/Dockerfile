# --- 1. Сборка статики ---
FROM node:22-alpine AS build

WORKDIR /app

# package-lock.json обязателен: npm ci ставит ровно те версии, что в локе
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

COPY . .

# `npm run build` = check:sprites && vite build: проверка ассетов маскота
# падает прямо на сборке образа, а не в рантайме у пользователя
RUN npm run build

# --- 2. Отдача статики + прокси на API ---
FROM nginx:1.27-alpine

# Дев-конфига в образе нет: наш файл заменяет стандартный default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
