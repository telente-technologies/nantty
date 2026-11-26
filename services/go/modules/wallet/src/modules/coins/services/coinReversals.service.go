package services

import (
	"context"
	"database/sql"
	"errors"
	"net/http"

	"github.com/google/uuid"

	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
	"nantty/modules/wallet/src/generated/ent"
	"nantty/modules/wallet/src/generated/ent/coinpurchase"
	"nantty/modules/wallet/src/generated/ent/cointransfer"
	"nantty/modules/wallet/src/modules/coins/models"
	"nantty/platform/httpserver"
)

var (
	ErrCoinTransactionReversed   = httpserver.NewApiError(http.StatusConflict, "COIN_TRANSACTION_REVERSED", "This transaction was already reversed.")
	ErrCoinPurchaseNotReversible = httpserver.NewApiError(http.StatusConflict, "COIN_PURCHASE_NOT_REVERSIBLE", "Only completed web purchases can be reversed here. App store purchases are refunded by Apple or Google.")
	ErrCoinReversalRaced         = httpserver.NewApiError(http.StatusConflict, "COIN_BALANCE_CHANGED", "The balance changed while reversing. Try again.")
)

type CoinReversal struct {
	TransactionId uuid.UUID
	RefundId      *uuid.UUID
}

func (reviews CoinReviews) ReverseInTransaction(ctx context.Context, transaction *sql.Tx, staffId string, transactionId uuid.UUID, reason string) (CoinReversal, error) {
	client := reviews.Container.Client(transaction)
	record, err := reviews.FindRecord(ctx, client, transactionId, true)
	if err != nil {
		return CoinReversal{}, err
	}
	if record.Purchase != nil {
		return reviews.reversePurchase(ctx, transaction, client, record.Purchase, staffId, reason)
	}
	return CoinReversal{TransactionId: transactionId}, reviews.reverseTransfer(ctx, transaction, client, record.Transfer, staffId, reason)
}

func (reviews CoinReviews) reverseTransfer(ctx context.Context, transaction *sql.Tx, client *ent.Client, transfer *ent.CoinTransfer, staffId, reason string) error {
	if transfer.ReviewStatus == cointransfer.ReviewStatusReversed {
		return ErrCoinTransactionReversed
	}
	recipientCoins := ledgermodels.UserSpendableCoinsAccount(transfer.RecipientUserID)
	clawback, err := (CoinPurchases{Container: reviews.Container}).unspentCoinsFromLedgerCredit(ctx, transaction, transfer.RecipientUserID, transfer.ID.String(), "", transfer.NetCoins)
	if err != nil {
		return err
	}
	lines := []ledgermodels.JournalLineRequest{{Account: ledgermodels.UserSpendableCoinsAccount(transfer.SenderUserID), Direction: ledgermodels.Credit, AmountMinor: transfer.Coins}}
	if clawback.RecoveredCoins > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: recipientCoins, Direction: ledgermodels.Debit, AmountMinor: clawback.RecoveredCoins})
	}
	if clawback.ShortfallCoins > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.PlatformUnrecoveredCoinClawbackAccount(), Direction: ledgermodels.Debit, AmountMinor: clawback.ShortfallCoins})
	}
	if transfer.FeeCoins > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.PlatformCoinTransferFeeRevenueAccount(), Direction: ledgermodels.Debit, AmountMinor: transfer.FeeCoins})
	}
	if err := reviews.postReversal(ctx, transaction, "coin-transfer-reversal:"+transfer.ID.String(), "coins.transferReversed", "Coin transfer reversed by Nantty", lines, clawback); err != nil {
		return err
	}
	now := reviews.Container.Now().UTC()
	if err := transfer.Update().SetReviewStatus(cointransfer.ReviewStatusReversed).SetReviewedByStaffID(staffId).SetReviewedAt(now).SetReviewNote(reason).
		SetReversedAt(now).SetClawbackShortfallCoins(clawback.ShortfallCoins).Exec(ctx); err != nil {
		return err
	}
	if err := reviews.flagShortfall(ctx, client, transfer.RecipientUserID, "coinTransferReversedAfterSpend", transfer.ID.String(), clawback.ShortfallCoins); err != nil {
		return err
	}
	return reviews.Container.Outbox.EnqueueInTransaction(ctx, transaction, "coinTransfer.reversed", transfer.ID.String(), now, map[string]any{
		"coinTransferId": transfer.ID.String(), "senderUserId": transfer.SenderUserID, "recipientUserId": transfer.RecipientUserID,
		"coins": transfer.Coins, "recoveredCoins": clawback.RecoveredCoins, "shortfallCoins": clawback.ShortfallCoins, "reason": reason,
	})
}

