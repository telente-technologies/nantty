DOMAIN_EVENTS_EXCHANGE = "nantty.events"
JOBS_EXCHANGE = "nantty.jobs"
RETRY_EXCHANGE = "nantty.retry"
MAXIMUM_DELIVERY_ATTEMPTS = 5
ATTEMPT_HEADER = "x-nantty-attempt"
LAST_ERROR_HEADER = "x-nantty-last-error"
RETRY_TIER_NAMES = ("30s", "2m", "10m", "30m")
