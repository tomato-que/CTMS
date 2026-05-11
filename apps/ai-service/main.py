"""CTMS AI/OCR Service - FastAPI Application"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from config import settings
from routers import ocr, extraction, qa, summary

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("CTMS AI Service starting...")
    logger.info(f"Java API callback: {settings.java_api_base_url}{settings.java_api_callback_path}")
    yield
    logger.info("CTMS AI Service shutting down...")


app = FastAPI(
    title="CTMS AI/OCR Service",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ocr.router, prefix="/ocr", tags=["OCR"])
app.include_router(extraction.router, prefix="/extract", tags=["Extraction"])
app.include_router(qa.router, prefix="/qa", tags=["Q&A"])
app.include_router(summary.router, prefix="/summary", tags=["Summary"])


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "ctms-ai-service"}


@app.get("/model/version")
async def model_versions():
    return {"models": [], "status": "no models loaded yet"}
