package dtos

type CheckoutRequest struct {
	AddressId             string              `json:"addressId"`
	ShippingQuoteRevision string              `json:"shippingQuoteRevision"`
	UseStoreCredit        *bool               `json:"useStoreCredit"`
	PromoCodes            []PromoCodeRequest  `json:"promoCodes"`
	PaymentModes          []PaymentModeChoice `json:"paymentModes"`
	DirectPaymentAccepted bool                `json:"directPaymentAccepted"`
}

type PaymentModeChoice struct {
	StoreId string `json:"storeId"`
	Mode    string `json:"paymentMode"`
}

type CancelOrderRequest struct {
	Reason string `json:"reason"`
}

type PromoCodeRequest struct {
	StoreId string `json:"storeId"`
	Code    string `json:"code"`
}
