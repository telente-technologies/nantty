package container

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"nantty/modules/ledger/src/databases"
	ledgerevents "nantty/modules/ledger/src/events"
	"nantty/modules/ledger/src/loaders"
	ledgerservices "nantty/modules/ledger/src/modules/journal/services"
	ledgerrepositories "nantty/modules/ledger/src/repositories"
	ledgerutils "nantty/modules/ledger/src/utils"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
	"nantty/modules/wallet/src/configs"
	"nantty/modules/wallet/src/generated/ent"
	_ "nantty/modules/wallet/src/generated/ent/runtime"
	"nantty/modules/wallet/src/integrations"
	"nantty/modules/wallet/src/interfaces"
	"nantty/modules/wallet/src/repositories"
	"nantty/modules/wallet/src/utils"
	"nantty/platform/staffaudit"
)

type Container struct {
	Resources    loaders.MoneyModuleResources
	Settings     configs.WalletSettings
	Ledger       *ledgerservices.Ledger
	Payments     *paymentservices.PaymentGateway
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
		Outbox:      ledgerevents.OutboxTable{Schema: schema, Source: "nantty.wallet"},
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
			CoinConversion: schema, CoinPackage: schema, CoinPurchase: schema, CoinPurchaseChargeback: schema, CoinTransfer: schema, IdempotentRequest: schema,
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

func (container *Container) IsApprovedCreator(ctx context.Context, executor databases.ExecutorQuerier, userId string) (bool, error) {
	schema := pgx.Identifier{container.Settings.CreatorProgramSchema, "creator_program_members"}.Sanitize()
	rows, err := executor.QueryContext(ctx, "SELECT EXISTS (SELECT 1 FROM "+schema+" WHERE user_id = $1 AND status = 'approved' AND suspended_at IS NULL)", userId)
	if err != nil {
		return false, err
	}
	defer rows.Close()
	if !rows.Next() {
		return false, rows.Err()
	}
	var approved bool
	if err := rows.Scan(&approved); err != nil {
		return false, err
	}
	return approved, rows.Err()
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
