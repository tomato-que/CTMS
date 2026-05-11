"""Auto-summary endpoints"""
from fastapi import APIRouter

router = APIRouter()


@router.post("/generate")
async def generate_summary(data: dict):
    """Generate text summary"""
    return {"summary": "Summary service not yet configured"}
