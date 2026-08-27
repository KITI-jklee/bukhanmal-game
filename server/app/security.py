"""서버가 발급한 익명 플레이어 세션 토큰."""
from __future__ import annotations

import base64
import hashlib
import hmac
import struct
import time
import uuid

from fastapi import Header, HTTPException, status

from .config import settings

PLAYER_TOKEN_HEADER = "X-Player-Token"


def issue_player_token(player_key: uuid.UUID) -> str:
    payload = player_key.bytes + struct.pack(">Q", int(time.time()))
    signature = hmac.new(
        settings.player_token_secret.encode("utf-8"), b"player-token:" + payload, hashlib.sha256
    ).digest()
    return base64.urlsafe_b64encode(payload + signature).rstrip(b"=").decode("ascii")


def verify_player_token(token: str) -> uuid.UUID:
    try:
        raw = base64.urlsafe_b64decode(token + "=" * (-len(token) % 4))
    except (ValueError, UnicodeError):
        raw = b""
    if len(raw) != 56:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="플레이어 세션이 올바르지 않습니다.")
    payload, signature = raw[:24], raw[24:]
    expected = hmac.new(
        settings.player_token_secret.encode("utf-8"), b"player-token:" + payload, hashlib.sha256
    ).digest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="플레이어 세션이 올바르지 않습니다.")
    player_key_bytes, issued_at_bytes = payload[:16], payload[16:]
    issued_at = struct.unpack(">Q", issued_at_bytes)[0]
    now = int(time.time())
    if issued_at > now + 300 or now - issued_at > settings.player_token_ttl_seconds:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="플레이어 세션이 만료되었습니다."
        )
    return uuid.UUID(bytes=player_key_bytes)


def require_player(x_player_token: str = Header(alias=PLAYER_TOKEN_HEADER)) -> uuid.UUID:
    return verify_player_token(x_player_token)
