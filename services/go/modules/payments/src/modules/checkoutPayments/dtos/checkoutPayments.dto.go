package dtos

import "zudomart/modules/payments/src/modules/gateway/models"

type InitializeOrderPaymentRequestDto struct {
	OrderId    string `json:"orderId,omitempty"`
	CheckoutId string `json:"checkoutId,omitempty"`
	Provider string `json:"provider,omitempty"`
	ReturnTo string `json:"returnTo,omitempty"`
}

type PaymentInitializationDto struct {
	OrderId                     string                   `json:"orderId"`
	CheckoutId                  string                   `json:"checkoutId"`
	Reference                   string                   `json:"reference"`
	CheckoutUrl                 string                   `json:"checkoutUrl"`
	AuthorizationUrl            string                   `json:"authorizationUrl"`
	CallbackUrl                 string                   `json:"callbackUrl"`
	PaymentsRemainingInCheckout int                      `json:"paymentsInCheckout"`
	Payment                     models.PaymentIntentView `json:"payment"`
}

type OrderPaymentStatusDto struct {
	Status string `json:"status"`
}
