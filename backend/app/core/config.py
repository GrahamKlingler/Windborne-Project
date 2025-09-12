from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    API_PREFIX: str = "/api"
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    REDIS_URL: str = "redis://localhost:6379/0"
    # Upstream base; adjust if needed
    UPSTREAM_BASE: str = "https://sfc.windbornesystems.com"
    # Optional station list endpoint (used by demo /stations route)
    STATION_LIST_PATH: str = "/stations"

    # Cache TTLs (seconds)
    CACHE_TTL_RAW: int = 6*60*60       # 6h
    CACHE_TTL_SLICE: int = 5*60        # 5m
    CACHE_TTL_SEARCH: int = 60         # 1m

    class Config:
        env_file = ".env"

settings = Settings()