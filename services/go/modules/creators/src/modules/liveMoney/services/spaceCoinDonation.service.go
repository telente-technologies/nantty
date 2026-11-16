package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"nantty/modules/creators/src/generated/ent/creatorearning"
	programservices "nantty/modules/creators/src/modules/creatorProgram/services"
	"nantty/modules/creators/src/modules/liveMoney/models"
	"nantty/modules/ledger/src/databases"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	ledgerutils "nantty/modules/ledger/src/utils"
)

// SpaceCoinDonationRequest contains only the authenticated sender, Space, coin
// amount, and idempotency key. The recipient and split are server-resolved.
type SpaceCoinDonationRequest struct {
	SenderUserID   string
	SpaceID        string
	Coins          int64
	IdempotencyKey string
}

type SpaceCoinDonationReceipt struct {
	DonationID       string
	LedgerEntryID    string
	SenderUserID     string
	HostUserID       string
	SpaceID          string
	TotalCoins       int64
	PlatformFeeCoins int64
	CreatorAmount    int64
	SenderBalance    int64
	Replayed         bool
}

func ValidateSpaceCoinDonation(request SpaceCoinDonationRequest, minimumCoins, maximumCoins int64) error {
	if request.SenderUserID == "" || request.SpaceID == "" || len(request.SenderUserID) > 80 || len(request.SpaceID) > 80 || !ledgerutils.IsValidIdempotencyKey(request.IdempotencyKey) {
		return invalidArgument("sender, space and a valid idempotency key are required")
	}
	if _, err := models.SplitSpaceDonationCoins(request.Coins, 0, minimumCoins, maximumCoins); err != nil {
		return &LiveMoneyError{Reason: "INVALID_DONATION_AMOUNT", Message: "Coins must be within the Space donation policy.", MinimumCoins: minimumCoins, MaximumCoins: maximumCoins}
	}
	return nil
}

func SpaceCoinDonationSplit(coins, minimumCoins, maximumCoins, platformFeeBps int64) (models.GiftSplit, error) {
	if _, err := models.SplitSpaceDonationCoins(coins, 0, minimumCoins, maximumCoins); err != nil {
		return models.GiftSplit{}, err
	}
	return models.SplitCoinsByPlatformFeeBps(coins, platformFeeBps)
}

func (live LiveMoney) DonateSpaceCoins(ctx context.Context, request SpaceCoinDonationRequest) (SpaceCoinDonationReceipt, error) {
	minimum, maximum := live.spaceDonationBounds()
	if err := ValidateSpaceCoinDonation(request, minimum, maximum); err != nil {
		return SpaceCoinDonationReceipt{}, err
	}
	requestHash := ledgerutils.HashRequestFingerprint("space-coin-donation", request.SpaceID, request.Coins)
	var receipt SpaceCoinDonationReceipt
	err := databases.RunInMoneyTransaction(ctx, live.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		var err error
		receipt, err = live.donateSpaceCoinsInTransaction(ctx, transaction, request, requestHash)
		return err
	})
	return receipt, err
}

