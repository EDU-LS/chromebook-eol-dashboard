FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Share the backend app code (sync engine lives there)
COPY backend/app ./app

COPY worker/run_sync.py .

CMD ["python", "run_sync.py"]
