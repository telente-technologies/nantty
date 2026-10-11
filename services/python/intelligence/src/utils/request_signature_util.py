import hashlib
import hmac
import re
from dataclasses import dataclass

from src.constants.signed_request_header_constant import SIGNATURE_SCHEME_VERSION

NONCE_PATTERN = re.compile(r"^[A-Za-z0-9_\-]{16,64}$")
SIGNATURE_PATTERN = re.compile(r"^v1=[0-9a-f]{64}$")
TIMESTAMP_PATTERN = re.compile(r"^[0-9]{9,11}$")


@dataclass(frozen=True, slots=True)
class SignatureVerificationOutcome:
    is_valid: bool
    failure_reason: str | None = None
    nonce: str | None = None


def build_canonical_request_string(
    http_method: str, path_with_query: str, unix_timestamp_seconds: str, nonce: str, body_bytes: bytes
) -> bytes:
    body_digest_hex = hashlib.sha256(body_bytes).hexdigest()
    canonical_parts = [
        SIGNATURE_SCHEME_VERSION,
        http_method.upper(),
        path_with_query,
        unix_timestamp_seconds,
        nonce,
        body_digest_hex,
    ]
    return "\n".join(canonical_parts).encode("utf-8")


def compute_request_signature_header_value(
    shared_secret: str,
    http_method: str,
    path_with_query: str,
    unix_timestamp_seconds: str,
    nonce: str,
    body_bytes: bytes,
) -> str:
    canonical_request = build_canonical_request_string(
        http_method, path_with_query, unix_timestamp_seconds, nonce, body_bytes
    )
    digest_hex = hmac.new(shared_secret.encode("utf-8"), canonical_request, hashlib.sha256).hexdigest()
    return f"{SIGNATURE_SCHEME_VERSION}={digest_hex}"


def precheck_signature_headers(
    timestamp_header_value: str | None,
    nonce_header_value: str | None,
    signature_header_value: str | None,
    current_unix_time_seconds: float,
    maximum_clock_skew_seconds: int,
) -> str | None:
    if not timestamp_header_value or not nonce_header_value or not signature_header_value:
        return "missing_signature_headers"
    if not TIMESTAMP_PATTERN.match(timestamp_header_value):
        return "malformed_timestamp"
    if not NONCE_PATTERN.match(nonce_header_value):
        return "malformed_nonce"
    if not SIGNATURE_PATTERN.match(signature_header_value):
        return "malformed_signature"
    if abs(current_unix_time_seconds - int(timestamp_header_value)) > maximum_clock_skew_seconds:
        return "timestamp_outside_allowed_window"
    return None


def verify_signed_request_headers(
    accepted_shared_secrets: list[str],
    http_method: str,
    path_with_query: str,
    timestamp_header_value: str | None,
    nonce_header_value: str | None,
    signature_header_value: str | None,
    body_bytes: bytes,
    current_unix_time_seconds: float,
    maximum_clock_skew_seconds: int,
) -> SignatureVerificationOutcome:
    precheck_failure = precheck_signature_headers(
        timestamp_header_value,
        nonce_header_value,
        signature_header_value,
        current_unix_time_seconds,
        maximum_clock_skew_seconds,
    )
    if (
        precheck_failure is not None
        or not timestamp_header_value
        or not nonce_header_value
        or not signature_header_value
    ):
        return SignatureVerificationOutcome(False, precheck_failure or "missing_signature_headers")
    signature_matches_any_secret = False
    for shared_secret in accepted_shared_secrets:
        if not shared_secret:
            continue
        expected_signature = compute_request_signature_header_value(
            shared_secret,
            http_method,
            path_with_query,
            timestamp_header_value,
            nonce_header_value,
            body_bytes,
        )
        if hmac.compare_digest(expected_signature, signature_header_value):
            signature_matches_any_secret = True
    if not signature_matches_any_secret:
        return SignatureVerificationOutcome(False, "signature_mismatch")
    return SignatureVerificationOutcome(True, None, nonce_header_value)
