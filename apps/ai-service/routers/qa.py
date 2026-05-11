"""Knowledge base Q&A endpoints"""
from fastapi import APIRouter

router = APIRouter()


@router.post("/ask")
async def ask_question(data: dict):
    """Ask a question to the knowledge base"""
    return {"answer": "QA service not yet configured", "citations": []}
