package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"nantty/modules/creators/src/container"
	"nantty/modules/creators/src/generated/ent"
	"nantty/modules/creators/src/generated/ent/tiptransaction"
	programservices "nantty/modules/creators/src/modules/creatorProgram/services"
	"nantty/modules/creators/src/modules/liveMoney/models"
	"nantty/modules/creators/src/repositories"
	"nantty/modules/ledger/src/databases"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/platform/httpserver"
)

const MaximumTipCoins = 100_000

var (
	ErrTipTargetNotFound   = httpserver.NewApiError(http.StatusNotFound, "TARGET_NOT_FOUND", "This post or live was not found.")
	ErrCannotTipSelf       = httpserver.NewApiError(http.StatusUnprocessableEntity, "CANNOT_TIP_SELF", "You cannot tip yourself.")
	ErrTipBlocked          = httpserver.NewApiError(http.StatusUnprocessableEntity, "TIP_BLOCKED", "You cannot tip this creator.")
	ErrCreatorCannotEarn   = httpserver.NewApiError(http.StatusUnprocessableEntity, "RECIPIENT_CANNOT_RECEIVE_TIPS", "This creator isn't in the Creator Program yet.")
	ErrTipLiveNotActive    = httpserver.NewApiError(http.StatusUnprocessableEntity, "LIVE_NOT_ACTIVE", "This live has ended.")
	ErrLiveCoinSupportOff  = httpserver.NewApiError(http.StatusUnprocessableEntity, "LIVE_COIN_SUPPORT_DISABLED", "This host isn't accepting coin support right now.")
	ErrCreatorProgramOnly  = httpserver.NewApiError(http.StatusForbidden, "CREATOR_PROGRAM_REQUIRED", "This is available to approved creators.")
	ErrTipIdempotencyReuse = ledgerutils.ErrIdempotencyKeyReused
)

var ErrInsufficientCoins = httpserver.NewApiError(http.StatusUnprocessableEntity, "INSUFFICIENT_COINS", "You don't have enough coins. Buy more coins and try again.")

type CreatorMoney struct {
	Container *container.Container
	Program   programservices.CreatorProgram
}

type TipRequest struct {
	SenderId       string
	TargetType     string
	TargetId       string
	Coins          int64
	IdempotencyKey string
}

type TipReceipt struct {
	TipId       string `json:"tipId"`
	TargetType  string `json:"targetType"`
	TargetId    string `json:"targetId"`
	Coins       int64  `json:"coins"`
	Balance     int64  `json:"balance"`
	CoinBalance int64  `json:"coinBalance"`
	Replayed    bool   `json:"-"`
}

func (money CreatorMoney) resolveTipCreator(ctx context.Context, request TipRequest) (string, error) {
	if request.TargetType == "profile" {
		if _, err := uuid.Parse(request.TargetId); err != nil {
			return "", ErrTipTargetNotFound
		}
		return request.TargetId, nil
	}
	directory := money.Container.Directory
	if request.TargetType == "live" {
		live, found, err := directory.FindLive(ctx, request.TargetId)
		if err != nil {
			return "", err
		}
		if !found {
			return "", ErrTipTargetNotFound
		}
		if live.State != "live" {
			return "", ErrTipLiveNotActive
		}
		return live.HostId, nil
	}
	owner, err := directory.ContentOwner(ctx, request.TargetType, request.TargetId)
	if errors.Is(err, repositories.ErrTargetNotFound) {
		return "", ErrTipTargetNotFound
	}
	return owner, err
}

func (money CreatorMoney) SendTip(ctx context.Context, request TipRequest) (TipReceipt, error) {
	creatorId, err := money.resolveTipCreator(ctx, request)
	if err != nil {
		return TipReceipt{}, err
	}
	if creatorId == request.SenderId {
		return TipReceipt{}, ErrCannotTipSelf
	}
	blocked, err := money.Container.Directory.BlockedEitherWay(ctx, request.SenderId, creatorId)
	if err != nil {
		return TipReceipt{}, err
	}
	if blocked {
		return TipReceipt{}, ErrTipBlocked
	}
	requestHash := ledgerutils.HashRequestFingerprint(request.TargetType, request.TargetId, request.Coins)
	var receipt TipReceipt
	err = databases.RunInMoneyTransaction(ctx, money.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		receipt, err = money.sendTipInTransaction(ctx, transaction, request, creatorId, requestHash)
		return err
	})
	return receipt, err
}

