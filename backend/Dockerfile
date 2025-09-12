FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml poetry.lock* requirements.txt* /app/
# pick one: pip or poetry
RUN pip install --no-cache-dir -r requirements.txt
COPY app /app/app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]