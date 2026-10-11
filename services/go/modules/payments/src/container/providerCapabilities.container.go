package container

import (
	"fmt"
	"net/http"
	"time"

	"zudomart/modules/payments/src/configs"
	"zudomart/modules/payments/src/constants"
	"zudomart/modules/payments/src/integrations"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/platform/httpserver"
)

var ErrProviderCapabilityMissing = httpserver.NewApiError(http.StatusUnprocessableEntity, "PAYMENT_PROVIDER_CAPABILITY_MISSING", "This payment provider does not support this operation.")

func NewProvidersFromSettings(settings configs.PaymentsSettings) (map[string]interfaces.PaymentProvider, error) {
	providers := map[string]interfaces.PaymentProvider{constants.ProviderPaystack: NewPaystackProviderFromSettings(settings)}
	if settings.Flutterwave.SecretKey != "" || settings.DefaultProvider == constants.ProviderFlutterwave {
		providers[constants.ProviderFlutterwave] = NewFlutterwaveProviderFromSettings(settings)
	}
	switch settings.DefaultProvider {
	case constants.ProviderPaystack, constants.ProviderFlutterwave:
		return providers, nil
	}
	return nil, fmt.Errorf("PAYMENTS_PROVIDER must be paystack or flutterwave, got %q", settings.DefaultProvider)
}

func NewFlutterwaveProviderFromSettings(settings configs.PaymentsSettings) *integrations.FlutterwaveProvider {
	flutterwave := settings.Flutterwave
	return integrations.NewFlutterwaveProvider(integrations.FlutterwaveSettings{
		BaseUrl: flutterwave.BaseUrl, SecretKey: flutterwave.SecretKey, WebhookHash: flutterwave.WebhookHash, MerchantId: flutterwave.MerchantId,
		SupportedCurrencies: flutterwave.SupportedCurrencies, TransferCallbackUrl: flutterwave.TransferCallbackUrl, MaximumAttempts: flutterwave.MaximumAttempts,
		RetryBaseDelay: 250 * time.Millisecond, RenewalRedirectUrl: firstAllowedReturnUrl(settings), CheckoutTitle: "Zudomart",
	})
}

func firstAllowedReturnUrl(settings configs.PaymentsSettings) string {
	if len(settings.AllowedReturnUrls) > 0 {
		return settings.AllowedReturnUrls[0]
	}
	return constants.AppPaymentReturnUrl
}

func (container *Container) DefaultWallets() (interfaces.WalletProvider, error) {
	return container.Wallets(container.Settings.DefaultProvider)
}

func (container *Container) UsesProviderWallets() bool {
	_, err := container.DefaultWallets()
	return err == nil
}

func capabilityOf[Capability any](container *Container, name string) (Capability, error) {
	var missing Capability
	provider, err := container.Provider(name)
	if err != nil {
		return missing, err
	}
	capable, supported := provider.(Capability)
	if !supported {
		return missing, ErrProviderCapabilityMissing
	}
	return capable, nil
}

func (container *Container) Payouts(name string) (interfaces.PayoutProvider, error) {
	return capabilityOf[interfaces.PayoutProvider](container, name)
}

func (container *Container) Identity(name string) (interfaces.IdentityVerifier, error) {
	return capabilityOf[interfaces.IdentityVerifier](container, name)
}

func (container *Container) Wallets(name string) (interfaces.WalletProvider, error) {
	return capabilityOf[interfaces.WalletProvider](container, name)
}

func (container *Container) Payees(name string) (interfaces.PayeeProvider, error) {
	return capabilityOf[interfaces.PayeeProvider](container, name)
}

func (container *Container) Disputes(name string) (interfaces.DisputeProvider, error) {
	return capabilityOf[interfaces.DisputeProvider](container, name)
}

func (container *Container) Subscriptions(name string) (interfaces.SubscriptionProvider, error) {
	return capabilityOf[interfaces.SubscriptionProvider](container, name)
}

func (container *Container) SavedCards(name string) (interfaces.SavedCardProvider, error) {
	return capabilityOf[interfaces.SavedCardProvider](container, name)
}

func (container *Container) RefundBankDetails(name string) (interfaces.RefundBankDetailsProvider, error) {
	return capabilityOf[interfaces.RefundBankDetailsProvider](container, name)
}

func (container *Container) DefaultPayouts() (interfaces.PayoutProvider, error) {
	return container.Payouts(container.Settings.DefaultProvider)
}

func (container *Container) DefaultIdentity() (interfaces.IdentityVerifier, error) {
	return container.Identity(container.Settings.DefaultProvider)
}

func (container *Container) DefaultPayees() (interfaces.PayeeProvider, error) {
	return container.Payees(container.Settings.DefaultProvider)
}

func (container *Container) DefaultDisputes() (interfaces.DisputeProvider, error) {
	return container.Disputes(container.Settings.DefaultProvider)
}

func (container *Container) DefaultSubscriptions() (interfaces.SubscriptionProvider, error) {
	return container.Subscriptions(container.Settings.DefaultProvider)
}