func (money CreatorMoney) sendTipInTransaction(ctx context.Context, transaction *sql.Tx, request TipRequest, creatorId, requestHash string) (TipReceipt, error) {
	client := money.Container.Client(transaction)
	if _, err := client.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "tip:"+request.SenderId+":"+request.IdempotencyKey); err != nil {
		return TipReceipt{}, err
	}
	spendable := ledgermodels.UserSpendableCoinsAccount(request.SenderId)
	existing, err := client.TipTransaction.Query().Where(tiptransaction.SenderUserID(request.SenderId), tiptransaction.IdempotencyKey(request.IdempotencyKey)).Only(ctx)
	if err == nil {
		if existing.RequestHash != requestHash {
			return TipReceipt{}, ErrTipIdempotencyReuse
		}
		balance, err := money.Container.Ledger.ReadAccountBalance(ctx, transaction, spendable)
		return TipReceipt{TipId: existing.ID.String(), TargetType: request.TargetType, TargetId: request.TargetId, Coins: existing.Coins, Balance: balance, CoinBalance: balance, Replayed: true}, err
	}
	if !ent.IsNotFound(err) {
		return TipReceipt{}, err
	}
	if request.TargetType == "live" {
		if err := money.lockAndValidateLiveCoinSupport(ctx, transaction, request.TargetId, creatorId); err != nil {
			return TipReceipt{}, err
		}
	}
	share, approved, err := money.Program.ApprovedCreatorShare(ctx, transaction, creatorId)
	if err != nil {
		return TipReceipt{}, err
	}
	if !approved {
		return TipReceipt{}, ErrCreatorCannotEarn
	}
	split, err := splitTipCoins(request.TargetType, request.Coins, share, money.Container.Settings.Revenue.CoinTransferFeeBps)
	if err != nil {
		if errors.Is(err, models.ErrInvalidCoinFeeBps) {
			return TipReceipt{}, fmt.Errorf("invalid coin transfer fee configuration: %w", err)
		}
		return TipReceipt{}, httpserver.NewApiError(http.StatusBadRequest, "VALIDATION_FAILED", "coins must be 1-100000")
	}
	tipId := uuid.Must(uuid.NewV7())
	lines := []ledgermodels.JournalLineRequest{{Account: spendable, Direction: ledgermodels.Debit, AmountMinor: split.TotalCoins}}
	if split.CreatorAmountCoins > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.CreatorEarnedCoinsAccount(creatorId), Direction: ledgermodels.Credit, AmountMinor: split.CreatorAmountCoins})
	}
	if split.PlatformFeeCoins > 0 {
		lines = append(lines, ledgermodels.JournalLineRequest{Account: ledgermodels.PlatformGiftRevenueCoinsAccount(), Direction: ledgermodels.Credit, AmountMinor: split.PlatformFeeCoins})
	}
	posted, err := money.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "tip:" + request.SenderId + ":" + request.IdempotencyKey, Kind: "tip.charged", Description: "Tip to a creator", Lines: lines,
		Metadata: map[string]any{"tipId": tipId.String(), "targetType": request.TargetType, "targetId": request.TargetId, "creatorId": creatorId},
	})
	var insufficient *ledgermodels.InsufficientBalanceError
	if errors.As(err, &insufficient) {
		return TipReceipt{}, ErrInsufficientCoins
	}
	if err != nil {
		return TipReceipt{}, err
	}
	now := money.Container.Now().UTC()
	if err := client.TipTransaction.Create().SetID(tipId).SetSenderUserID(request.SenderId).SetCreatorUserID(creatorId).SetTargetType(tiptransaction.TargetType(request.TargetType)).
		SetTargetID(request.TargetId).SetCoins(split.TotalCoins).SetCreatorCoins(split.CreatorAmountCoins).SetPlatformFeeCoins(split.PlatformFeeCoins).
		SetCreatorShareBps(split.CreatorShareBps).SetIdempotencyKey(request.IdempotencyKey).SetRequestHash(requestHash).SetLedgerEntryID(posted.Id.String()).SetCreatedAt(now).Exec(ctx); err != nil {
		return TipReceipt{}, err
	}
	if _, err := programservices.RecordEarning(ctx, client, programservices.Earning{
		CreatorId: creatorId, Kind: "tip", Reference: "tip:" + tipId.String(), SourceType: request.TargetType, SourceId: request.TargetId, Description: "Tip",
		GrossMinor: split.TotalCoins, NetMinor: split.CreatorAmountCoins, Unit: programservices.CoinUnit, At: now,
	}); err != nil {
		return TipReceipt{}, err
	}
	if err := money.Container.Outbox.EnqueueInTransaction(ctx, transaction, "tip.sent", creatorId, now, map[string]any{
		"tipId": tipId.String(), "senderUserId": request.SenderId, "creatorUserId": creatorId, "targetType": request.TargetType, "targetId": request.TargetId,
		"coins": split.TotalCoins, "creatorCoins": split.CreatorAmountCoins, "createdAt": now.Format(time.RFC3339),
	}); err != nil {
		return TipReceipt{}, err
	}
	balance, _ := posted.BalanceAfter(spendable)
	return TipReceipt{TipId: tipId.String(), TargetType: request.TargetType, TargetId: request.TargetId, Coins: split.TotalCoins, Balance: balance, CoinBalance: balance}, nil
}

func splitTipCoins(targetType string, coins, creatorShareBps, platformFeeBps int64) (models.GiftSplit, error) {
	if targetType == "live" {
		return models.SplitCoinsByPlatformFeeBps(coins, platformFeeBps)
	}
	return models.SplitGiftCoins(1, coins, creatorShareBps)
}

// lockAndValidateLiveCoinSupport re-checks the live session after taking a
// row-level share lock in the posting transaction. A concurrent host toggle
// or live-end update must serialize with this coin transfer.
func (money CreatorMoney) lockAndValidateLiveCoinSupport(ctx context.Context, transaction *sql.Tx, liveId, creatorId string) error {
	table := pgx.Identifier{money.Container.Settings.LiveSchema, "live_sessions"}.Sanitize()
	var hostId, state string
	var supportEnabled bool
	err := transaction.QueryRowContext(ctx, "SELECT host_id::text, state::text, gifts_enabled FROM "+table+" WHERE id::text = $1 FOR SHARE", liveId).
		Scan(&hostId, &state, &supportEnabled)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrTipTargetNotFound
	}
	if err != nil {
		return err
	}
	if hostId != creatorId {
		return ErrTipTargetNotFound
	}
	if state != "live" {
		return ErrTipLiveNotActive
	}
	if !supportEnabled {
		return ErrLiveCoinSupportOff
	}
	return nil
}
