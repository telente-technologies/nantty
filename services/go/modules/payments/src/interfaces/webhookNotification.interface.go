package interfaces

type WebhookKind string

const (
	WebhookKindCharge         WebhookKind = "charge"
	WebhookKindChargeRejected WebhookKind = "chargeRejected"
	WebhookKindRefund         WebhookKind = "refund"
	WebhookKindTransfer       WebhookKind = "transfer"
	WebhookKindDispute        WebhookKind = "dispute"
	WebhookKindSubscription   WebhookKind = "subscription"
	WebhookKindInvoice        WebhookKind = "invoice"
	WebhookKindIdentification WebhookKind = "identification"
	WebhookKindOther          WebhookKind = "other"
)

type WebhookNotification struct {
	EventKey           string
	EventType          string
	Kind               WebhookKind
	Reference          string
	ProviderObjectId   string
	ProviderChargeId   string
	ProviderCustomerId string
	Status             string
	AmountMinor        int64
	Currency           string
	FailureReason      string
	Dispute            *ProviderDispute
	Subscription       *ProviderSubscriptionUpdate
}
