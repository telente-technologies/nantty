package container

import (
	"fmt"
	"net/http"
	"time"

	"nantty/modules/ledger/src/databases"
	ledgerevents "nantty/modules/ledger/src/events"
	"nantty/modules/ledger/src/loaders"
	ledgerservices "nantty/modules/ledger/src/modules/journal/services"
	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/modules/payments/src/configs"
	"nantty/modules/payments/src/constants"
	"nantty/modules/payments/src/generated/ent"
	_ "nantty/modules/payments/src/generated/ent/runtime"
	"nantty/modules/payments/src/interfaces"
	"nantty/modules/payments/src/repositories"
	"nantty/modules/payments/src/utils"
	"nantty/platform/httpserver"
	"nantty/platform/staffaudit"
)

type Container struct {
	Resources      loaders.MoneyModuleResources
	Settings       configs.PaymentsSettings
	Providers      map[string]interfaces.PaymentProvider
	StoreVerifiers map[string]interfaces.StoreReceiptVerifier
	Accounts       repositories.VerifiedAccountDirectory
	CardHandoffs   utils.SavedCardHandoffStore
	OrderStatuses  repositories.OrderStatusDirectory
	Documents      interfaces.DocumentVerificationProvider
	Audit          staffaudit.Recorder
	Ledger         *ledgerservices.Ledger
	Outbox         ledgerevents.OutboxTable
	Idempotency    ledgerutils.SqlIdempotencyRecordStore
	Now            func() time.Time
	schemaConfig   ent.SchemaConfig
}

type Overrides struct {
	Providers      map[string]interfaces.PaymentProvider
	StoreVerifiers map[string]interfaces.StoreReceiptVerifier
	Accounts       repositories.VerifiedAccountDirectory
	CardHandoffs   utils.SavedCardHandoffStore
	OrderStatuses  repositories.OrderStatusDirectory
	Documents      interfaces.DocumentVerificationProvider
	Audit          staffaudit.Recorder
}

func NewPaymentsContainer(resources loaders.MoneyModuleResources, settings configs.PaymentsSettings, overrides Overrides) (*Container, error) {
	schema := settings.Money.DatabaseSchema
	if settings.DefaultProvider == "" {
		settings.DefaultProvider = constants.ProviderFlutterwave
	}
	providers := overrides.Providers
	if providers == nil {
		var err error
		if providers, err = NewProvidersFromSettings(settings); err != nil {
			return nil, err
		}
	}
	if _, registered := providers[settings.DefaultProvider]; !registered {
		return nil, fmt.Errorf("PAYMENTS_PROVIDER=%s has no registered adapter", settings.DefaultProvider)
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
	return &Container{
		Resources: resources, Settings: settings, Providers: providers, StoreVerifiers: storeVerifiers, Accounts: accounts, CardHandoffs: cardHandoffs, OrderStatuses: orderStatuses,
		Documents: overrides.Documents, Audit: auditRecorder(settings, overrides.Audit),
		Ledger:      ledgerservices.NewLedgerInSchema(settings.Money.LedgerSchema),
		Outbox:      ledgerevents.OutboxTable{Schema: schema, Source: "zudomart.payments"},
		Idempotency: ledgerutils.SqlIdempotencyRecordStore{Schema: schema},
		Now:         time.Now,
		schemaConfig: ent.SchemaConfig{
			BillingAuthorization: schema, BillingSubscription: schema, ConnectedAccount: schema, IdempotentRequest: schema, OrderPayable: schema, OutboxEvent: schema,
			PaymentIntent: schema, PaymentRefund: schema, PayoutOnboarding: schema, PayoutTransfer: schema, ConnectedAccountJob: schema, ProviderCustomer: schema, ProviderDispute: schema, ProviderPayoutDestination: schema, SavedCardSetup: schema, SellerVerification: schema, CustomerValidation: schema, VerificationLevelRecord: schema,
			StorePurchase: schema, WebhookEvent: schema, ProviderWallet: schema, ProviderWalletNumber: schema, WalletFunding: schema, ProviderMovement: schema,
			ReconciliationRun: schema, ReconciliationCase: schema,
		},
	}, nil
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

func (container *Container) DefaultProvider() (interfaces.PaymentProvider, error) {
	return container.Provider(container.Settings.DefaultProvider)
}

func (container *Container) StoreVerifier(name string) (interfaces.StoreReceiptVerifier, error) {
	verifier, found := container.StoreVerifiers[name]
	if !found {
		return nil, httpserver.NewApiError(http.StatusUnprocessableEntity, "STORE_NOT_SUPPORTED", "This app store is not supported.")
	}
	return verifier, nil
}

func auditRecorder(settings configs.PaymentsSettings, override staffaudit.Recorder) staffaudit.Recorder {
	if override != nil {
		return override
	}
	if settings.AdminInternalUrl == "" {
		return nil
	}
	return staffaudit.NewHttpRecorder(settings.AdminInternalUrl, settings.AdminInternalToken)
}
