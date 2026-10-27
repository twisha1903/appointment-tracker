import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router, set_service_instance
from app.db.database import get_db_path
from app.db.seed import seed_database_if_empty
from app.services.hospital_service import HospitalIndexService


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize schema and seed database on startup if empty
    db_path = get_db_path()
    seed_database_if_empty(db_path)

    # 2. Hydrate in-memory ADS instances if not already injected by tests
    import app.api.routes as routes_mod
    if routes_mod._default_service is None:
        service = HospitalIndexService(db_path)
        service.rebuild_indexes_from_db()
        set_service_instance(service)
    yield


app = FastAPI(
    title="CareTrack — Hospital Patient & Appointment Management System",
    description="Educational clinical workflow prototype powered by custom Advanced Data Structures.",
    version="1.0.0",
    lifespan=lifespan,
)

# Allowed origins for frontend local dev
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount REST API Routes
app.include_router(router)


@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "service": "CareTrack API",
        "version": "1.0.0",
        "mode": "educational-prototype",
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}
