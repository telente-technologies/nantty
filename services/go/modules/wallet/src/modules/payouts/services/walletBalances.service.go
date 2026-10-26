package services

import (
	"context"
	"time"

	escrowent "nantty/modules/escrow/src/generated/ent"
	"nantty/modules/escrow/src/generated/ent/escrow"
	"nantty/modules/ledger/src/databases"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/wallet/src/container"
)

type UserWalletBalances struct {
	AvailableMinor       int64
	DepositHoldMinor     int64
	ReservedPayoutMinor  int64
	WalletDebtMinor      int64
	SellerDebtMinor      int64
	CreatorDebtMinor     int64
	CreatorEarningsMinor int64
	InEscrowMinor        int64
	NextAvailableAt      *time.Time
}

func (balances UserWalletBalances) DebtsMinor() int64 {
	return max(balances.WalletDebtMinor, 0) + max(balances.SellerDebtMinor, 0) + max(balances.CreatorDebtMinor, 0)
}

func (balances UserWalletBalances) WithdrawableMinor() int64 {
	return max(balances.AvailableMinor-balances.DebtsMinor(), 0)
}

func ReadUserWalletBalances(ctx context.Context, deployed *container.Container, executor databases.ExecutorQuerier, userId, currency string) (UserWalletBalances, error) {
	accounts := []ledgermodels.AccountRef{
		ledgermodels.WalletAvailableAccount(userId, currency), ledgermodels.WalletDepositHoldAccount(userId, currency), ledgermodels.WalletReservedPayoutAccount(userId, currency),
		ledgermodels.WalletDebtAccount(userId, currency), ledgermodels.SellerDebtAccount(userId, currency), ledgermodels.CreatorEarningsDebtAccount(userId, currency),
		ledgermodels.CreatorEarningsPayableAccount(userId, currency),
	}
	values, err := deployed.Ledger.ReadAccountBalances(ctx, executor, accounts)
	if err != nil {
		return UserWalletBalances{}, err
	}
	balances := UserWalletBalances{
		AvailableMinor: values[accounts[0].Key()], DepositHoldMinor: values[accounts[1].Key()], ReservedPayoutMinor: values[accounts[2].Key()],
		WalletDebtMinor: values[accounts[3].Key()], SellerDebtMinor: values[accounts[4].Key()], CreatorDebtMinor: values[accounts[5].Key()],
		CreatorEarningsMinor: values[accounts[6].Key()],
	}
	if balances.InEscrowMinor, err = readSellerEscrowPendingMinor(ctx, deployed, executor, userId, currency); err != nil {
		return UserWalletBalances{}, err
	}
	if deployed.Payments != nil {
		if balances.NextAvailableAt, err = deployed.Payments.NextWalletHoldReleaseAt(ctx, userId, currency); err != nil {
			return UserWalletBalances{}, err
		}
	}
	return balances, nil
}

func readSellerEscrowPendingMinor(ctx context.Context, deployed *container.Container, executor databases.ExecutorQuerier, sellerUserId, currency string) (int64, error) {
	schema := deployed.Settings.EscrowSchema
	if schema == "" {
		return 0, nil
	}
	client := escrowent.NewClient(escrowent.Driver(databases.EntDriverForExecutor(executor)), escrowent.AlternateSchema(escrowent.SchemaConfig{Escrow: schema}))
	var sums []struct {
		Sum *int64 `json:"sum"`
	}
	err := client.Escrow.Query().Where(escrow.SellerUserID(sellerUserId), escrow.Currency(currency), escrow.PaymentModeEQ(escrow.PaymentModeEscrow), escrow.StatusIn(escrow.StatusHeld, escrow.StatusDisputed)).
		Aggregate(escrowent.Sum(escrow.FieldSellerAmountMinor)).Scan(ctx, &sums)
	if err != nil || len(sums) == 0 || sums[0].Sum == nil {
		return 0, err
	}
	return *sums[0].Sum, nil
}
