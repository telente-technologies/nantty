package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	programservices "nantty/modules/creators/src/modules/creatorProgram/services"
	"nantty/modules/creators/src/modules/liveMoney/models"
	"nantty/modules/ledger/src/databases"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	ledgerutils "nantty/modules/ledger/src/utils"
)

// SpaceCoinGiftRequest intentionally has no client-supplied receiver or price. The host
// is the only recipient and the active catalog row is the sole source of gift pricing.
type SpaceCoinGiftRequest struct {
	SenderUserID   string
	SpaceID        string
	GiftID         string
	Quantity       int64
	IdempotencyKey string
}

type SpaceCoinGiftReceipt struct {
	GiftTransactionID string
	LedgerEntryID     string
	SenderUserID      string
	HostUserID        string
	SpaceID           string
	GiftID            string
	Quantity          int64
	UnitPriceCoins    int64
	TotalCoins        int64
	PlatformFeeCoins  int64
	CreatorAmount     int64
	SenderBalance     int64
	Replayed          bool
}

func validateSpaceCoinGift(request SpaceCoinGiftRequest) error {
	switch {
	case request.SenderUserID == "" || request.SpaceID == "" || request.GiftID == "":
		return invalidArgument("sender, space and gift are required")
	case len(request.SpaceID) > 80 || len(request.GiftID) > 80 || len(request.SenderUserID) > 80:
		return invalidArgument("identifiers must be at most 80 characters")
	case !ledgerutils.IsValidIdempotencyKey(request.IdempotencyKey):
		return invalidArgument("idempotency_key must be 8-128 letters, digits, - or _")
	case request.Quantity < 1 || request.Quantity > 100:
		return invalidArgument("quantity must be 1-100")
	}
	return nil
}

func (live LiveMoney) ChargeSpaceCoinGift(ctx context.Context, request SpaceCoinGiftRequest) (SpaceCoinGiftReceipt, error) {
	if err := validateSpaceCoinGift(request); err != nil {
		return SpaceCoinGiftReceipt{}, err
	}
	requestHash := ledgerutils.HashRequestFingerprint(request.SpaceID, request.GiftID, request.Quantity)
	var receipt SpaceCoinGiftReceipt
	err := databases.RunInMoneyTransaction(ctx, live.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		var err error
		receipt, err = live.chargeSpaceCoinGiftInTransaction(ctx, transaction, request, requestHash)
		return err
	})
	return receipt, err
}

