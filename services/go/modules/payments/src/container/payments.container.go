package container

import (
	"net/http"
	"time"

	"zudomart/modules/ledger/src/databases"
	ledgerevents "zudomart/modules/ledger/src/events"
	"zudomart/modules/ledger/src/loaders"
	ledgerservices "zudomart/modules/ledger/src/modules/journal/services"
	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/payments/src/configs"
	"zudomart/modules/payments/src/constants"
	"zudomart/modules/payments/src/generated/ent"
	_ "zudomart/modules/payments/src/generated/ent/runtime"
	"zudomart/modules/payments/src/integrations"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/platform/httpserver"
)

type Container struct {
	Resources      loaders.MoneyModuleResources
	Settings       configs.PaymentsSettings
	Providers      map[string]interfaces.PaymentProvider
	StoreVerifiers map[string]interfaces.StoreReceiptVerifier
	Ledger         *ledgerservices.Ledger
	Outbox         ledgerevents.OutboxTable
	Idempotency    ledgerutils.SqlIdempotencyRecordStore
	Now            func() time.Time
	schemaConfig   ent.SchemaConfig
}

type Overrides struct {
	Providers      map[string]interfaces.PaymentProvider
	StoreVerifiers map[string]interfaces.StoreReceiptVerifier
}

func NewPaymentsContainer(resources loaders.MoneyModuleResources, settings configs.PaymentsSettings, overrides Overrides) *Container {
	schema := settings.Money.DatabaseSchema
	providers := overrides.Providers
	if providers == nil {
		providers = map[string]interfaces.PaymentProvider{
			constants.ProviderPaystack:    integrations.NewPaystackProvider(settings.PaystackBaseUrl, settings.PaystackSecretKey, settings.TransferFeeOverrides),
			constants.ProviderFlutterwave: integrations.NewFlutterwaveProvider(settings.FlutterwaveBaseUrl, settings.FlutterwaveSecretKey, settings.FlutterwaveWebhookHash, settings.TransferFeeOverrides),
		}
	}
	storeVerifiers := overrides.StoreVerifiers
	if storeVerifiers == nil {
		storeVerifiers = map[string]interfaces.StoreReceiptVerifier{
			constants.StoreAppleIap:   integrations.NewAppleInAppPurchaseVerifier(settings.AppleInAppPurchaseEnabled, settings.AppleInAppPurchaseFeeBps),
			constants.StoreGooglePlay: integrations.NewGooglePlayBillingVerifier(settings.GooglePlayBillingEnabled, settings.GooglePlayBillingFeeBps),
		}
	}
	return &Container{
		Resources: resources, Settings: settings, Providers: providers, StoreVerifiers: storeVerifiers,
		Ledger:      ledgerservices.NewLedgerInSchema(settings.Money.LedgerSchema),
		Outbox:      ledgerevents.OutboxTable{Schema: schema, Source: "zudomart.payments"},
		Idempotency: ledgerutils.SqlIdempotencyRecordStore{Schema: schema},
		Now:         time.Now,
		schemaConfig: ent.SchemaConfig{
			IdempotentRequest: schema, OrderPayable: schema, OutboxEvent: schema, PaymentIntent: schema,
			PaymentRefund: schema, PayoutTransfer: schema, StorePurchase: schema, WebhookEvent: schema,
		},
	}
}

func (container *Container) Client(executor databases.ExecutorQuerier) *ent.Client {
	return ent.NewClient(ent.Driver(databases.EntDriverForExecutor(executor)), ent.AlternateSchema(container.schemaConfig))
}

func (container *Container) Provider(name string) (interfaces.PaymentProvider, error) {
	provider, found := container.Providers[name]
	if !found {
		return nil, httpserver.NewApiError(http.StatusUnprocessableEntity, "PAYMENT_PROVIDER_NOT_SUPPORTED", "This payment provider is not supported.")
	}
	return provider, nil
}

func (container *Container) StoreVerifier(name string) (interfaces.StoreReceiptVerifier, error) {
	verifier, found := container.StoreVerifiers[name]
	if !found {
		return nil, httpserver.NewApiError(http.StatusUnprocessableEntity, "STORE_NOT_SUPPORTED", "This app store is not supported.")
	}
	return verifier, nil
}
