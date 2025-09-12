from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routes.points import router as points_router
from app.api.routes.compare import router as compare_router
from app.api.routes.stations import router as stations_router

app = FastAPI(title="Windborne Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(stations_router, prefix=settings.API_PREFIX)
app.include_router(points_router, prefix=settings.API_PREFIX)
app.include_router(compare_router, prefix=settings.API_PREFIX)

@app.get("/")
def root():
    return {"ok": True, "api": settings.API_PREFIX}