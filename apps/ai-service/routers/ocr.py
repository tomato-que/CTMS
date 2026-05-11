"""OCR parsing endpoints"""
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel, Field

router = APIRouter()


class OcrParseRequest(BaseModel):
    file_id: str = Field(..., description="MinIO file ID")
    ocr_type: str = Field(default="LAB_REPORT")
    ocr_job_id: str = Field(...)
    callback_url: str | None = None


class OcrParseResponse(BaseModel):
    job_id: str
    status: str


@router.post("/parse", response_model=OcrParseResponse)
async def parse_document(request: OcrParseRequest, background_tasks: BackgroundTasks):
    """OCR document parsing - async processing"""
    # TODO: Add real OCR processing via background_tasks
    return OcrParseResponse(job_id=request.ocr_job_id, status="queued")


@router.post("/batch")
async def parse_batch(requests: list[OcrParseRequest]):
    """Batch OCR parsing"""
    return {"accepted": len(requests)}
