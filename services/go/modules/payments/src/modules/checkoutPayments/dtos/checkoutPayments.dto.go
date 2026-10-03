package dtos

import "zudomart/modules/payments/src/modules/gateway/models"

type InitializeOrderPaymentRequestDto struct {
	OrderId  string `json:"orderId"`
	Provider string `json:"provider"`
	ReturnTo string `json:"returnTo,omitempty"`
}

type PaymentInitializationDto struct {
	OrderId          string                   `json:"orderId"`
	Reference        string                   `json:"reference"`
	AuthorizationUrl string                   `json:"authorizationUrl"`
	AccessCode       string                   `json:"accessCode,omitempty"`
	CallbackUrl      string                   `json:"callbackUrl"`
	Payment          models.PaymentIntentView `json:"payment"`
}

type OrderPaymentStatusDto struct {
	Status string `json:"status"`
}
