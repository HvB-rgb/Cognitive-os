from fastapi import FastAPI
from contextlib import asynccontextmanager
from backend.config import get_settings
from backend.routers import ingress, dashboard  

settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"[{settings.app_name}] Starting — env: {settings.environment}")
    yield
    print(f"[{settings.app_name}] Shutting down")

app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
    docs_url="/docs" if settings.environment == "development" else None,
)

app.include_router(ingress.router)
app.include_router(dashboard.router)

@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "engine": f"{settings.app_name} operational"}

