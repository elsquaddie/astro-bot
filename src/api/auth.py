"""API key authentication middleware."""
from fastapi import HTTPException, Security
from fastapi.security import APIKeyHeader

from src.config import settings

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: str | None = Security(api_key_header)) -> str:
    if api_key is None or api_key != settings.API_SECRET_KEY:
        raise HTTPException(status_code=403, detail="Invalid or missing API key")
    return api_key
