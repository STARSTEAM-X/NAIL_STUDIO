import secrets

from fastapi import Header, HTTPException, status

from .config import get_settings


def require_internal_token(x_ai_internal_token: str | None = Header(default=None)) -> None:
    """Reject requests that are not made by the trusted API service.

    A missing configured token is intentionally a startup/configuration error in
    production, but development can still boot and expose only the health route.
    """

    configured = get_settings().ai_internal_token
    if not configured or not x_ai_internal_token or not secrets.compare_digest(
        x_ai_internal_token, configured
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="AI service requires an internal token",
        )
