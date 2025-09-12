from pydantic import BaseSettings, Field

class Settings(BaseSettings):
    API_PREFIX: str = "/api"
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]
    REDIS_URL: str = "redis://redis:6379/0"
    DATABASE_URL: str = "postgresql+psycopg://windborne:windborne@db:5432/windborne"
    UPSTREAM_BASE: str = "https://sfc.windbornesystems.com"
    CACHE_TTL_RAW: int = 6*60*60         # 6h
    CACHE_TTL_SLICE: int = 5*60          # 5m
    class Config: env_file = ".env"

settings = Settings()
