# Бэкенд: FastAPI + SQLite (aiosqlite). Python 3.12 — под неё есть готовые
# manylinux-колёса у uvicorn[standard] (uvloop/httptools), сборка идёт без компиляции.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    # БД по умолчанию — на volume (/data), а не внутри слоя образа
    DB_PATH=/data/budget.db

# tzdata: без него TZ из окружения не сдвигает границу дня, а от date.today()
# зависят дневной лимит, стрик, монеты и нокаут питомца (services/budget.py).
RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Зависимости отдельным слоем: правки в app/ не пересобирают их заново
COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Непривилегированный пользователь. /data создаётся в образе с владельцем appuser:
# Docker копирует права при первой инициализации пустого named volume, поэтому
# приложению не нужен root, чтобы писать в БД и WAL рядом с ней.
RUN useradd --system --uid 10001 --create-home appuser \
    && mkdir -p /data \
    && chown -R appuser:appuser /data /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=5 \
    CMD ["python", "-c", "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3).status == 200 else 1)"]

# --proxy-headers нужен, когда впереди встанет Traefik: иначе схема и IP клиента
# в приложении останутся внутренними (http/172.x).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
