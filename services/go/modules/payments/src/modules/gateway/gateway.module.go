package gateway

import (
	"zudomart/modules/payments/src/constants"
	"zudomart/modules/payments/src/container"
	bankservices "zudomart/modules/payments/src/modules/banks/services"
	"zudomart/modules/payments/src/modules/gateway/services"
)

type Application struct {
	Container *container.Container
	Gateway   *services.PaymentGateway
	Banks     *bankservices.BankDirectory
}

func NewPaymentsApplication(container *container.Container) *Application {
	gateway := services.NewPaymentGateway(container)
	gateway.RegisterPaymentPurposeHandler(constants.PurposeCardVerification, services.CardVerificationPayments{Gateway: gateway})
	return &Application{
		Container: container,
		Gateway:   gateway,
		Banks:     &bankservices.BankDirectory{Provider: container.Providers[container.Settings.DefaultProvider], Now: container.Now},
	}
}