func (live LiveMoney) chargeSpaceCoinGiftInTransaction(ctx context.Context, transaction *sql.Tx, request SpaceCoinGiftRequest, requestHash string) (SpaceCoinGiftReceipt, error) {
	client := live.Container.Client(transaction)
	if _, err := transaction.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "space-gift:"+request.SenderUserID+":"+request.IdempotencyKey); err != nil {
		return SpaceCoinGiftReceipt{}, err
	}

	var existing SpaceCoinGiftReceipt
	var existingHash string
	query := "SELECT id::text, ledger_entry_id::text, sender_user_id, host_user_id, space_id, gift_id, quantity, unit_price_coins, total_coins, platform_fee_coins, creator_amount_coins, request_hash FROM " + pgx.Identifier{live.Container.Settings.Money.DatabaseSchema, "space_coin_gifts"}.Sanitize() + " WHERE sender_user_id = $1 AND idempotency_key = $2"
	err := transaction.QueryRowContext(ctx, query, request.SenderUserID, request.IdempotencyKey).Scan(
		&existing.GiftTransactionID, &existing.LedgerEntryID, &existing.SenderUserID, &existing.HostUserID, &existing.SpaceID, &existing.GiftID,
		&existing.Quantity, &existing.UnitPriceCoins, &existing.TotalCoins, &existing.PlatformFeeCoins, &existing.CreatorAmount, &existingHash,
	)
	if err == nil {
		if existingHash != requestHash {
			return SpaceCoinGiftReceipt{}, ErrIdempotencyKeyReused
		}
		balance, err := live.Container.Ledger.ReadAccountBalance(ctx, transaction, ledgermodels.UserSpendableCoinsAccount(request.SenderUserID))
		existing.SenderBalance, existing.Replayed = balance, true
		return existing, err
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return SpaceCoinGiftReceipt{}, err
	}

	// Host identity and gift eligibility are authoritative Space state, never caller input.
	var hostUserID, spaceState string
	var giftsEnabled bool
	spaceQuery := "SELECT host_id::text, state, gifts_enabled FROM " + pgx.Identifier{live.Container.Settings.LiveSchema, "spaces"}.Sanitize() + " WHERE id::text = $1 FOR SHARE"
	if err := transaction.QueryRowContext(ctx, spaceQuery, request.SpaceID).Scan(&hostUserID, &spaceState, &giftsEnabled); errors.Is(err, sql.ErrNoRows) {
		return SpaceCoinGiftReceipt{}, failedPrecondition("SPACE_NOT_FOUND", "This Space is unavailable.")
	} else if err != nil {
		return SpaceCoinGiftReceipt{}, err
	}
	if spaceState != "live" || !giftsEnabled {
		return SpaceCoinGiftReceipt{}, failedPrecondition("SPACE_GIFTS_DISABLED", "Coin gifts are not enabled for this Space.")
	}
	if request.SenderUserID == hostUserID {
		return SpaceCoinGiftReceipt{}, failedPrecondition("CANNOT_GIFT_SELF", "You cannot send a coin gift to yourself.")
	}

	// Space hosts must themselves be approved creators; unlike LIVE gifting there is
	// no fallback recipient and no caller-controlled guest/speaker recipient.
	shareBps, approved, err := live.Program.ApprovedCreatorShare(ctx, transaction, hostUserID)
	if err != nil {
		return SpaceCoinGiftReceipt{}, err
	}
	if !approved {
		return SpaceCoinGiftReceipt{}, failedPrecondition("SPACE_HOST_NOT_CREATOR", "Only an approved creator can receive Space coin gifts.")
	}
	blocked, err := live.Container.Directory.BlockedEitherWay(ctx, request.SenderUserID, hostUserID)
	if err != nil {
		return SpaceCoinGiftReceipt{}, err
	}
	if blocked {
		return SpaceCoinGiftReceipt{}, failedPrecondition("SPACE_GIFT_BLOCKED", "Coin gifts are unavailable between these accounts.")
	}

	// Read the live catalog's active flag and price within this transaction. The
	// caller cannot submit a price, and presentation/animation fields are never read.
	var unitPrice int64
	catalogQuery := "SELECT price_coins FROM " + pgx.Identifier{live.Container.Settings.LiveSchema, "gifts"}.Sanitize() + " WHERE id = $1 AND is_active = TRUE"
	if err := transaction.QueryRowContext(ctx, catalogQuery, request.GiftID).Scan(&unitPrice); errors.Is(err, sql.ErrNoRows) {
		return SpaceCoinGiftReceipt{}, failedPrecondition("SPACE_GIFT_UNAVAILABLE", "This coin gift is unavailable.")
	} else if err != nil {
		return SpaceCoinGiftReceipt{}, err
	}
	split, err := models.SplitGiftCoins(request.Quantity, unitPrice, shareBps)
	if err != nil {
		return SpaceCoinGiftReceipt{}, invalidArgument("gift quantity or catalog price is invalid")
	}

	giftID := uuid.Must(uuid.NewV7())
	now := live.Container.Now().UTC()
	lines := []ledgermodels.JournalLineRequest{{Account: ledgermodels.UserSpendableCoinsAccount(request.SenderUserID), Direction: ledgermodels.Debit, AmountMinor: split.TotalCoins}}
	if split.CreatorAmountCoins > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.CreatorEarnedCoinsAccount(hostUserID), Direction: ledgermodels.Credit, AmountMinor: split.CreatorAmountCoins})
	}
	if split.PlatformFeeCoins > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.PlatformGiftRevenueCoinsAccount(), Direction: ledgermodels.Credit, AmountMinor: split.PlatformFeeCoins})
	}
	posted, err := live.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: fmt.Sprintf("space-gift:%s:%s:%s", request.SpaceID, request.SenderUserID, request.IdempotencyKey),
		Kind:      "space.coinGift.charged", Description: "Space coin gift",
		Metadata: map[string]any{"spaceCoinGiftId": giftID.String(), "spaceId": request.SpaceID, "hostUserId": hostUserID, "giftId": request.GiftID},
		Lines:    lines,
	})
	var insufficient *ledgermodels.InsufficientBalanceError
	if errors.As(err, &insufficient) {
		failure := failedPrecondition("INSUFFICIENT_COINS", "You don't have enough coins. Buy more coins and try again.")
		failure.CoinBalance = &insufficient.BalanceMinor
		return SpaceCoinGiftReceipt{}, failure
	}
	if err != nil {
		return SpaceCoinGiftReceipt{}, err
	}

	insert := "INSERT INTO " + pgx.Identifier{live.Container.Settings.Money.DatabaseSchema, "space_coin_gifts"}.Sanitize() +
		" (id, sender_user_id, host_user_id, space_id, gift_id, quantity, unit_price_coins, total_coins, platform_fee_coins, creator_amount_coins, creator_share_bps, idempotency_key, request_hash, ledger_entry_id, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)"
	if _, err := transaction.ExecContext(ctx, insert, giftID, request.SenderUserID, hostUserID, request.SpaceID, request.GiftID, request.Quantity,
		unitPrice, split.TotalCoins, split.PlatformFeeCoins, split.CreatorAmountCoins, split.CreatorShareBps, request.IdempotencyKey, requestHash, posted.Id, now); err != nil {
		return SpaceCoinGiftReceipt{}, err
	}
	if split.CreatorAmountCoins > 0 {
		if _, err := programservices.RecordEarning(ctx, client, programservices.Earning{
			CreatorId: hostUserID, Kind: "gift", Reference: "space-gift:" + giftID.String(), SourceType: "space", SourceId: request.SpaceID,
			Description: "Space coin gift", GrossMinor: split.TotalCoins, NetMinor: split.CreatorAmountCoins, Unit: programservices.CoinUnit, At: now,
		}); err != nil {
			return SpaceCoinGiftReceipt{}, err
		}
	}
	if err := live.Container.Outbox.EnqueueInTransaction(ctx, transaction, "spaceCoinGift.committed", request.SpaceID, now, map[string]any{
		"spaceCoinGiftId": giftID.String(), "spaceId": request.SpaceID, "giftId": request.GiftID, "quantity": request.Quantity,
		"totalCoins": split.TotalCoins, "creatorAmountCoins": split.CreatorAmountCoins,
		"senderUserId": request.SenderUserID, "hostUserId": hostUserID, "createdAt": now,
	}); err != nil {
		return SpaceCoinGiftReceipt{}, err
	}
	balance, _ := posted.BalanceAfter(ledgermodels.UserSpendableCoinsAccount(request.SenderUserID))
	return SpaceCoinGiftReceipt{
		GiftTransactionID: giftID.String(), LedgerEntryID: posted.Id.String(), SenderUserID: request.SenderUserID, HostUserID: hostUserID,
		SpaceID: request.SpaceID, GiftID: request.GiftID, Quantity: request.Quantity, UnitPriceCoins: unitPrice,
		TotalCoins: split.TotalCoins, PlatformFeeCoins: split.PlatformFeeCoins, CreatorAmount: split.CreatorAmountCoins, SenderBalance: balance,
	}, nil
}