func (live LiveMoney) donateSpaceCoinsInTransaction(ctx context.Context, transaction *sql.Tx, request SpaceCoinDonationRequest, requestHash string) (SpaceCoinDonationReceipt, error) {
	if _, err := transaction.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "space-donation:"+request.SenderUserID+":"+request.IdempotencyKey); err != nil {
		return SpaceCoinDonationReceipt{}, err
	}
	donationTable := pgx.Identifier{live.Container.Settings.Money.DatabaseSchema, "space_coin_donations"}.Sanitize()
	var existing SpaceCoinDonationReceipt
	var existingHash string
	err := transaction.QueryRowContext(ctx, "SELECT id::text, ledger_entry_id::text, sender_user_id, host_user_id, space_id, coins, platform_fee_coins, creator_amount_coins, request_hash FROM "+donationTable+" WHERE sender_user_id = $1 AND idempotency_key = $2", request.SenderUserID, request.IdempotencyKey).Scan(
		&existing.DonationID, &existing.LedgerEntryID, &existing.SenderUserID, &existing.HostUserID, &existing.SpaceID,
		&existing.TotalCoins, &existing.PlatformFeeCoins, &existing.CreatorAmount, &existingHash,
	)
	if err == nil {
		if existingHash != requestHash {
			return SpaceCoinDonationReceipt{}, ErrIdempotencyKeyReused
		}
		existing.SenderBalance, err = live.Container.Ledger.ReadAccountBalance(ctx, transaction, ledgermodels.UserSpendableCoinsAccount(request.SenderUserID))
		existing.Replayed = true
		return existing, err
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return SpaceCoinDonationReceipt{}, err
	}

	var hostUserID, spaceState string
	var donationsEnabled bool
	spaceQuery := "SELECT host_id::text, state, gifts_enabled FROM " + pgx.Identifier{live.Container.Settings.LiveSchema, "spaces"}.Sanitize() + " WHERE id::text = $1 FOR SHARE"
	if err := transaction.QueryRowContext(ctx, spaceQuery, request.SpaceID).Scan(&hostUserID, &spaceState, &donationsEnabled); errors.Is(err, sql.ErrNoRows) {
		return SpaceCoinDonationReceipt{}, failedPrecondition("SPACE_DONATION_UNAVAILABLE", "This Space is unavailable.")
	} else if err != nil {
		return SpaceCoinDonationReceipt{}, err
	}
	if spaceState != "live" || !donationsEnabled {
		return SpaceCoinDonationReceipt{}, failedPrecondition("SPACE_DONATIONS_DISABLED", "Coin donations are not enabled for this live Space.")
	}
	if request.SenderUserID == hostUserID {
		return SpaceCoinDonationReceipt{}, failedPrecondition("CANNOT_DONATE_TO_SELF", "You cannot donate coins to yourself.")
	}
	programShareBps, approved, err := live.Program.ApprovedCreatorShare(ctx, transaction, hostUserID)
	if err != nil {
		return SpaceCoinDonationReceipt{}, err
	}
	if !approved {
		return SpaceCoinDonationReceipt{}, failedPrecondition("SPACE_HOST_NOT_CREATOR", "Only an approved creator can receive Space coin donations.")
	}
	blocked, err := live.Container.Directory.BlockedEitherWay(ctx, request.SenderUserID, hostUserID)
	if err != nil {
		return SpaceCoinDonationReceipt{}, err
	}
	if blocked {
		return SpaceCoinDonationReceipt{}, failedPrecondition("SPACE_DONATION_BLOCKED", "Coin donations are unavailable between these accounts.")
	}

	minimum, maximum := live.spaceDonationBounds()
	split, err := SpaceCoinDonationSplit(request.Coins, minimum, maximum, live.Container.Settings.Revenue.CoinTransferFeeBps)
	if err != nil {
		return SpaceCoinDonationReceipt{}, fmt.Errorf("invalid coin transfer fee configuration: %w", err)
	}
	creatorCoins, platformCoins := split.CreatorAmountCoins, split.PlatformFeeCoins
	// Keep the existing column's bounded Creator Program tier value for
	// compatibility; the authoritative transaction amounts above record the
	// configured coin-transfer fee split.
	share := programShareBps
	donationID := uuid.Must(uuid.NewV7())
	now := live.Container.Now().UTC()
	lines := []ledgermodels.JournalLineRequest{{Account: ledgermodels.UserSpendableCoinsAccount(request.SenderUserID), Direction: ledgermodels.Debit, AmountMinor: request.Coins}}
	if creatorCoins > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.CreatorEarnedCoinsAccount(hostUserID), Direction: ledgermodels.Credit, AmountMinor: creatorCoins})
	}
	if platformCoins > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.PlatformGiftRevenueCoinsAccount(), Direction: ledgermodels.Credit, AmountMinor: platformCoins})
	}
	posted, err := live.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: fmt.Sprintf("space-donation:%s:%s:%s", request.SpaceID, request.SenderUserID, request.IdempotencyKey),
		Kind:      "space.coinDonation.charged", Description: "Space coin donation",
		Metadata: map[string]any{"spaceCoinDonationId": donationID.String(), "spaceId": request.SpaceID, "hostUserId": hostUserID, "coins": request.Coins}, Lines: lines,
	})
	var insufficient *ledgermodels.InsufficientBalanceError
	if errors.As(err, &insufficient) {
		failure := failedPrecondition("INSUFFICIENT_COINS", "You don't have enough coins. Buy more coins and try again.")
		failure.CoinBalance = &insufficient.BalanceMinor
		return SpaceCoinDonationReceipt{}, failure
	}
	if err != nil {
		return SpaceCoinDonationReceipt{}, err
	}
	_, err = transaction.ExecContext(ctx, "INSERT INTO "+donationTable+" (id, created_at, sender_user_id, host_user_id, space_id, coins, platform_fee_coins, creator_amount_coins, creator_share_bps, idempotency_key, request_hash, ledger_entry_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
		donationID, now, request.SenderUserID, hostUserID, request.SpaceID, request.Coins, platformCoins, creatorCoins, share, request.IdempotencyKey, requestHash, posted.Id)
	if err != nil {
		return SpaceCoinDonationReceipt{}, err
	}
	if creatorCoins > 0 {
		if _, err := programservices.RecordEarning(ctx, live.Container.Client(transaction), programservices.Earning{
			CreatorId: hostUserID, Kind: creatorearning.KindTip, Reference: "space-donation:" + donationID.String(), SourceType: "space", SourceId: request.SpaceID,
			Description: "Space coin donation", GrossMinor: request.Coins, NetMinor: creatorCoins, Unit: programservices.CoinUnit, At: now,
		}); err != nil {
			return SpaceCoinDonationReceipt{}, err
		}
	}
	if err := live.Container.Outbox.EnqueueInTransaction(ctx, transaction, "spaceCoinDonation.committed", request.SpaceID, now, map[string]any{
		"spaceCoinDonationId": donationID.String(), "spaceId": request.SpaceID, "totalCoins": request.Coins,
		"creatorAmountCoins": creatorCoins, "senderUserId": request.SenderUserID, "hostUserId": hostUserID, "createdAt": now,
	}); err != nil {
		return SpaceCoinDonationReceipt{}, err
	}
	balance, _ := posted.BalanceAfter(ledgermodels.UserSpendableCoinsAccount(request.SenderUserID))
	return SpaceCoinDonationReceipt{DonationID: donationID.String(), LedgerEntryID: posted.Id.String(), SenderUserID: request.SenderUserID,
		HostUserID: hostUserID, SpaceID: request.SpaceID, TotalCoins: request.Coins, PlatformFeeCoins: platformCoins,
		CreatorAmount: creatorCoins, SenderBalance: balance}, nil
}
