package applyentitlement

import "time"

type Command struct {
	EventType      string     `json:"-"`
	SubscriptionId string     `json:"subscriptionId"`
	ProfileId      string     `json:"profileId"`
	OwnerUserId    string     `json:"ownerUserId"`
	Plan           string     `json:"plan"`
	Checkmark      string     `json:"checkmark"`
	SellerPlan     string     `json:"sellerPlan"`
	Status         string     `json:"status"`
	Channel        string     `json:"channel"`
	ValidUntil     *time.Time `json:"validUntil"`
}
