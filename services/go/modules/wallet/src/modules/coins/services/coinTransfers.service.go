package services

import (
	"context"
	"database/sql"
	"errors"
	"net/http"

	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	"zudomart/modules/wallet/src/container"
	"zudomart/modules/wallet/src/modules/coins/dtos"
	"zudomart/modules/wallet/src/modules/coins/models"
	"zudomart/modules/wallet/src/repositories"
	"zudomart/platform/httpserver"
)

var (
	ErrCannotSendCoinsToSelf   = httpserver.NewApiError(http.StatusUnprocessableEntity, "CANNOT_SEND_TO_SELF", "You cannot send coins to yourself.")
	ErrRecipientCannotReceive  = httpserver.NewApiError(http.StatusUnprocessableEntity, "RECIPIENT_CANNOT_RECEIVE", "This person cannot receive coins.")
	ErrCoinTransferBlocked     = httpserver.NewApiError(http.StatusUnprocessableEntity, "COIN_TRANSFER_BLOCKED", "You cannot send coins to this person.")
	ErrInsufficientCoins       = httpserver.NewApiError(http.StatusPaymentRequired, "INSUFFICIENT_COINS", "You don't have enough coins. Buy more coins and try again.")
	ErrInsufficientEarnedCoins = httpserver.NewApiError(http.StatusUnprocessableEntity, "INSUFFICIENT_EARNED_COINS", "You do not have enough earned coins to convert.")
)

type CoinTransfers struct {
	Container *container.Container
	Accounts  repositories.AccountDirectory
}

func (transfers CoinTransfers) QuoteTransfer(coins int64) (dtos.CoinTransferQuoteDto, error) {
	split, err := models.SplitCoinTransfer(coins, transfers.Container.Settings.CoinTransferFeeBps)
	if err != nil {
		return dtos.CoinTransferQuoteDto{}, err
	}
	return dtos.CoinTransferQuoteDto{Coins: coins, FeeCoins: split.FeeCoins, NetCoins: split.NetCoins, FeePercent: transfers.Container.Settings.CoinTransferFeeBps / 100}, nil
}

type CoinTransferInput struct {
	SenderUserId    string
	RecipientUserId string
	Coins           int64
	Note            string
	IdempotencyKey  string
}

func (transfers CoinTransfers) TransferCoinsInTransaction(ctx context.Context, transaction *sql.Tx, input CoinTransferInput) (dtos.CoinTransferReceiptDto, error) {
	if input.SenderUserId == input.RecipientUserId {
		return dtos.CoinTransferReceiptDto{}, ErrCannotSendCoinsToSelf
	}
	active, err := transfers.Accounts.IsActiveAccount(ctx, input.RecipientUserId)
	if err != nil {
		return dtos.CoinTransferReceiptDto{}, err
	}
	if !active {
		return dtos.CoinTransferReceiptDto{}, ErrRecipientCannotReceive
	}
	blocked, err := transfers.Container.Blocks.BlockedEitherWay(ctx, input.SenderUserId, input.RecipientUserId)
	if err != nil {
		return dtos.CoinTransferReceiptDto{}, err
	}
	if blocked {
		return dtos.CoinTransferReceiptDto{}, ErrCoinTransferBlocked
	}
	feeBps := transfers.Container.Settings.CoinTransferFeeBps
	split, err := models.SplitCoinTransfer(input.Coins, feeBps)
	if err != nil {
		return dtos.CoinTransferReceiptDto{}, err
	}
	flags, err := CoinRiskRules{Container: transfers.Container}.FlagsForTransfer(ctx, transaction, input.SenderUserId, input.RecipientUserId)
	if err != nil {
		return dtos.CoinTransferReceiptDto{}, err
	}
	client := transfers.Container.Client(transaction)
	now := transfers.Container.Now().UTC()
	transfer, err := client.CoinTransfer.Create().SetReviewStatus(ReviewStateForTransferFlags(flags)).SetReviewFlags(flags).SetSenderUserID(input.SenderUserId).SetRecipientUserID(input.RecipientUserId).
		SetCoins(input.Coins).SetFeeCoins(split.FeeCoins).SetNetCoins(split.NetCoins).SetFeeBps(feeBps).SetNote(input.Note).SetCreatedAt(now).Save(ctx)
	if err != nil {
		return dtos.CoinTransferReceiptDto{}, err
	}
	lines := []ledgermodels.JournalLineRequest{
		{Account: ledgermodels.UserSpendableCoinsAccount(input.SenderUserId), Direction: ledgermodels.Debit, AmountMinor: input.Coins},
		{Account: ledgermodels.UserSpendableCoinsAccount(input.RecipientUserId), Direction: ledgermodels.Credit, AmountMinor: split.NetCoins},
	}
	if split.FeeCoins > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.PlatformCoinTransferFeeRevenueAccount(), Direction: ledgermodels.Credit, AmountMinor: split.FeeCoins})
	}
	posted, err := transfers.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "coin-transfer:" + input.SenderUserId + ":" + input.IdempotencyKey, Kind: "coins.transferred", Description: "Coin transfer",
		Metadata: map[string]any{"coinTransferId": transfer.ID.String(), "recipientUserId": input.RecipientUserId}, Lines: lines,
	})
	if errors.Is(err, ledgermodels.ErrInsufficientBalance) {
		return dtos.CoinTransferReceiptDto{}, ErrInsufficientCoins
	}
	if err != nil {
		return dtos.CoinTransferReceiptDto{}, err
	}
	balance, _ := posted.BalanceAfter(ledgermodels.UserSpendableCoinsAccount(input.SenderUserId))
	if err := transfers.Container.Outbox.EnqueueInTransaction(ctx, transaction, "coinTransfer.completed", transfer.ID.String(), now, map[string]any{
		"coinTransferId": transfer.ID.String(), "senderUserId": input.SenderUserId, "recipientUserId": input.RecipientUserId,
		"coins": input.Coins, "feeCoins": split.FeeCoins, "netCoins": split.NetCoins,
	}); err != nil {
		return dtos.CoinTransferReceiptDto{}, err
	}
	return dtos.CoinTransferReceiptDto{TransferId: transfer.ID.String(), Coins: input.Coins, FeeCoins: split.FeeCoins, NetCoins: split.NetCoins, Balance: balance}, nil
}
