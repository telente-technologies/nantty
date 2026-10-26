package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"nantty/modules/creators/src/container"
	"nantty/modules/creators/src/generated/ent"
	"nantty/modules/creators/src/generated/ent/gifttransaction"
	programservices "nantty/modules/creators/src/modules/creatorProgram/services"
	"nantty/modules/creators/src/modules/liveMoney/models"
	"nantty/modules/ledger/src/databases"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	ledgerutils "nantty/modules/ledger/src/utils"
)

type LiveMoneyError struct {
	Reason       string
	Message      string
	Precondition bool
	CoinBalance  *int64
}

func (failure *LiveMoneyError) Error() string { return failure.Reason + ": " + failure.Message }

func invalidArgument(message string) error {
	return &LiveMoneyError{Reason: "VALIDATION_FAILED", Message: message}
}

func failedPrecondition(reason, message string) *LiveMoneyError {
	return &LiveMoneyError{Reason: reason, Message: message, Precondition: true}
}

var ErrIdempotencyKeyReused = errors.New("IDEMPOTENCY_KEY_REUSED")

type ChargeGiftRequest struct {
	SenderUserId   string
	ReceiverUserId string
	HostUserId     string
	LiveId         string
	GiftId         string
	Quantity       int64
	UnitPriceCoins int64
	BattleId       string
	ComboId        string
	IdempotencyKey string
}

type ChargedGift struct {
	Transaction       *ent.GiftTransaction
	SenderCoinBalance int64
	Replayed          bool
}

type LiveMoney struct {
	Container *container.Container
	Program   programservices.CreatorProgram
}

func validateChargeGiftRequest(request ChargeGiftRequest) error {
	switch {
	case request.SenderUserId == "" || request.ReceiverUserId == "" || request.HostUserId == "" || request.LiveId == "" || request.GiftId == "":
		return invalidArgument("sender, receiver, host, live and gift are required")
	case len(request.LiveId) > 80 || len(request.GiftId) > 80 || len(request.BattleId) > 80 || len(request.ComboId) > 80:
		return invalidArgument("identifiers must be at most 80 characters")
	case !ledgerutils.IsValidIdempotencyKey(request.IdempotencyKey):
		return invalidArgument("idempotency_key must be 8-128 letters, digits, - or _")
	case request.SenderUserId == request.ReceiverUserId:
		return failedPrecondition("CANNOT_GIFT_SELF", "You cannot send a gift to yourself.")
	}
	return nil
}

func (live LiveMoney) ChargeGiftAndCreditCreator(ctx context.Context, request ChargeGiftRequest) (ChargedGift, error) {
	if err := validateChargeGiftRequest(request); err != nil {
		return ChargedGift{}, err
	}
	requestHash := ledgerutils.HashRequestFingerprint(request.ReceiverUserId, request.HostUserId, request.LiveId, request.GiftId, request.Quantity, request.UnitPriceCoins, request.BattleId, request.ComboId)
	var charged ChargedGift
	err := databases.RunInMoneyTransaction(ctx, live.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		var err error
		charged, err = live.chargeGiftInTransaction(ctx, transaction, request, requestHash)
		return err
	})
	return charged, err
}

