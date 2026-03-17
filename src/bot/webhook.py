"""Webhook security: verify Telegram secret token."""
from fastapi import HTTPException, Request

from src.config import settings


async def verify_telegram_secret(request: Request) -> None:
    """Verify X-Telegram-Bot-Api-Secret-Token header."""
    token = request.headers.get("X-Telegram-Bot-Api-Secret-Token")
    if token != settings.WEBHOOK_SECRET:
        raise HTTPException(status_code=403, detail="Invalid secret token")
