package services

import (
	"context"
	"database/sql"
	"net/http"
	"sort"

	"zudomart/modules/wallet/src/generated/ent"
	"zudomart/modules/wallet/src/generated/ent/adbalanceearningstransfer"
	"zudomart/modules/wallet/src/generated/ent/adbalancetopup"
	"zudomart/platform/httpserver"
)

var ErrNothingToRefund = httpserver.NewApiError(http.StatusConflict, "NOTHING_TO_REFUND", "There is no unused ad balance left to return.")

type fundingSource struct {
	topUp    *ent.AdBalanceTopUp
	earnings *ent.AdBalanceEarningsTransfer
}

func (source fundingSource) unrefundedMinor() int64 {
	if source.earnings != nil {
		return source.earnings.AmountMinor - source.earnings.RefundedMinor
	}
	return source.topUp.AmountMinor - source.topUp.RefundedMinor
}

func (source fundingSource) createdAtUnixNano() int64 {
	if source.earnings != nil {
		return source.earnings.CreatedAt.UnixNano()
	}
	return source.topUp.CreatedAt.UnixNano()
}

func (balances AdBalances) lockFundingSourcesNewestFirst(ctx context.Context, transaction *sql.Tx, userId, adAccountId, currency string) ([]fundingSource, error) {
	client := balances.Container.Client(transaction)
	topUps, err := client.AdBalanceTopUp.Query().Where(adbalancetopup.AdAccountID(adAccountId), adbalancetopup.FundedByUserID(userId),
		adbalancetopup.StatusEQ(adbalancetopup.StatusSucceeded), adbalancetopup.Currency(currency)).ForUpdate().All(ctx)
	if err != nil {
		return nil, err
	}
	transfers, err := client.AdBalanceEarningsTransfer.Query().Where(adbalanceearningstransfer.AdAccountID(adAccountId), adbalanceearningstransfer.UserID(userId),
		adbalanceearningstransfer.Currency(currency)).ForUpdate().All(ctx)
	if err != nil {
		return nil, err
	}
	sources := make([]fundingSource, 0, len(topUps)+len(transfers))
	for _, topUp := range topUps {
		sources = append(sources, fundingSource{topUp: topUp})
	}
	for _, transfer := range transfers {
		sources = append(sources, fundingSource{earnings: transfer})
	}
	sort.SliceStable(sources, func(left, right int) bool {
		return sources[left].createdAtUnixNano() > sources[right].createdAtUnixNano()
	})
	return sources, nil
}
