package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	programservices "nantty/modules/creators/src/modules/creatorProgram/services"
	"nantty/modules/ledger/src/databases"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	ledgerutils "nantty/modules/ledger/src/utils"
)

// BattleCoinContributionRequest has no client-supplied price or recipient policy.
// The recipient is checked against the active battle and Creator Program in the
// same money transaction that debits the sender and funds the battle holding.
type BattleCoinContributionRequest struct {
	SenderUserID    string
	RecipientUserID string
	BattleID        string
	Coins           int64
	IdempotencyKey  string
}

type BattleCoinContributionReceipt struct {
	ContributionID   string
	LedgerEntryID    string
	SenderUserID     string
	RecipientUserID  string
	BattleID         string
	LiveID           string
	TotalCoins       int64
	PlatformFeeCoins int64
	HoldingCoins     int64
	SenderBalance    int64
	Replayed         bool
}

func (live LiveMoney) battleContributionBounds() (int64, int64) {
	minimum, maximum := live.Container.Settings.BattleContributionMinimumCoins, live.Container.Settings.BattleContributionMaximumCoins
	if minimum < 1 || maximum < minimum || maximum > 1<<62 {
		return 1, 10000
	}
	return minimum, maximum
}

func validateBattleCoinContribution(request BattleCoinContributionRequest, minimum, maximum int64) error {
	if request.SenderUserID == "" || request.RecipientUserID == "" || request.BattleID == "" ||
		len(request.SenderUserID) > 80 || len(request.RecipientUserID) > 80 || len(request.BattleID) > 80 ||
		!ledgerutils.IsValidIdempotencyKey(request.IdempotencyKey) {
		return invalidArgument("sender, recipient, battle and a valid idempotency key are required")
	}
	if _, err := uuid.Parse(request.SenderUserID); err != nil {
		return invalidArgument("sender_user_id must be a UUID")
	}
	if _, err := uuid.Parse(request.RecipientUserID); err != nil {
		return invalidArgument("recipient_user_id must be a UUID")
	}
	if _, err := uuid.Parse(request.BattleID); err != nil {
		return invalidArgument("battle_id must be a UUID")
	}
	if request.Coins < minimum || request.Coins > maximum {
		return &LiveMoneyError{Reason: "INVALID_BATTLE_CONTRIBUTION_AMOUNT", Message: "Coins are outside the configured battle contribution limits.", MinimumCoins: minimum, MaximumCoins: maximum}
	}
	if request.SenderUserID == request.RecipientUserID {
		return failedPrecondition("CANNOT_CONTRIBUTE_TO_SELF", "You cannot contribute coins to yourself.")
	}
	return nil
}

func (live LiveMoney) ContributeBattleCoins(ctx context.Context, request BattleCoinContributionRequest) (BattleCoinContributionReceipt, error) {
	minimum, maximum := live.battleContributionBounds()
	if err := validateBattleCoinContribution(request, minimum, maximum); err != nil {
		return BattleCoinContributionReceipt{}, err
	}
	feeBps := live.Container.Settings.Revenue.CoinTransferFeeBps
	if feeBps < 0 || feeBps > 10000 {
		return BattleCoinContributionReceipt{}, invalidArgument("coin transfer fee configuration must be between 0 and 10000 basis points")
	}
	requestHash := ledgerutils.HashRequestFingerprint("live-battle-coin-contribution", request.RecipientUserID, request.BattleID, request.Coins)
	var receipt BattleCoinContributionReceipt
	err := databases.RunInMoneyTransaction(ctx, live.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		var err error
		receipt, err = live.contributeBattleCoinsInTransaction(ctx, transaction, request, requestHash, feeBps)
		return err
	})
	return receipt, err
}

