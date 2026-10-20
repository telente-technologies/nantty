import base64
import hashlib
import json
import logging
import urllib.error
import urllib.request
from collections.abc import Callable
from typing import Protocol

from src.modules.child_safety.dtos.child_safety_dto import HashMatch

hash_match_logger = logging.getLogger("intelligence.child_safety.hash_match")
type ObjectBytesReader = Callable[[str, str], bytes]


class HashMatchUnavailableError(RuntimeError):
    pass


class HashMatchProvider(Protocol):
    name: str
    enabled: bool

    def match_image(self, data: bytes) -> HashMatch | None:
        pass

    def match_known_digest(self, sha256_hex: str) -> HashMatch | None:
        pass


class DisabledHashMatchProvider:
    name = "disabled"
    enabled = False

    def match_image(self, _data: bytes) -> HashMatch | None:
        return None

    def match_known_digest(self, _sha256_hex: str) -> HashMatch | None:
        return None


class SyntheticSha256HashMatchProvider:
    name = "synthetic-sha256"
    enabled = True

    def __init__(self, known_sha256_hashes: frozenset[str]) -> None:
        self.known_sha256_hashes = frozenset(digest.lower() for digest in known_sha256_hashes)

    def match_image(self, data: bytes) -> HashMatch | None:
        return self.match_known_digest(hashlib.sha256(data).hexdigest())

    def match_known_digest(self, sha256_hex: str) -> HashMatch | None:
        digest = sha256_hex.lower()
        if digest not in self.known_sha256_hashes:
            return None
        return HashMatch(provider=self.name, reference="synthetic:" + digest[:16])


class HttpHashListMatchProvider:
    enabled = True

    def __init__(self, name: str, endpoint: str, api_key: str, timeout_seconds: float) -> None:
        self.name = name
        self.endpoint = endpoint.rstrip("/")
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds

    def match_image(self, data: bytes) -> HashMatch | None:
        return self.post_match_request({"imageBase64": base64.b64encode(data).decode("ascii")})

    def match_known_digest(self, sha256_hex: str) -> HashMatch | None:
        return self.post_match_request({"sha256": sha256_hex.lower()})

    def post_match_request(self, payload: dict[str, str]) -> HashMatch | None:
        request = urllib.request.Request(  # noqa: S310
            self.endpoint + "/match",
            data=json.dumps(payload).encode(),
            headers={"content-type": "application/json", "authorization": "Bearer " + self.api_key},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:  # noqa: S310
                body = json.loads(response.read(65_536))
        except (urllib.error.URLError, TimeoutError, ValueError, OSError) as error:
            hash_match_logger.error("hash_match_provider_unreachable", extra={"provider": self.name})
            raise HashMatchUnavailableError("hash match provider is unreachable") from error
        if not isinstance(body, dict) or not isinstance(body.get("matched"), bool):
            hash_match_logger.error("hash_match_provider_malformed_answer", extra={"provider": self.name})
            raise HashMatchUnavailableError("hash match provider gave a malformed answer")
        if not body["matched"]:
            return None
        return HashMatch(provider=self.name, reference=str(body.get("reference", ""))[:200])


class HashMatchProviderMisconfiguredError(RuntimeError):
    pass


def parse_synthetic_hashes(raw: str) -> frozenset[str]:
    hashes = frozenset(item.strip().lower() for item in raw.split(",") if item.strip())
    if any(len(digest) != 64 or any(char not in "0123456789abcdef" for char in digest) for digest in hashes):
        raise HashMatchProviderMisconfiguredError("synthetic hashes must be 64-character sha256 hex digests")
    return hashes


def build_hash_match_provider(
    provider: str,
    environment: str,
    name: str = "",
    endpoint: str = "",
    api_key: str = "",
    timeout_seconds: float = 3.0,
    synthetic_hashes: str = "",
) -> HashMatchProvider:
    deployed = environment in {"staging", "production"}
    if provider == "disabled":
        return DisabledHashMatchProvider()
    if provider == "synthetic":
        if deployed:
            raise HashMatchProviderMisconfiguredError(
                "the synthetic hash list is a test double and cannot run when deployed"
            )
        return SyntheticSha256HashMatchProvider(parse_synthetic_hashes(synthetic_hashes))
    if provider == "http":
        if not name or not endpoint or len(api_key) < 16 or (deployed and not endpoint.startswith("https://")):
            raise HashMatchProviderMisconfiguredError(
                "hash matching is enabled but the provider name, https endpoint or api key is missing"
            )
        return HttpHashListMatchProvider(name, endpoint, api_key, timeout_seconds)
    raise HashMatchProviderMisconfiguredError("unknown hash match provider")


def match_stored_object(
    provider: HashMatchProvider,
    read_object: ObjectBytesReader | None,
    bucket: str,
    key: str,
) -> HashMatch | None:
    if not provider.enabled:
        return None
    if read_object is None:
        raise HashMatchUnavailableError("stored objects cannot be read for hash matching")
    try:
        data = read_object(bucket, key)
    except Exception as error:
        raise HashMatchUnavailableError("stored object could not be read for hash matching") from error
    return provider.match_image(data) or provider.match_known_digest(hashlib.sha256(data).hexdigest())
