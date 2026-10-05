package errors

import "net/http"

var (
	DisputeOpen          = Api(http.StatusConflict, "DISPUTE_OPEN", "This order has an open dispute. Refund it by resolving the dispute.")
	NothingRefundable    = Api(http.StatusConflict, "NOTHING_REFUNDABLE", "Nothing on this order can be refunded.")
	RefundInProgress     = Api(http.StatusConflict, "REFUND_IN_PROGRESS", "A refund for this order is already on its way.")
	IdempotencyKeyReused = Api(http.StatusUnprocessableEntity, "IDEMPOTENCY_KEY_REUSED", "That Idempotency-Key was already used for a different refund.")
	AuditUnavailable     = Api(http.StatusServiceUnavailable, "AUDIT_UNAVAILABLE", "The refund couldn't be audited, so it wasn't issued. Try again.")
	EscrowUnavailable    = Api(http.StatusBadGateway, "UPSTREAM_UNAVAILABLE", "The escrow service is unavailable right now. Try again.")
	ReportUnavailable    = Api(http.StatusBadGateway, "UPSTREAM_UNAVAILABLE", "This report's data source is unavailable right now. Try again.")
)