func (live LiveMoney) chargeGiftInTransaction(ctx context.Context, transaction *sql.Tx, request ChargeGiftRequest, requestHash string) (ChargedGift, error) {
	client := live.Container.Client(transaction)
	if _, err := client.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "gift:"+request.SenderUserId+":"+request.IdempotencyKey); err != nil {
		return ChargedGift{}, err
	}
	existing, err := client.GiftTransaction.Query().Where(gifttransaction.SenderUserID(request.SenderUserId), gifttransaction.IdempotencyKey(request.IdempotencyKey)).Only(ctx)
	if err == nil {
		if existing.RequestHash != requestHash {
			return ChargedGift{}, ErrIdempotencyKeyReused
		}
		balance, err := live.Container.Ledger.ReadAccountBalance(ctx, transaction, ledgermodels.UserSpendableCoinsAccount(request.SenderUserId))
		return ChargedGift{Transaction: existing, SenderCoinBalance: balance, Replayed: true}, err
	}
	if !ent.IsNotFound(err) {
		return ChargedGift{}, err
	}
	credited, shareBps, err := live.Program.ResolveCreditedCreator(ctx, transaction, request.ReceiverUserId, request.HostUserId)
	if errors.Is(err, programservices.ErrRecipientCannotReceiveGifts) {
		return ChargedGift{}, failedPrecondition("RECIPIENT_CANNOT_RECEIVE_GIFTS", "Neither the recipient nor the host is in the Creator Program.")
	}
	if err != nil {
		return ChargedGift{}, err
	}
	split, err := models.SplitGiftCoins(request.Quantity, request.UnitPriceCoins, shareBps)
	if err != nil {
		return ChargedGift{}, invalidArgument("quantity must be 1-100 and unit_price_coins positive")
	}
	creatorAccount := ledgermodels.CreatorEarnedCoinsAccount(credited)
	if request.BattleId != "" {
		creatorAccount = ledgermodels.BattleHoldingCoinsAccount(request.BattleId, request.ReceiverUserId)
	}
	lines := []ledgermodels.JournalLineRequest{{Account: ledgermodels.UserSpendableCoinsAccount(request.SenderUserId), Direction: ledgermodels.Debit, AmountMinor: split.TotalCoins}}
	if split.CreatorAmountCoins > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: creatorAccount, Direction: ledgermodels.Credit, AmountMinor: split.CreatorAmountCoins})
	}
	if split.PlatformFeeCoins > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.PlatformGiftRevenueCoinsAccount(), Direction: ledgermodels.Credit, AmountMinor: split.PlatformFeeCoins})
	}
	giftId := uuid.Must(uuid.NewV7())
	posted, err := live.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: fmt.Sprintf("gift:%s:%s:%s", request.LiveId, request.SenderUserId, request.IdempotencyKey), Kind: "gift.charged",
		Description: "Live gift", Lines: lines,
		Metadata: map[string]any{"giftTransactionId": giftId.String(), "liveId": request.LiveId, "battleId": request.BattleId, "giftId": request.GiftId},
	})
	var insufficient *ledgermodels.InsufficientBalanceError
	if errors.As(err, &insufficient) {
		failure := failedPrecondition("INSUFFICIENT_COINS", "You don't have enough coins. Buy more coins and try again.")
		failure.CoinBalance = &insufficient.BalanceMinor
		return ChargedGift{}, failure
	}
	if err != nil {
		return ChargedGift{}, err
	}
	now := live.Container.Now().UTC()
	gift, err := client.GiftTransaction.Create().SetID(giftId).SetSenderUserID(request.SenderUserId).SetReceiverUserID(request.ReceiverUserId).
		SetCreditedUserID(credited).SetHostUserID(request.HostUserId).SetLiveID(request.LiveId).SetBattleID(request.BattleId).SetGiftID(request.GiftId).
		SetComboID(request.ComboId).SetQuantity(int(request.Quantity)).SetUnitPriceCoins(request.UnitPriceCoins).SetTotalCoins(split.TotalCoins).
		SetPlatformFeeCoins(split.PlatformFeeCoins).SetCreatorAmountCoins(split.CreatorAmountCoins).SetCreatorShareBps(split.CreatorShareBps).
		SetIdempotencyKey(request.IdempotencyKey).SetRequestHash(requestHash).SetLedgerEntryID(posted.Id).SetCreatedAt(now).Save(ctx)
	if err != nil {
		return ChargedGift{}, err
	}
	if split.CreatorAmountCoins > 0 && request.BattleId == "" {
		if _, err := programservices.RecordEarning(ctx, client, programservices.Earning{
			CreatorId: credited, Kind: "gift", Reference: "gift:" + gift.ID.String(), SourceType: "live", SourceId: request.LiveId, Description: "Live gift",
			GrossMinor: split.TotalCoins, NetMinor: split.CreatorAmountCoins, Unit: programservices.CoinUnit, At: now,
		}); err != nil {
			return ChargedGift{}, err
		}
	}
	if err := live.Container.Outbox.EnqueueInTransaction(ctx, transaction, "giftTransaction.committed", request.LiveId, now, giftSentEventData(gift)); err != nil {
		return ChargedGift{}, err
	}
	balance, _ := posted.BalanceAfter(ledgermodels.UserSpendableCoinsAccount(request.SenderUserId))
	return ChargedGift{Transaction: gift, SenderCoinBalance: balance}, nil
}

func giftSentEventData(gift *ent.GiftTransaction) map[string]any {
	data := map[string]any{
		"giftTransactionId": gift.ID.String(), "liveId": gift.LiveID, "giftId": gift.GiftID, "quantity": gift.Quantity,
		"totalCoins": gift.TotalCoins, "senderUserId": gift.SenderUserID, "receiverUserId": gift.ReceiverUserID, "creditedUserId": gift.CreditedUserID,
		"comboId": gift.ComboID, "createdAt": gift.CreatedAt,
	}
	if gift.BattleID != "" {
		data["battleId"] = gift.BattleID
	}
	return data
}
