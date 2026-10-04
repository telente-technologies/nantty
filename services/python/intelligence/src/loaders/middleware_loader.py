from fastapi import FastAPI

from src.container import ApplicationContainer
from src.middlewares.rate_limit_and_access_log_middleware import AccessLogMiddleware, RateLimitMiddleware
from src.middlewares.signed_request_middleware import SignedRequestMiddleware
from src.utils.token_bucket_rate_limiter_util import TokenBucketRateLimiter


def load_security_middlewares(application: FastAPI, container: ApplicationContainer) -> None:
    settings = container.settings
    application.add_middleware(
        SignedRequestMiddleware,
        accepted_shared_secrets=[
            settings.shared_secret.get_secret_value(),
            settings.previous_shared_secret.get_secret_value(),
        ],
        maximum_clock_skew_seconds=settings.signature_max_clock_skew_seconds,
        nonce_retention_seconds=settings.nonce_retention_seconds,
        maximum_request_body_bytes=settings.max_request_body_bytes,
        maximum_event_batch_body_bytes=settings.max_event_batch_body_bytes,
        nonce_backend=container.feature_backend,
        keyspace=container.feature_store.keyspace,
    )
    application.add_middleware(
        RateLimitMiddleware,
        rate_limiter=TokenBucketRateLimiter(settings.rate_limit_requests_per_second, settings.rate_limit_burst_size),
    )
    application.add_middleware(AccessLogMiddleware)
