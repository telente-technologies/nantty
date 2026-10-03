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
	"zudomart/modules/payments/src/repositories"
	"zudomart/platform/httpserver"
)

type Container struct {
	Resources      loaders.MoneyModuleResources
	Settings       configs.PaymentsSettings
	Providers      map[string]interfaces.ConnectProvider
	StoreVerifiers map[string]interfaces.StoreReceiptVerifier
	Accounts       repositories.VerifiedAccountDirectory
	Ledger         *ledgerservices.Ledger
	Outbox         ledgerevents.OutboxTable
	Idempotency    ledgerutils.SqlIdempotencyRecordStore
	Now            func() time.Time
	schemaConfig   ent.SchemaConfig
}

type Overrides struct {
	Providers      map[string]interfaces.ConnectProvider
	StoreVerifiers map[string]interfaces.StoreReceiptVerifier
	Accounts       repositories.VerifiedAccountDirectory
}

func NewBachsProviderFromSettings(settings configs.PaymentsSettings) *integrations.BachsConnectProvider {
	return integrations.NewBachsConnectProvider(integrations.BachsConnectSettings{
		BaseUrl: settings.BachsBaseUrl, SecretKey: settings.BachsSecretKey, WebhookSigningSecrets: settings.BachsWebhookSigningSecrets,
		PayoutFeeMinorByCurrency: settings.BachsPayoutFeeOverrides, MaximumAttempts: settings.BachsMaximumAttempts, RetryBaseDelay: 250 * time.Millisecond,
	})
}

func NewPaymentsContainer(resources loaders.MoneyModuleResources, settings configs.PaymentsSettings, overrides Overrides) *Container {
	schema := settings.Money.DatabaseSchema
	providers := overrides.Providers
	if providers == nil {
		providers = map[string]interfaces.ConnectProvider{constants.ProviderBachs: NewBachsProviderFromSettings(settings)}
	}
	storeVerifiers := overrides.StoreVerifiers
	if storeVerifiers == nil {
		storeVerifiers = map[string]interfaces.StoreReceiptVerifier{
			constants.StoreAppleIap:   integrations.NewAppleInAppPurchaseVerifier(settings.AppleInAppPurchaseEnabled, settings.AppleInAppPurchaseFeeBps),
			constants.StoreGooglePlay: integrations.NewGooglePlayBillingVerifier(settings.GooglePlayBillingEnabled, settings.GooglePlayBillingFeeBps),
		}
	}
	accounts := overrides.Accounts
	if accounts == nil {
		accounts = repositories.SqlVerifiedAccountDirectory{Database: resources.Database, AuthSchema: settings.AccountDirectorySchema}
	}
	if settings.DefaultProvider == "" {
		settings.DefaultProvider = constants.ProviderBachs
	}
	return &Container{
		Resources: resources, Settings: settings, Providers: providers, StoreVerifiers: storeVerifiers, Accounts: accounts,
		Ledger:      ledgerservices.NewLedgerInSchema(settings.Money.LedgerSchema),
		Outbox:      ledgerevents.OutboxTable{Schema: schema, Source: "zudomart.payments"},
		Idempotency: ledgerutils.SqlIdempotencyRecordStore{Schema: schema},
		Now:         time.Now,
		schemaConfig: ent.SchemaConfig{
			BillingSubscription: schema, ConnectedAccount: schema, IdempotentRequest: schema, OrderPayable: schema, OutboxEvent: schema,
			PaymentIntent: schema, PaymentRefund: schema, PayoutTransfer: schema, ProviderDispute: schema, ProviderPayoutDestination: schema,
			StorePurchase: schema, WebhookEvent: schema,
		},
	}
}

func (container *Container) Client(executor databases.ExecutorQuerier) *ent.Client {
	return ent.NewClient(ent.Driver(databases.EntDriverForExecutor(executor)), ent.AlternateSchema(container.schemaConfig))
}

func (container *Container) Provider(name string) (interfaces.ConnectProvider, error) {
	provider, found := container.Providers[name]
	if !found {
		return nil, httpserver.NewApiError(http.StatusUnprocessableEntity, "PAYMENT_PROVIDER_NOT_SUPPORTED", "This payment provider is not supported.")
	}
	return provider, nil
}

func (container *Container) DefaultProvider() (interfaces.ConnectProvider, error) {
	return container.Provider(container.Settings.DefaultProvider)
}

func (container *Container) StoreVerifier(name string) (interfaces.StoreReceiptVerifier, error) {
	verifier, found := container.StoreVerifiers[name]
	if !found {
		return nil, httpserver.NewApiError(http.StatusUnprocessableEntity, "STORE_NOT_SUPPORTED", "This app store is not supported.")
	}
	return verifier, nil
}
