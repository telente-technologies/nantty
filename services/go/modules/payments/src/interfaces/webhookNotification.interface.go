package interfaces

type WebhookKind string

const (
	WebhookKindCharge        WebhookKind = "charge"
	WebhookKindCheckout      WebhookKind = "checkout"
	WebhookKindRefund        WebhookKind = "refund"
	WebhookKindPayout        WebhookKind = "payout"
	WebhookKindTransfer      WebhookKind = "transfer"
	WebhookKindDispute       WebhookKind = "dispute"
	WebhookKindAccount       WebhookKind = "account"
	WebhookKindCapability    WebhookKind = "capability"
	WebhookKindSubscription  WebhookKind = "subscription"
	WebhookKindInvoice       WebhookKind = "invoice"
	WebhookKindPaymentMethod WebhookKind = "paymentMethod"
	WebhookKindOther         WebhookKind = "other"
)

type WebhookNotification struct {
	EventKey           string
	EventType          string
	Kind               WebhookKind
	ConnectedAccountId string
	Reference          string
	ProviderObjectId   string
	ProviderChargeId   string
	ProviderCheckoutId string
	Status             string
	Capability         string
	Dispute            *ProviderDispute
	Subscription       *ProviderSubscriptionUpdate
	AmountMinor        int64
	Currency           string
	SavedPaymentMethod *SavedPaymentMethod
}