func (reviews CoinReviews) reversePurchase(ctx context.Context, transaction *sql.Tx, client *ent.Client, purchase *ent.CoinPurchase, staffId, reason string) (CoinReversal, error) {
	if purchase.ReviewStatus == coinpurchase.ReviewStatusReversed {
		return CoinReversal{}, ErrCoinTransactionReversed
	}
	if purchase.Status != coinpurchase.StatusSucceeded || purchase.Channel != coinpurchase.ChannelWebCheckout || purchase.PaymentIntentID == nil {
		return CoinReversal{}, ErrCoinPurchaseNotReversible
	}
	buyerCoins := ledgermodels.UserSpendableCoinsAccount(purchase.UserID)
	clawback, err := (CoinPurchases{Container: reviews.Container}).unspentCoinsFromLedgerCredit(ctx, transaction, purchase.UserID, purchase.ID.String(), "coin-purchase:"+purchase.ID.String(), purchase.Coins)
	if err != nil {
		return CoinReversal{}, err
	}
	lines := []ledgermodels.JournalLineRequest{
		{Account: ledgermodels.CoinSalesRevenueAccount(purchase.Currency), Direction: ledgermodels.Debit, AmountMinor: purchase.AmountMinor},
		{Account: ledgermodels.RefundsPayableAccount(purchase.Provider, purchase.Currency), Direction: ledgermodels.Credit, AmountMinor: purchase.AmountMinor},
		{Account: ledgermodels.CoinsInCirculationAccount(), Direction: ledgermodels.Credit, AmountMinor: purchase.Coins},
	}
	if clawback.RecoveredCoins > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: buyerCoins, Direction: ledgermodels.Debit, AmountMinor: clawback.RecoveredCoins})
	}
	if clawback.ShortfallCoins > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.PlatformUnrecoveredCoinClawbackAccount(), Direction: ledgermodels.Debit, AmountMinor: clawback.ShortfallCoins})
	}
	reference := "coin-purchase-reversal:" + purchase.ID.String()
	if err := reviews.postReversal(ctx, transaction, reference, "coins.purchaseReversed", "Coin purchase reversed and refunded", lines, clawback); err != nil {
		return CoinReversal{}, err
	}
	refund, err := reviews.Container.Payments.RequestRefundInTransaction(ctx, transaction, paymentmodels.RefundRequest{
		PaymentIntentId: *purchase.PaymentIntentID, AmountMinor: purchase.AmountMinor, Currency: purchase.Currency, Reference: "coin-reversal-" + purchase.ID.String(), Reason: reason,
	})
	if err != nil {
		return CoinReversal{}, err
	}
	now := reviews.Container.Now().UTC()
	if err := purchase.Update().SetStatus(coinpurchase.StatusRefunded).SetRefundedAt(now).SetClawbackShortfallCoins(clawback.ShortfallCoins).
		SetReviewStatus(coinpurchase.ReviewStatusReversed).SetReviewedByStaffID(staffId).SetReviewedAt(now).SetReviewNote(reason).Exec(ctx); err != nil {
		return CoinReversal{}, err
	}
	if err := reviews.flagShortfall(ctx, client, purchase.UserID, "coinPurchaseReversedAfterSpend", purchase.ID.String(), clawback.ShortfallCoins); err != nil {
		return CoinReversal{}, err
	}
	data := coinPurchaseEventData(purchase)
	data["recoveredCoins"], data["shortfallCoins"], data["reason"] = clawback.RecoveredCoins, clawback.ShortfallCoins, reason
	if err := reviews.Container.Outbox.EnqueueInTransaction(ctx, transaction, "coinPurchase.reversed", purchase.ID.String(), now, data); err != nil {
		return CoinReversal{}, err
	}
	refundId := refund.RefundId
	return CoinReversal{TransactionId: purchase.ID, RefundId: &refundId}, nil
}

func (reviews CoinReviews) postReversal(ctx context.Context, transaction *sql.Tx, reference, kind, description string, lines []ledgermodels.JournalLineRequest, clawback models.CoinClawback) error {
	_, err := reviews.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: reference, Kind: kind, Description: description, Lines: lines,
		Metadata: map[string]any{"recoveredCoins": clawback.RecoveredCoins, "shortfallCoins": clawback.ShortfallCoins},
	})
	if errors.Is(err, ledgermodels.ErrInsufficientBalance) {
		return ErrCoinReversalRaced
	}
	return err
}

func (reviews CoinReviews) flagShortfall(ctx context.Context, client *ent.Client, userId, reason, subjectId string, shortfall int64) error {
	if shortfall <= 0 {
		return nil
	}
	return client.WalletRiskFlag.Create().SetUserID(userId).SetReason(reason).SetSubjectID(subjectId).SetCoinsShortfall(shortfall).SetCreatedAt(reviews.Container.Now().UTC()).Exec(ctx)
}

func (reviews CoinReviews) SendRefundAfterCommit(ctx context.Context, reversal CoinReversal) {
	if reversal.RefundId == nil {
		return
	}
	if err := reviews.Container.Payments.SendPendingRefundToProvider(ctx, *reversal.RefundId); err != nil {
		reviews.Container.Resources.Logger.WarnContext(ctx, "coin reversal refund will be retried", "refundId", reversal.RefundId.String(), "error", err)
	}
}
