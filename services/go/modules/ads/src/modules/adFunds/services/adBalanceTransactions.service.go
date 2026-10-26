package services

import (
	"context"
	"strings"
	"time"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adfundstransaction"
	boostdtos "nantty/modules/ads/src/modules/boosts/dtos"
	boostservices "nantty/modules/ads/src/modules/boosts/services"
	"nantty/modules/ads/src/types"
	"nantty/modules/ads/src/utils"
)

var creditTransactionKinds = map[adfundstransaction.Type]string{
	adfundstransaction.TypeCreditGrant: "credit_issued", adfundstransaction.TypeCreditSpend: "credit_spent", adfundstransaction.TypeCreditExpired: "credit_expired",
	adfundstransaction.TypeCreditRevoked: "credit_revoked", adfundstransaction.TypeCashback: "cashback", adfundstransaction.TypeCashbackReversal: "cashback_reversed",
}

var balanceTransactionKinds = map[adfundstransaction.Type]string{
	adfundstransaction.TypeTopUp: "top_up", adfundstransaction.TypeAdSpend: "spent", adfundstransaction.TypeCardCharge: "spent", adfundstransaction.TypeRefund: "refund",
	adfundstransaction.TypeAdSpendDebt: "debt", adfundstransaction.TypeWithdrawal: "withdrawal", adfundstransaction.TypeWithdrawalReversal: "refund", adfundstransaction.TypeSpendRefund: "refund",
}

func ClassifyAdFundsTransaction(row *ent.AdFundsTransaction) (string, string) {
	if kind, isCredit := creditTransactionKinds[row.Type]; isCredit {
		if row.Type == adfundstransaction.TypeCreditGrant && strings.HasPrefix(row.Description, "Refund") {
			kind = "refund"
		}
		return "credit", kind
	}
	kind := balanceTransactionKinds[row.Type]
	if row.Type == adfundstransaction.TypeTopUp && strings.HasPrefix(row.Reference, "boost:") {
		kind = "boost_funding"
		if strings.Contains(row.Description, "earnings") {
			kind = "earnings_funding"
		}
	}
	return "balance", kind
}

func ListAdBalanceTransactions(ctx context.Context, deployed *container.Container, userId uuid.UUID, currency string, cursor *uuid.UUID, limit int) ([]boostdtos.AdBalanceTransaction, string, error) {
	account, err := boostservices.FindPersonalBoostAccount(ctx, deployed.Client, userId, currency)
	if err != nil || account == nil {
		return []boostdtos.AdBalanceTransaction{}, "", err
	}
	query := deployed.Client.AdFundsTransaction.Query().Where(adfundstransaction.AccountID(account.ID))
	if cursor != nil {
		query.Where(adfundstransaction.IDLT(*cursor))
	}
	rows, err := query.Order(adfundstransaction.ByID(sql.OrderDesc())).Limit(limit + 1).All(ctx)
	if err != nil {
		return nil, "", err
	}
	next := ""
	if len(rows) > limit {
		rows = rows[:limit]
		next = utils.EncodeCursor(rows[len(rows)-1].ID)
	}
	items := make([]boostdtos.AdBalanceTransaction, 0, len(rows))
	for _, row := range rows {
		pot, kind := ClassifyAdFundsTransaction(row)
		items = append(items, boostdtos.AdBalanceTransaction{Id: row.ID.String(), Pot: pot, Kind: kind, Amount: types.Money{AmountMinor: row.AmountMinor, Currency: row.Currency},
			Description: row.Description, CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339)})
	}
	return items, next, nil
}
