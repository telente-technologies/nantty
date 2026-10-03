package container

import (
	"time"

	"zudomart/modules/ledger/src/databases"
	ledgerevents "zudomart/modules/ledger/src/events"
	"zudomart/modules/ledger/src/loaders"
	ledgerservices "zudomart/modules/ledger/src/modules/journal/services"
	sellerbalances "zudomart/modules/ledger/src/modules/sellerBalances/services"
	ledgerutils "zudomart/modules/ledger/src/utils"
	paymentservices "zudomart/modules/payments/src/modules/gateway/services"
	"zudomart/modules/wallet/src/configs"
	"zudomart/modules/wallet/src/generated/ent"
	_ "zudomart/modules/wallet/src/generated/ent/runtime"
	"zudomart/modules/wallet/src/integrations"
	"zudomart/modules/wallet/src/interfaces"
	"zudomart/modules/wallet/src/utils"
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
	Now          func() time.Time
	schemaConfig ent.SchemaConfig
}

func NewWalletContainer(resources loaders.MoneyModuleResources, settings configs.WalletSettings, payments *paymentservices.PaymentGateway) (*Container, error) {
	encryptor, err := utils.NewFieldEncryptor(settings.DataEncryptionKey)
	if err != nil {
		return nil, err
	}
	schema := settings.Money.DatabaseSchema
	return &Container{
		Resources: resources, Settings: settings, Payments: payments, Encryptor: encryptor,
		Ledger:      ledgerservices.NewLedgerInSchema(settings.Money.LedgerSchema),
		Sellers:     sellerbalances.NewSellerBalancesInSchema(settings.Money.LedgerSchema),
		Outbox:      ledgerevents.OutboxTable{Schema: schema, Source: "zudomart.wallet"},
		Idempotency: ledgerutils.SqlIdempotencyRecordStore{Schema: schema},
		Currency:    utils.RegionHeaderCurrencyResolver{DefaultCurrency: settings.DefaultCurrency},
		Settlement:  selectSellerSettlementAdapter(settings.SellerSettlementAdapter, payments),
		Now:         time.Now,
		schemaConfig: ent.SchemaConfig{
			CoinConversion: schema, CoinPackage: schema, CoinPurchase: schema, CoinTransfer: schema, IdempotentRequest: schema,
			AdBalanceTopUp: schema, AdSpendDebit: schema, OutboxEvent: schema, PayoutAccount: schema, SellerReserveFlag: schema, WalletRiskFlag: schema, Withdrawal: schema,
		},
	}, nil
}

func (container *Container) Client(executor databases.ExecutorQuerier) *ent.Client {
	return ent.NewClient(ent.Driver(databases.EntDriverForExecutor(executor)), ent.AlternateSchema(container.schemaConfig))
}

func selectSellerSettlementAdapter(name string, payments *paymentservices.PaymentGateway) interfaces.SellerSettlementAdapter {
	switch name {
	default:
		return integrations.PaystackTransferSettlement{Payments: payments}
	}
}
