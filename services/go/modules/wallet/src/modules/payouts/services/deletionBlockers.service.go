package services

import (
	"context"

	"zudomart/modules/wallet/src/generated/ent/withdrawal"
)

var settledCurrencies = []string{"NGN", "GHS", "KES", "ZAR", "GBP", "EUR", "USD"}

type DeletionBlockers struct {
	PendingWithdrawals int                  `json:"pendingWithdrawals"`
	NonZeroBalances    []NonZeroBalanceLine `json:"nonZeroBalances"`
	CanDelete          bool                 `json:"canDelete"`
}

type NonZeroBalanceLine struct {
	Currency string `json:"currency"`
	Kind     string `json:"kind"`
	Amount   int64  `json:"amountMinor"`
}

func (overview WalletOverview) ReadDeletionBlockers(ctx context.Context, userId string) (DeletionBlockers, error) {
	pending, err := overview.Container.Client(overview.Container.Resources.Database).Withdrawal.Query().
		Where(withdrawal.UserID(userId), withdrawal.StatusIn(withdrawal.StatusPendingReview, withdrawal.StatusQueued, withdrawal.StatusProcessing)).Count(ctx)
	if err != nil {
		return DeletionBlockers{}, err
	}
	result := DeletionBlockers{PendingWithdrawals: pending, NonZeroBalances: []NonZeroBalanceLine{}}
	for _, currency := range settledCurrencies {
		summary, err := overview.ReadWalletSummary(ctx, userId, currency)
		if err != nil {
			return result, err
		}
		for kind, amount := range map[string]int64{"available": summary.Available.AmountMinor, "pending": summary.Pending.AmountMinor, "payoutRequested": summary.PayoutRequested.AmountMinor, "debt": summary.NegativeBalance.AmountMinor} {
			if amount != 0 {
				result.NonZeroBalances = append(result.NonZeroBalances, NonZeroBalanceLine{Currency: currency, Kind: kind, Amount: amount})
			}
		}
	}
	result.CanDelete = pending == 0 && len(result.NonZeroBalances) == 0
	return result, nil
}
