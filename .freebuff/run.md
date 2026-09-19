# Run doc — Budget Mini App (Telegram Mini App)

Проект из двух частей: `backend/` (FastAPI + SQLite) и `frontend/` (React + Vite).
Фронтенд ходит в API через прокси Vite (`/api` → `http://127.0.0.1:8000`), поэтому для
живого превью нужен **и бэкенд, и фронтенд**.

## 1. Как воспроизвести артефакты (с чистого checkout)

1. **Node** — в этом окружении не в общем `PATH`, лежит в nvm:
   `export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"` (Node v24).
2. **Env-файлы: их нет.** В корне, `frontend/` и `backend/` нет `.env*` — копировать нечего,
   вся конфигурация в коде (`frontend/vite.config.js`, `backend/app/database.py`).
3. **Зависимости фронтенда** (пакетный менеджер — npm, есть `frontend/package-lock.json`):
   ```bash
   cd frontend && npm install
   ```
   ВАЖНО: в этом окружении `~/.npm` частично принадлежит root, поэтому обычный
   `npm install` падает на «Your cache folder contains root-owned files».
   `sudo chown` не нужен — ставим с отдельным кэшем (так были поставлены
   `i18next`/`react-i18next` для §35):
   ```bash
   cd frontend && npm install --cache /tmp/npm-cache-2mln --no-audit --no-fund
   ```
4. **База и демо-данные бэкенда** создаются сами при первом старте:
   `backend/budget.db` (+ WAL) с демо-профилем. Уже лежит в репозитории — удалять не нужно.
   Python-зависимости: venv в корне (`.venv`, Python 3.14) + `backend/requirements.txt`
   (`pip install -r backend/requirements.txt`, если venv пустой).
5. **Сброс состояния в браузере** (нужно, когда проверяешь первый запуск):
   онбординг §34 и настройки геймификации §32 живут в `localStorage` ключа
   `budget.onboarding.v1` и `budget.pet.settings.v1`. Удалить их можно из консоли
   страницы или через `preview_evaluate`:
   ```js
   localStorage.removeItem("budget.onboarding.v1");
   localStorage.removeItem("budget.pet.settings.v1");
   ```
   Демо-БД при этом не меняется — тур запустится снова на следующей загрузке.

6. **Проверка целостности ассетов маскота** (спрайт-листы слизней; ловит расхождение имени
   файла/регистра и геометрии PNG):
   ```bash
   cd frontend && npm run check:sprites
   ```
   Она же выполняется автоматически первым шагом `npm run build`.

## 2. Как запустить серверы

**Бэкенд (порт 8000)** — запускается без `--reload`, поэтому после правок в `backend/`
нужен перезапуск (иначе API продолжит отдавать старую схему).
```bash
cd backend && ../.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```
Проверка: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/api/health` → 200.
Детач (тот же принцип, что и у фронтенда):
```bash
launchctl submit -l freebuff-backend-2mln-8000 -- /bin/sh -c 'cd /Users/pc/Desktop/2mln/backend && exec ../.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 > /Users/pc/Desktop/2mln/.freebuff/backend-8000.log 2>&1'
launchctl print gui/$(id -u)/freebuff-backend-2mln-8000 | grep -E "state|pid"
launchctl remove freebuff-backend-2mln-8000   # остановить
```

**Фронтенд (порт по умолчанию 5173; предпочитать его, если свободен):**
```bash
cd frontend && PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH" node node_modules/vite/bin/vite.js --host --port 5173
```
Проверка: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5173/` → 200.

### Детач на macOS (важно)

Командный раннер убивает процессы, запущенные через `nohup … &` из обычной команды, поэтому
сервер нужно поднимать через launchd:
```bash
launchctl submit -l freebuff-preview-2mln-5173 -- /bin/sh -c 'cd /Users/pc/Desktop/2mln/frontend && exec env PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH" node node_modules/vite/bin/vite.js --host --port 5173 > /Users/pc/Desktop/2mln/.freebuff/preview-ac97d0d0-f664-416a-b5e4-ec2693451bd7.log 2>&1'
launchctl print gui/$(id -u)/freebuff-preview-2mln-5173 | grep -E "state|pid"   # pid сервера
launchctl remove freebuff-preview-2mln-5173                                     # остановить
```
Лог: `/Users/pc/Desktop/2mln/.freebuff/preview-ac97d0d0-f664-416a-b5e4-ec2693451bd7.log`.
Порт 5173 был свободен, поэтому взят дефолтный; при занятости — взять свободный и передать
его в `--port` и в URL превью (прокси `/api` от порта не зависит).

## 3. Прод-запуск в Docker (для сервера, Traefik)

Локальной проверки образов на этой машине нет: Docker Desktop не установлен (CLI есть,
демона и плагина `docker compose` — нет). Сборка проверена симуляцией в /tmp: venv из
`requirements.txt` + uvicorn на чистой БД (health 200, seed ок); чистый npm install +
`npm run build` (dist отдаётся). Файлы стека: `docker-compose.yml` (схема Traefik →
frontend:80 → backend:8000, SQLite на volume `budget_data`, labels `2mln.freeddns.org`,
`websecure` + `myresolver`, external-сеть `traefik-public` — имя через `TRAEFIK_NETWORK`),
`backend/Dockerfile` (python:3.12-slim, tzdata, non-root, healthcheck),
`frontend/Dockerfile` (node:22-alpine build → nginx:1.27-alpine), `frontend/nginx.conf`
(gzip, `/api/` → backend:8000, SPA-fallback, `no-store` на index.html), `.env.example`
(`DOMAIN`, `CERTRESOLVER`, `TRAEFIK_NETWORK`, `TZ`). Полная инструкция — README §36:
`cp .env.example .env && docker compose up -d --build` из корня на сервере.
