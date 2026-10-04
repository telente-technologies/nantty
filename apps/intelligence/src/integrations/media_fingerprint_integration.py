import asyncio
import json
import urllib.error
import urllib.request
from typing import Any

from src.interfaces.audio_fingerprint_source_interface import ChromaprintFingerprint


class UnavailableAudioFingerprintSource:
    source_name = "placeholder"

    async def fetch_chromaprint(self, _media_id: str) -> ChromaprintFingerprint | None:
        return None


class HttpMediaAudioFingerprintSource:
    source_name = "chromaprint"

    def __init__(self, base_url: str, token: str, timeout_seconds: float) -> None:
        if not base_url.startswith(("http://", "https://")):
            raise ValueError("INTELLIGENCE_MEDIA_INTERNAL_URL must be an http(s) URL")
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout_seconds = timeout_seconds

    def request_fingerprint(self, media_id: str) -> dict[str, Any] | None:
        request = urllib.request.Request(  # noqa: S310 - scheme validated in __init__
            f"{self.base_url}/internal/v1/media/{media_id}/audio-fingerprint",
            data=b"{}",
            method="POST",
            headers={"content-type": "application/json", "x-internal-token": self.token},
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:  # noqa: S310
                parsed: dict[str, Any] = json.loads(response.read())
                return parsed
        except urllib.error.URLError, TimeoutError, ValueError:
            return None

    async def fetch_chromaprint(self, media_id: str) -> ChromaprintFingerprint | None:
        payload = await asyncio.to_thread(self.request_fingerprint, media_id)
        fingerprint = (payload or {}).get("fingerprint")
        if not isinstance(fingerprint, dict) or not isinstance(fingerprint.get("fingerprint"), list):
            return None
        values = tuple(int(value) for value in fingerprint["fingerprint"] if isinstance(value, int))
        if not values:
            return None
        return ChromaprintFingerprint(
            media_id=media_id, duration_seconds=float(fingerprint.get("durationSeconds") or 0.0), values=values
        )
