package services

import (
	"context"
	"database/sql"
	"strings"
	"time"

	programservices "nantty/modules/creators/src/modules/creatorProgram/services"
	"nantty/modules/ledger/src/databases"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
)

type CreatorSubscriptionPaid struct {
	SubscriptionId string `json:"subscriptionId"`
	ChargeId       string `json:"chargeId"`
	CreatorId      string `json:"creatorId"`
	Kind           string `json:"kind"`
	Reference      string `json:"reference"`
	Amount         Money  `json:"amount"`
	CreatorShare   Money  `json:"creatorShare"`
}

type AdCreatorEarningsPosted struct {
	CreatorUserId  string `json:"creatorUserId"`
	Currency       string `json:"currency"`
	AmountMinor    int64  `json:"amountMinor"`
	BatchId        string `json:"batchId"`
	IdempotencyKey string `json:"idempotencyKey"`
}

func (money CreatorMoney) RecordSubscriptionEarning(ctx context.Context, paid CreatorSubscriptionPaid, at time.Time) error {
	if paid.CreatorId == "" || paid.Reference == "" || paid.CreatorShare.AmountMinor <= 0 {
		return nil
	}
	_, err := programservices.RecordEarning(ctx, money.Container.Client(money.Container.Resources.Database), programservices.Earning{
		CreatorId: paid.CreatorId, Kind: "subscription", Reference: paid.Reference, SourceType: "subscription", SourceId: paid.SubscriptionId,
		Description: "Subscription " + paid.Kind, GrossMinor: paid.Amount.AmountMinor, NetMinor: paid.CreatorShare.AmountMinor, Unit: paid.CreatorShare.Currency, At: at.UTC(),
	})
	return err
}

func (money CreatorMoney) PostAdRevenueShare(ctx context.Context, posted AdCreatorEarningsPosted, at time.Time) error {
	currency := strings.ToUpper(posted.Currency)
	if posted.CreatorUserId == "" || posted.AmountMinor <= 0 || len(currency) != 3 || posted.IdempotencyKey == "" {
		return nil
	}
	reference := "ads-revenue-share:" + posted.IdempotencyKey
	return databases.RunInMoneyTransaction(ctx, money.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		entry, err := money.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
			Reference: reference, Kind: "adRevenueShare.credited", ExternalReference: posted.BatchId, Description: "Creator share of ad revenue",
			Metadata: map[string]any{"creatorUserId": posted.CreatorUserId, "batchId": posted.BatchId},
			Lines: []ledgermodels.JournalLineRequest{
				{Account: ledgermodels.PlatformAdRevenueAccount(currency), Direction: ledgermodels.Debit, AmountMinor: posted.AmountMinor},
				{Account: ledgermodels.CreatorEarningsPayableAccount(posted.CreatorUserId, currency), Direction: ledgermodels.Credit, AmountMinor: posted.AmountMinor},
			},
		})
		if err != nil || entry.Replayed {
			return err
		}
		_, err = programservices.RecordEarning(ctx, money.Container.Client(transaction), programservices.Earning{
			CreatorId: posted.CreatorUserId, Kind: "ad_revenue", Reference: reference, SourceType: "ads", SourceId: posted.BatchId, Description: "Ad revenue share",
			GrossMinor: posted.AmountMinor, NetMinor: posted.AmountMinor, Unit: currency, At: at.UTC(),
		})
		return err
	})
}
