package enums

const (
	StatusPending    = "pending"
	StatusNew        = "new"
	StatusProcessing = "processing"
	StatusReady      = "ready"
	StatusShipped    = "shipped"
	StatusDelivered  = "delivered"
	StatusCompleted  = "completed"
	StatusCancelled  = "cancelled"
	StatusReturned   = "returned"
	StatusRefunded   = "refunded"
	StatusDisputed   = "disputed"
)

var SellerStatuses = []string{StatusNew, StatusProcessing, StatusReady, StatusShipped, StatusDelivered, StatusCompleted, StatusCancelled, StatusReturned, StatusRefunded, StatusDisputed}

const (
	PaymentPending           = "pending"
	PaymentPaid              = "paid"
	PaymentPartiallyRefunded = "partially_refunded"
	PaymentRefunded          = "refunded"
)

const (
	CheckoutRegistering = "registering"
	CheckoutPayable     = "payable"
	CheckoutFailed      = "failed"
	CheckoutExpired     = "expired"
	CheckoutPaid        = "paid"
)

const (
	ActorSystem = "system"
	ActorBuyer  = "buyer"
	ActorSeller = "seller"
)

const (
	CreditEarn    = "earn"
	CreditReverse = "reverse"
	CreditRedeem  = "redeem"
	CreditExpire  = "expire"
	CreditRestore = "restore"
)

const (
	ShippingFee            = "fee"
	ShippingFreeRule       = "free_rule"
	ShippingFreeThreshold  = "free_threshold"
	ShippingNotDeliverable = "not_deliverable"
	LevelCountry           = "country"
	LevelRegion            = "state"
	LevelAdminArea         = "lga"
)
