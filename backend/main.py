from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from backend.config import get_settings
from backend.routers import ingress, dashboard, credentials, auth

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

# No browser client existed until the web frontend (signup/login/capture) —
# without this, every fetch() from Vercel to this API is silently blocked
# by the browser's CORS policy before the request even leaves the page.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingress.router)
app.include_router(dashboard.router)
app.include_router(credentials.router)
app.include_router(auth.router)

@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "engine": f"{settings.app_name} operational"}

