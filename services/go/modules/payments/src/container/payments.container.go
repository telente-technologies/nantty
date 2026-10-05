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
	Providers      map[string]interfaces.FullPaymentProvider
	StoreVerifiers map[string]interfaces.StoreReceiptVerifier
	Accounts       repositories.VerifiedAccountDirectory
	CardHandoffs   utils.SavedCardHandoffStore
	OrderStatuses  repositories.OrderStatusDirectory
	Ledger         *ledgerservices.Ledger
	Outbox         ledgerevents.OutboxTable
	Idempotency    ledgerutils.SqlIdempotencyRecordStore
	Now            func() time.Time
	schemaConfig   ent.SchemaConfig
}

type Overrides struct {
	Providers      map[string]interfaces.FullPaymentProvider
	StoreVerifiers map[string]interfaces.StoreReceiptVerifier
	Accounts       repositories.VerifiedAccountDirectory
	CardHandoffs   utils.SavedCardHandoffStore
	OrderStatuses  repositories.OrderStatusDirectory
}

func NewPaystackProviderFromSettings(settings configs.PaymentsSettings) *integrations.PaystackProvider {
	paystack := settings.Paystack
	return integrations.NewPaystackProvider(integrations.PaystackSettings{
		BaseUrl: paystack.BaseUrl, SecretKey: paystack.SecretKey, PreviousSecretKey: paystack.PreviousSecretKey, Channels: paystack.Channels,
		TransferFeeBands: integrations.ParseTransferFeeBands(paystack.TransferFeeBands), MaximumAttempts: paystack.MaximumAttempts, RetryBaseDelay: 250 * time.Millisecond,
		SupportedCurrencies: paystack.SupportedCurrencies,
	})
}

func NewPaymentsContainer(resources loaders.MoneyModuleResources, settings configs.PaymentsSettings, overrides Overrides) (*Container, error) {
	schema := settings.Money.DatabaseSchema
	providers := overrides.Providers
	if providers == nil {
		providers = map[string]interfaces.FullPaymentProvider{constants.ProviderPaystack: NewPaystackProviderFromSettings(settings)}
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
	orderStatuses := overrides.OrderStatuses
	if orderStatuses == nil {
		orderStatuses = repositories.SqlOrderStatusDirectory{Database: resources.Database, OrdersSchema: settings.OrderStatusSchema}
	}
	cardHandoffs := overrides.CardHandoffs
	if cardHandoffs == nil {
		cardHandoffs = utils.NewMemorySavedCardHandoffStore(15 * time.Minute)
	}
	if settings.DefaultProvider == "" {
		settings.DefaultProvider = constants.ProviderPaystack
	}
	return &Container{
		Resources: resources, Settings: settings, Providers: providers, StoreVerifiers: storeVerifiers, Accounts: accounts, CardHandoffs: cardHandoffs, OrderStatuses: orderStatuses,
		Ledger:      ledgerservices.NewLedgerInSchema(settings.Money.LedgerSchema),
		Outbox:      ledgerevents.OutboxTable{Schema: schema, Source: "zudomart.payments"},
		Idempotency: ledgerutils.SqlIdempotencyRecordStore{Schema: schema},
		Now:         time.Now,
		schemaConfig: ent.SchemaConfig{
			BillingAuthorization: schema, BillingSubscription: schema, ConnectedAccount: schema, IdempotentRequest: schema, OrderPayable: schema, OutboxEvent: schema,
			PaymentIntent: schema, PaymentRefund: schema, PayoutOnboarding: schema, PayoutTransfer: schema, ConnectedAccountJob: schema, ProviderCustomer: schema, ProviderDispute: schema, ProviderPayoutDestination: schema, SavedCardSetup: schema,
			StorePurchase: schema, WebhookEvent: schema,
		},
	}, nil
}

func (container *Container) Client(executor databases.ExecutorQuerier) *ent.Client {
	return ent.NewClient(ent.Driver(databases.EntDriverForExecutor(executor)), ent.AlternateSchema(container.schemaConfig))
}

func (container *Container) Provider(name string) (interfaces.FullPaymentProvider, error) {
	provider, found := container.Providers[name]
	if !found {
		return nil, httpserver.NewApiError(http.StatusUnprocessableEntity, "PAYMENT_PROVIDER_NOT_SUPPORTED", "This payment provider is not supported.")
	}
	return provider, nil
}

func (container *Container) DefaultProvider() (interfaces.FullPaymentProvider, error) {
	return container.Provider(container.Settings.DefaultProvider)
}

func (container *Container) StoreVerifier(name string) (interfaces.StoreReceiptVerifier, error) {
	verifier, found := container.StoreVerifiers[name]
	if !found {
		return nil, httpserver.NewApiError(http.StatusUnprocessableEntity, "STORE_NOT_SUPPORTED", "This app store is not supported.")
	}
	return verifier, nil
}