func (live LiveMoney) contributeBattleCoinsInTransaction(ctx context.Context, transaction *sql.Tx, request BattleCoinContributionRequest, requestHash string, feeBps int64) (BattleCoinContributionReceipt, error) {
	if _, err := transaction.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "battle-coin-contribution:"+request.SenderUserID+":"+request.IdempotencyKey); err != nil {
		return BattleCoinContributionReceipt{}, err
	}
	table := pgx.Identifier{live.Container.Settings.Money.DatabaseSchema, "live_battle_coin_contributions"}.Sanitize()
	var existing BattleCoinContributionReceipt
	var existingHash string
	err := transaction.QueryRowContext(ctx, "SELECT id::text, ledger_entry_id::text, sender_user_id, recipient_user_id, battle_id, live_id, coins, platform_fee_coins, holding_coins, request_hash FROM "+table+" WHERE sender_user_id = $1 AND idempotency_key = $2", request.SenderUserID, request.IdempotencyKey).Scan(
		&existing.ContributionID, &existing.LedgerEntryID, &existing.SenderUserID, &existing.RecipientUserID, &existing.BattleID, &existing.LiveID,
		&existing.TotalCoins, &existing.PlatformFeeCoins, &existing.HoldingCoins, &existingHash,
	)
	if err == nil {
		if existingHash != requestHash {
			return BattleCoinContributionReceipt{}, ErrIdempotencyKeyReused
		}
		existing.SenderBalance, err = live.Container.Ledger.ReadAccountBalance(ctx, transaction, ledgermodels.UserSpendableCoinsAccount(request.SenderUserID))
		existing.Replayed = true
		return existing, err
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return BattleCoinContributionReceipt{}, err
	}

	// Verify the live session and battle again inside the ledger transaction. This
	// prevents a stale API-layer check from funding a battle that has ended.
	var liveID, hostID, battleState, sessionState string
	var startsAt, endsAt sql.NullTime
	query := "SELECT b.live_id::text, b.host_id::text, b.state, b.starts_at, b.ends_at, ls.state FROM " +
		pgx.Identifier{live.Container.Settings.LiveSchema, "battles"}.Sanitize() + " b JOIN " +
		pgx.Identifier{live.Container.Settings.LiveSchema, "live_sessions"}.Sanitize() + " ls ON ls.id = b.live_id WHERE b.id::text = $1 FOR SHARE OF b, ls"
	if err := transaction.QueryRowContext(ctx, query, request.BattleID).Scan(&liveID, &hostID, &battleState, &startsAt, &endsAt, &sessionState); errors.Is(err, sql.ErrNoRows) {
		return BattleCoinContributionReceipt{}, failedPrecondition("BATTLE_NOT_ACTIVE", "This battle is not active.")
	} else if err != nil {
		return BattleCoinContributionReceipt{}, err
	}
	now := live.Container.Now().UTC()
	if sessionState != "live" || battleState != "active" || !startsAt.Valid || !endsAt.Valid || now.Before(startsAt.Time) || !now.Before(endsAt.Time) {
		return BattleCoinContributionReceipt{}, failedPrecondition("BATTLE_NOT_ACTIVE", "This battle is not active.")
	}
	participantQuery := "SELECT count(*) FROM " + pgx.Identifier{live.Container.Settings.LiveSchema, "battle_participants"}.Sanitize() + " WHERE battle_id::text = $1 AND state = 'active' AND user_id::text IN ($2, $3)"
	var participantCount int
	if err := transaction.QueryRowContext(ctx, participantQuery, request.BattleID, request.SenderUserID, request.RecipientUserID).Scan(&participantCount); err != nil {
		return BattleCoinContributionReceipt{}, err
	}
	if participantCount != 2 {
		return BattleCoinContributionReceipt{}, failedPrecondition("BATTLE_PARTICIPANT_INACTIVE", "Both sender and recipient must be active participants in this battle.")
	}

	// Reuse the authoritative Creator Program policy used by gifts and battle
	// settlement. It may resolve the payout owner to the live host when policy
	// requires it; the contribution itself remains attributed to the participant.
	if _, _, err := live.Program.ResolveCreditedCreator(ctx, transaction, request.RecipientUserID, hostID); errors.Is(err, programservices.ErrRecipientCannotReceiveGifts) {
		return BattleCoinContributionReceipt{}, failedPrecondition("RECIPIENT_CANNOT_RECEIVE_COINS", "This battle participant is not eligible to receive coin contributions.")
	} else if err != nil {
		return BattleCoinContributionReceipt{}, err
	}

	// Quotient/remainder avoids overflowing coins * feeBps for configured large
	// but bounded amounts. Remainder follows the platform's existing floor rule.
	fee := request.Coins/10000*feeBps + request.Coins%10000*feeBps/10000
	holding := request.Coins - fee
	contributionID := uuid.Must(uuid.NewV7())
	now = live.Container.Now().UTC()
	lines := []ledgermodels.JournalLineRequest{{Account: ledgermodels.UserSpendableCoinsAccount(request.SenderUserID), Direction: ledgermodels.Debit, AmountMinor: request.Coins}}
	if holding > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.BattleHoldingCoinsAccount(request.BattleID, request.RecipientUserID), Direction: ledgermodels.Credit, AmountMinor: holding})
	}
	if fee > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.PlatformGiftRevenueCoinsAccount(), Direction: ledgermodels.Credit, AmountMinor: fee})
	}
	posted, err := live.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: fmt.Sprintf("battle-coin-contribution:%s:%s:%s", request.BattleID, request.SenderUserID, request.IdempotencyKey),
		Kind:      "live.battleCoinContribution", Description: "Live battle coin contribution",
		Metadata: map[string]any{"contributionId": contributionID.String(), "battleId": request.BattleID, "liveId": liveID, "senderUserId": request.SenderUserID, "recipientUserId": request.RecipientUserID, "coins": request.Coins},
		Lines:    lines,
	})
	var insufficient *ledgermodels.InsufficientBalanceError
	if errors.As(err, &insufficient) {
		failure := failedPrecondition("INSUFFICIENT_COINS", "You don't have enough coins.")
		failure.CoinBalance = &insufficient.BalanceMinor
		return BattleCoinContributionReceipt{}, failure
	}
	if err != nil {
		return BattleCoinContributionReceipt{}, err
	}
	_, err = transaction.ExecContext(ctx, "INSERT INTO "+table+" (id, created_at, sender_user_id, recipient_user_id, battle_id, live_id, coins, platform_fee_coins, holding_coins, idempotency_key, request_hash, ledger_entry_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
		contributionID, now, request.SenderUserID, request.RecipientUserID, request.BattleID, liveID, request.Coins, fee, holding, request.IdempotencyKey, requestHash, posted.Id)
	if err != nil {
		return BattleCoinContributionReceipt{}, err
	}
	if err := live.Container.Outbox.EnqueueInTransaction(ctx, transaction, "liveBattleCoinContribution.committed", request.BattleID, now, map[string]any{
		"contributionId": contributionID.String(), "battleId": request.BattleID, "liveId": liveID,
		"senderUserId": request.SenderUserID, "recipientUserId": request.RecipientUserID, "coins": request.Coins,
		"platformFeeCoins": fee, "holdingCoins": holding, "createdAt": now,
	}); err != nil {
		return BattleCoinContributionReceipt{}, err
	}
	balance, _ := posted.BalanceAfter(ledgermodels.UserSpendableCoinsAccount(request.SenderUserID))
	return BattleCoinContributionReceipt{ContributionID: contributionID.String(), LedgerEntryID: posted.Id.String(), SenderUserID: request.SenderUserID,
		RecipientUserID: request.RecipientUserID, BattleID: request.BattleID, LiveID: liveID, TotalCoins: request.Coins,
		PlatformFeeCoins: fee, HoldingCoins: holding, SenderBalance: balance}, nil
}
