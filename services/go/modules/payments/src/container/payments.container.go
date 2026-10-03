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
	"zudomart/modules/payments/src/utils"
	"zudomart/platform/httpserver"
)

type Container struct {
	Resources      loaders.MoneyModuleResources
	Settings       configs.PaymentsSettings
	Providers      map[string]interfaces.ConnectProvider
	StoreVerifiers map[string]interfaces.StoreReceiptVerifier
	Accounts       repositories.VerifiedAccountDirectory
	CardHandoffs   utils.SavedCardHandoffStore
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
	CardHandoffs   utils.SavedCardHandoffStore
}

func NewBachsProviderFromSettings(settings configs.PaymentsSettings) *integrations.BachsConnectProvider {
	return integrations.NewBachsConnectProvider(integrations.BachsConnectSettings{
		BaseUrl: settings.BachsBaseUrl, SecretKey: settings.BachsSecretKey, WebhookSigningSecrets: settings.BachsWebhookSigningSecrets,
		PayoutFeeMinorByCurrency: settings.BachsPayoutFeeOverrides, PayoutFeeRules: integrations.ParsePayoutFeeRules(settings.BachsPayoutFeeSchedule), MaximumAttempts: settings.BachsMaximumAttempts, RetryBaseDelay: 250 * time.Millisecond,
	})
}

func NewPaymentsContainer(resources loaders.MoneyModuleResources, settings configs.PaymentsSettings, overrides Overrides) (*Container, error) {
	schema := settings.Money.DatabaseSchema
	providers := overrides.Providers
	if providers == nil {
		providers = map[string]interfaces.ConnectProvider{constants.ProviderBachs: NewBachsProviderFromSettings(settings)}
	}
	storeVerifiers := overrides.StoreVerifiers
	if storeVerifiers == nil {
		var err error
		if storeVerifiers, err = NewStoreVerifiersFromSettings(settings); err != nil {
			return nil, err
		}
	}
	accounts := overrides.Accounts
	if accounts == nil {
		accounts = repositories.SqlVerifiedAccountDirectory{Database: resources.Database, AuthSchema: settings.AccountDirectorySchema}
	}
	cardHandoffs := overrides.CardHandoffs
	if cardHandoffs == nil {
		cardHandoffs = utils.NewMemorySavedCardHandoffStore(15 * time.Minute)
	}
	if settings.DefaultProvider == "" {
		settings.DefaultProvider = constants.ProviderBachs
	}
	return &Container{
		Resources: resources, Settings: settings, Providers: providers, StoreVerifiers: storeVerifiers, Accounts: accounts, CardHandoffs: cardHandoffs,
		Ledger:      ledgerservices.NewLedgerInSchema(settings.Money.LedgerSchema),
		Outbox:      ledgerevents.OutboxTable{Schema: schema, Source: "zudomart.payments"},
		Idempotency: ledgerutils.SqlIdempotencyRecordStore{Schema: schema},
		Now:         time.Now,
		schemaConfig: ent.SchemaConfig{
			BillingSubscription: schema, ConnectedAccount: schema, IdempotentRequest: schema, OrderPayable: schema, OutboxEvent: schema,
			PaymentIntent: schema, PaymentRefund: schema, PayoutTransfer: schema, ProviderCustomer: schema, ProviderDispute: schema, ProviderPayoutDestination: schema, SavedCardSetup: schema,
			StorePurchase: schema, WebhookEvent: schema,
		},
	}, nil
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
