import hashlib
import hmac
from pathlib import Path


def calculate_file_sha256_hex(file_path: Path) -> str:
    digest = hashlib.sha256()
    with file_path.open("rb") as artifact_file:
        for chunk in iter(lambda: artifact_file.read(1_048_576), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sign_artifact_digest(signing_secret: str, artifact_sha256_hex: str) -> str:
    return hmac.new(signing_secret.encode("utf-8"), artifact_sha256_hex.encode("ascii"), hashlib.sha256).hexdigest()


def verify_artifact_integrity(
    artifact_path: Path,
    expected_sha256_hex: str,
    signing_secret: str,
    provided_signature_hex: str | None,
) -> str | None:
    actual_sha256_hex = calculate_file_sha256_hex(artifact_path)
    if not hmac.compare_digest(actual_sha256_hex, expected_sha256_hex):
        return "artifact_digest_mismatch"
    if signing_secret:
        if not provided_signature_hex:
            return "artifact_signature_missing"
        expected_signature_hex = sign_artifact_digest(signing_secret, actual_sha256_hex)
        if not hmac.compare_digest(expected_signature_hex, provided_signature_hex):
            return "artifact_signature_mismatch"
    return None
