package container

import (
	"context"
	"time"

	"zudomart/modules/ledger/src/databases"
	ledgerevents "zudomart/modules/ledger/src/events"
	"zudomart/modules/ledger/src/loaders"
	ledgerservices "zudomart/modules/ledger/src/modules/journal/services"
	sellerbalances "zudomart/modules/ledger/src/modules/sellerBalances/services"
	ledgerrepositories "zudomart/modules/ledger/src/repositories"
	ledgerutils "zudomart/modules/ledger/src/utils"
	paymentservices "zudomart/modules/payments/src/modules/gateway/services"
	"zudomart/modules/wallet/src/configs"
	"zudomart/modules/wallet/src/generated/ent"
	_ "zudomart/modules/wallet/src/generated/ent/runtime"
	"zudomart/modules/wallet/src/integrations"
	"zudomart/modules/wallet/src/interfaces"
	"zudomart/modules/wallet/src/repositories"
	"zudomart/modules/wallet/src/utils"
	"zudomart/platform/staffaudit"
)

type Container struct {
	Resources    loaders.MoneyModuleResources
	Settings     configs.WalletSettings
	Ledger       *ledgerservices.Ledger
	Payments     *paymentservices.PaymentGateway
	Sellers      sellerbalances.SellerBalances
	Outbox       ledgerevents.OutboxTable
	Idempotency  ledgerutils.SqlIdempotencyRecordStore
	Encryptor    utils.FieldEncryptor
	Currency     interfaces.ViewerCurrencyResolver
	Settlement   interfaces.SellerSettlementAdapter
	Audit        staffaudit.Recorder
	Parties      ledgerrepositories.PartyDirectory
	Blocks       repositories.SocialBlocks
	Now          func() time.Time
	schemaConfig ent.SchemaConfig
}

func NewWalletContainer(resources loaders.MoneyModuleResources, settings configs.WalletSettings, payments *paymentservices.PaymentGateway) (*Container, error) {
	encryptor, err := utils.NewFieldEncryptor(settings.DataEncryptionKey)
	if err != nil {
		return nil, err
	}
	schema := settings.Money.DatabaseSchema
	var audit staffaudit.Recorder
	if settings.AdminInternalUrl != "" {
		audit = staffaudit.NewHttpRecorder(settings.AdminInternalUrl, settings.AdminInternalToken)
	}
	return &Container{
		Audit:     audit,
		Resources: resources, Settings: settings, Payments: payments, Encryptor: encryptor,
		Ledger:      ledgerservices.NewLedgerInSchema(settings.Money.LedgerSchema),
		Sellers:     sellerbalances.NewSellerBalancesInSchema(settings.Money.LedgerSchema),
		Outbox:      ledgerevents.OutboxTable{Schema: schema, Source: "zudomart.wallet"},
		Idempotency: ledgerutils.SqlIdempotencyRecordStore{Schema: schema},
		Currency: utils.RegionHeaderCurrencyResolver{
			DefaultCurrency: settings.DefaultCurrency, TrustedCountryHeader: settings.TrustedCountryHeader, AccessVerifier: resources.AccessVerifier,
			ProfileCountry: utils.ProfileCountryFromUsersSchema(resources.Database, settings.UsersSchema),
		},
		Settlement: selectSellerSettlementAdapter(settings.SellerSettlementAdapter, payments),
		Parties:    ledgerrepositories.PartyDirectory{Database: resources.Database, AccountSchema: settings.Money.AccountSchema, CatalogSchema: settings.Money.CatalogSchema, Logger: resources.Logger},
		Blocks:     repositories.SocialBlocks{Database: resources.Database, SocialSchema: settings.SocialSchema},
		Now:        time.Now,
		schemaConfig: ent.SchemaConfig{
			CoinConversion: schema, CoinPackage: schema, CoinPurchase: schema, CoinTransfer: schema, IdempotentRequest: schema,
			AdBalanceTopUp: schema, AdBalanceEarningsTransfer: schema, AdSpendDebit: schema, MonetisationHold: schema, OutboxEvent: schema, PayoutAccount: schema, PayoutAccountResolution: schema, SellerPayoutSchedule: schema, SellerReserveFlag: schema, WalletRiskFlag: schema, Withdrawal: schema,
		},
	}, nil
}

func (container *Container) CoinTransferFeeBps(ctx context.Context) int64 {
	return container.Resources.Platform.CoinTransferFeeBps(ctx, container.Settings.CoinTransferFeeBps)
}

func (container *Container) CoinCashValuesMinor(ctx context.Context) map[string]int64 {
	return container.Resources.Platform.CoinCashValuesMinor(ctx, container.Settings.CoinCashValueMinorByCurrency)
}

func (container *Container) Client(executor databases.ExecutorQuerier) *ent.Client {
	return ent.NewClient(ent.Driver(databases.EntDriverForExecutor(executor)), ent.AlternateSchema(container.schemaConfig))
}

func selectSellerSettlementAdapter(name string, payments *paymentservices.PaymentGateway) interfaces.SellerSettlementAdapter {
	switch name {
	default:
		return integrations.ProviderTransferSettlement{Payments: payments}
	}
}
