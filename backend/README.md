# Windborne Backend Scaffold

A FastAPI backend with Redis caching for station search, single-station slices, and multi-station compare. Ships with request coalescing, ETag revalidation, and row-wise normalization.

## Quickstart

```bash
# 1) Clone this scaffold
# 2) Put a copy of .env.example as .env (edit if needed)

docker compose up --build
# open http://localhost:8000/docs