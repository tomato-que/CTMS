"""Structured extraction endpoints"""
from fastapi import APIRouter

router = APIRouter()


@router.post("/fields")
async def extract_fields(data: dict):
    """Extract structured fields from OCR result"""
    return {"status": "not_implemented", "fields": []}
