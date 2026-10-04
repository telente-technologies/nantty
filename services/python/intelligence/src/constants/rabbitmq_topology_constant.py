DOMAIN_EVENTS_EXCHANGE = "zudomart.events"
JOBS_EXCHANGE = "zudomart.jobs"
RETRY_EXCHANGE = "zudomart.retry"
MAXIMUM_DELIVERY_ATTEMPTS = 5
ATTEMPT_HEADER = "x-zudomart-attempt"
LAST_ERROR_HEADER = "x-zudomart-last-error"
RETRY_TIER_NAMES = ("30s", "2m", "10m", "30m")
