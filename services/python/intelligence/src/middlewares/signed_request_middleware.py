import logging
import time
from collections.abc import Callable

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from src.constants.signed_request_header_constant import NONCE_HEADER_NAME, SIGNATURE_HEADER_NAME, TIMESTAMP_HEADER_NAME
from src.interfaces.feature_backend_interface import FeatureBackend, FeatureBackendUnavailableError
from src.repositories.online_feature_keyspace_repository import OnlineFeatureKeyspace
from src.utils.asgi_response_util import read_header_value, send_json_error_response
from src.utils.request_signature_util import (
    SignatureVerificationOutcome,
    precheck_signature_headers,
    verify_signed_request_headers,
)

security_logger = logging.getLogger("intelligence.security")


def signed_path_candidates(scope: Scope) -> list[str]:
    decoded_path = str(scope["path"])
    raw_path = scope.get("raw_path")
    if isinstance(raw_path, bytes) and raw_path.decode("latin-1") != decoded_path:
        return [decoded_path, raw_path.decode("latin-1")]
    return [decoded_path]


PROTECTED_PATH_PREFIX = "/v1/"
EVENT_INGESTION_PATH = "/v1/events"


class RequestBodyTooLargeError(Exception):
    pass


class SignedRequestMiddleware:
    def __init__(
        self,
        application: ASGIApp,
        accepted_shared_secrets: list[str],
        maximum_clock_skew_seconds: int,
        nonce_retention_seconds: int,
        maximum_request_body_bytes: int,
        maximum_event_batch_body_bytes: int,
        nonce_backend: FeatureBackend,
        keyspace: OnlineFeatureKeyspace,
        current_time_provider: Callable[[], float] = time.time,
    ) -> None:
        self.application = application
        self.accepted_shared_secrets = [secret for secret in accepted_shared_secrets if secret]
        self.maximum_clock_skew_seconds = maximum_clock_skew_seconds
        self.nonce_retention_seconds = nonce_retention_seconds
        self.maximum_request_body_bytes = maximum_request_body_bytes
        self.maximum_event_batch_body_bytes = maximum_event_batch_body_bytes
        self.nonce_backend = nonce_backend
        self.keyspace = keyspace
        self.current_time_provider = current_time_provider

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not str(scope["path"]).startswith(PROTECTED_PATH_PREFIX):
            await self.application(scope, receive, send)
            return
        body_limit = (
            self.maximum_event_batch_body_bytes
            if scope["path"] == EVENT_INGESTION_PATH
            else self.maximum_request_body_bytes
        )
        raw_headers: list[tuple[bytes, bytes]] = list(scope.get("headers", []))
        declared_length = read_header_value(raw_headers, b"content-length")
        if declared_length is not None and (not declared_length.isdigit() or int(declared_length) > body_limit):
            await send_json_error_response(send, 413, "request_body_too_large")
            return
        precheck_failure = precheck_signature_headers(
            read_header_value(raw_headers, TIMESTAMP_HEADER_NAME.encode()),
            read_header_value(raw_headers, NONCE_HEADER_NAME.encode()),
            read_header_value(raw_headers, SIGNATURE_HEADER_NAME.encode()),
            self.current_time_provider(),
            self.maximum_clock_skew_seconds,
        )
        if precheck_failure is not None:
            security_logger.warning("signature_rejected", extra={"reason": precheck_failure, "path": scope["path"]})
            await send_json_error_response(send, 401, "unauthenticated")
            return
        try:
            body_bytes = await self.read_request_body_with_limit(receive, body_limit)
        except RequestBodyTooLargeError:
            await send_json_error_response(send, 413, "request_body_too_large")
            return
        query_string = scope.get("query_string", b"").decode("latin-1")
        outcome = SignatureVerificationOutcome(False, "missing_signature_headers")
        for candidate_path in signed_path_candidates(scope):
            path_with_query = f"{candidate_path}?{query_string}" if query_string else candidate_path
            outcome = verify_signed_request_headers(
                self.accepted_shared_secrets,
                str(scope["method"]),
                path_with_query,
                read_header_value(raw_headers, TIMESTAMP_HEADER_NAME.encode()),
                read_header_value(raw_headers, NONCE_HEADER_NAME.encode()),
                read_header_value(raw_headers, SIGNATURE_HEADER_NAME.encode()),
                body_bytes,
                self.current_time_provider(),
                self.maximum_clock_skew_seconds,
            )
            if outcome.is_valid:
                break
        if not outcome.is_valid or outcome.nonce is None:
            security_logger.warning(
                "signature_rejected", extra={"reason": outcome.failure_reason, "path": scope["path"]}
            )
            await send_json_error_response(send, 401, "unauthenticated")
            return
        try:
            nonce_claims = await self.nonce_backend.claim_keys_if_absent(
                [self.keyspace.nonce_key(outcome.nonce)], self.nonce_retention_seconds
            )
        except FeatureBackendUnavailableError:
            security_logger.error("nonce_store_unavailable", extra={"path": scope["path"]})
            await send_json_error_response(send, 503, "replay_protection_unavailable")
            return
        if not nonce_claims[0]:
            security_logger.warning("signature_rejected", extra={"reason": "replayed_nonce", "path": scope["path"]})
            await send_json_error_response(send, 401, "unauthenticated")
            return
        await self.application(scope, self.build_replaying_receive(body_bytes, receive), send)

    @staticmethod
    async def read_request_body_with_limit(receive: Receive, body_limit: int) -> bytes:
        body_chunks: list[bytes] = []
        received_bytes = 0
        while True:
            message = await receive()
            if message["type"] != "http.request":
                break
            chunk = message.get("body", b"")
            received_bytes += len(chunk)
            if received_bytes > body_limit:
                raise RequestBodyTooLargeError
            body_chunks.append(chunk)
            if not message.get("more_body", False):
                break
        return b"".join(body_chunks)

    @staticmethod
    def build_replaying_receive(body_bytes: bytes, original_receive: Receive) -> Receive:
        body_already_delivered = False

        async def replaying_receive() -> Message:
            nonlocal body_already_delivered
            if not body_already_delivered:
                body_already_delivered = True
                return {"type": "http.request", "body": body_bytes, "more_body": False}
            return await original_receive()

        return replaying_receive
