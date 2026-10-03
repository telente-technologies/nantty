package dtos

type CheckoutRequest struct {
	AddressId      string             `json:"addressId"`
	UseStoreCredit *bool              `json:"useStoreCredit"`
	PromoCodes     []PromoCodeRequest `json:"promoCodes"`
}

type CancelOrderRequest struct {
	Reason string `json:"reason"`
}

type PromoCodeRequest struct {
	StoreId string `json:"storeId"`
	Code    string `json:"code"`
}
