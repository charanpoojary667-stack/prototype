"""Verify the shared Node HS256 token and authorize shared users by role."""

import base64
import binascii
import hashlib
import hmac
import json
import re
import time
from dataclasses import dataclass
from typing import Literal
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.dependencies import get_db
from backend.app.models import User


UserRole = Literal["organizer", "judge", "participant"]
JWT_SEGMENT = re.compile(r"^[A-Za-z0-9_-]+$")
UUID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class AuthenticatedPrincipal:
    """Shared database user identity and role for protected API operations."""

    user_id: str
    role: UserRole

    @property
    def judge_id(self) -> str | None:
        return self.user_id if self.role == "judge" else None


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _decode_segment(value: str) -> dict[str, object]:
    if not JWT_SEGMENT.fullmatch(value):
        raise ValueError("invalid base64url segment")
    padding = "=" * (-len(value) % 4)
    decoded = base64.urlsafe_b64decode(value + padding)
    parsed = json.loads(decoded)
    if not isinstance(parsed, dict):
        raise ValueError("JWT segment must contain a JSON object")
    return parsed


def verify_shared_jwt(token: str, secret: str | None = None) -> str:
    """Verify the Node HS256 contract and return its subject UUID."""

    signing_secret = secret or settings.jwt_secret
    if not signing_secret:
        raise _unauthorized()
    try:
        parts = token.split(".")
        if len(parts) != 3 or any(not part for part in parts):
            raise ValueError("JWT must have three parts")
        encoded_header, encoded_claims, encoded_signature = parts
        header = _decode_segment(encoded_header)
        claims = _decode_segment(encoded_claims)
        if header.get("alg") != "HS256" or header.get("typ") != "JWT":
            raise ValueError("unexpected JWT header")

        signed_value = f"{encoded_header}.{encoded_claims}".encode("ascii")
        expected_signature = hmac.new(
            signing_secret.encode("utf-8"), signed_value, hashlib.sha256
        ).digest()
        signature = base64.urlsafe_b64decode(
            encoded_signature + "=" * (-len(encoded_signature) % 4)
        )
        if not hmac.compare_digest(signature, expected_signature):
            raise ValueError("invalid JWT signature")

        subject = claims.get("sub")
        issued_at = claims.get("iat")
        expires_at = claims.get("exp")
        now = int(time.time())
        if (
            not isinstance(subject, str)
            or not UUID_PATTERN.fullmatch(subject)
            or not isinstance(issued_at, int)
            or isinstance(issued_at, bool)
            or not isinstance(expires_at, int)
            or isinstance(expires_at, bool)
            or claims.get("iss") != settings.jwt_issuer
            or claims.get("aud") != settings.jwt_audience
            or expires_at <= issued_at
            or expires_at <= now
            or issued_at > now + 60
        ):
            raise ValueError("invalid JWT claims")
        return str(UUID(subject))
    except (ValueError, TypeError, KeyError, binascii.Error, UnicodeError, json.JSONDecodeError):
        raise _unauthorized() from None


def get_current_user(
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_db),
) -> AuthenticatedPrincipal:
    """Verify a shared token, then get the authoritative role from `users`."""

    if not authorization or not authorization.lower().startswith("bearer "):
        raise _unauthorized()
    user_id = verify_shared_jwt(authorization[7:].strip())
    user = session.get(User, user_id)
    if user is None:
        raise _unauthorized()
    if user.role not in ("organizer", "judge", "participant"):
        raise _unauthorized()
    return AuthenticatedPrincipal(user_id=user.id, role=user.role)  # type: ignore[arg-type]


def require_judge_identity(principal: AuthenticatedPrincipal) -> str:
    """Return the authenticated judge UUID or deny access."""

    if principal.role != "judge":
        raise HTTPException(status_code=403, detail="Judge access is required")
    return principal.user_id


def authorize_judge_data(principal: AuthenticatedPrincipal, data_judge_id: str) -> None:
    """Allow organizers or the judge who owns a judging record."""

    if principal.role == "organizer":
        return
    if principal.role == "judge" and principal.user_id == data_judge_id:
        return
    raise HTTPException(status_code=403, detail="You may not access this judge's private data")
