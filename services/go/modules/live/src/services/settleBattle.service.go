package services

import (
	"context"
	"errors"
	"fmt"
	"nantty/modules/live/src/events"
	"nantty/modules/live/src/interfaces"
	"nantty/modules/live/src/types"
	"time"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"

	"nantty/modules/live/src/generated/ent"
	battlerecord "nantty/modules/live/src/generated/ent/battle"
	"nantty/modules/live/src/generated/ent/predicate"
)

const settlementCallTimeout = 10 * time.Second

const (
	maxBattleSettlementAttempts = 8
	battleSettlementLease       = 30 * time.Second
	battleSettlementRetryBase   = 250 * time.Millisecond
	battleSettlementRetryMax    = 30 * time.Second
)

func (service *LiveService) SettleEndedBattlesForLive(ctx context.Context, liveId uuid.UUID) error {
	identifiers, err := service.Client.Battle.Query().Where(battlerecord.LiveID(liveId), dueBattleSettlement(service.Now())).Order(ent.Asc(battlerecord.FieldEndsAt)).Limit(20).IDs(ctx)
	if err != nil {
		return err
	}
	return service.settleEach(ctx, identifiers)
}

func (service *LiveService) SettleDueBattles(ctx context.Context) error {
	identifiers, err := service.Client.Battle.Query().Where(dueBattleSettlement(service.Now())).Order(ent.Asc(battlerecord.FieldEndsAt)).Limit(20).IDs(ctx)
	if err != nil {
		return err
	}
	return service.settleEach(ctx, identifiers)
}

func (service *LiveService) settleEach(ctx context.Context, identifiers []uuid.UUID) error {
	var firstFailure error
	for _, identifier := range identifiers {
		if err := service.SettleBattle(ctx, identifier); err != nil && firstFailure == nil {
			firstFailure = err
		}
	}
	return firstFailure
}

func (service *LiveService) SettleBattle(ctx context.Context, battleId uuid.UUID) error {
	claim, err := service.claimBattleSettlement(ctx, battleId)
	if err != nil || claim == nil {
		return err
	}

	callContext, cancel := context.WithTimeout(ctx, settlementCallTimeout)
	settlement, err := service.Money.SettleBattle(callContext, claim.request)
	cancel()
	if err != nil {
		if releaseErr := service.retryBattleSettlement(ctx, battleId, claim.token, claim.attempt); releaseErr != nil {
			return errors.Join(fmt.Errorf("settle battle %s: %w", battleId, err), fmt.Errorf("record settlement retry: %w", releaseErr))
		}
		return fmt.Errorf("settle battle %s: %w", battleId, err)
	}

	return service.commitBattleSettlement(ctx, battleId, claim, settlement)
}

type battleSettlementClaim struct {
	request interfaces.SettleBattleRequest
	rows    []*ent.BattleParticipant
	token   string
	attempt int
}

func dueBattleSettlement(now time.Time) predicate.Battle {
	return battlerecord.And(
		battlerecord.StateEQ(battlerecord.StateEnded),
		battlerecord.SettlementAttemptsLT(maxBattleSettlementAttempts),
		battlerecord.Or(battlerecord.SettlementLeaseUntilIsNil(), battlerecord.SettlementLeaseUntilLTE(now)),
		battlerecord.Or(battlerecord.SettlementNextAttemptAtIsNil(), battlerecord.SettlementNextAttemptAtLTE(now)),
	)
}

// Claim in a short transaction, call the idempotent ledger with no database
// transaction open, and finalize in a second short transaction. An expired
// lease recovers claims left behind by a crashed process.
func (service *LiveService) claimBattleSettlement(ctx context.Context, battleId uuid.UUID) (*battleSettlementClaim, error) {
	var claim *battleSettlementClaim
	err := service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := service.Now()
		row, err := tx.Battle.Query().Where(battlerecord.ID(battleId), dueBattleSettlement(now)).ForUpdate(sql.WithLockAction(sql.SkipLocked)).Only(ctx)
		if ent.IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}
		rows, err := service.loadParticipants(ctx, tx, battleId)
		if err != nil {
			return err
		}
		token := uuid.NewString()
		attempt := row.SettlementAttempts + 1
		if _, err := row.Update().SetSettlementAttempts(attempt).SetSettlementLeaseUntil(now.Add(battleSettlementLease)).SetSettlementLeaseToken(token).ClearSettlementNextAttemptAt().Save(ctx); err != nil {
			return err
		}
		claim = &battleSettlementClaim{request: buildSettlementRequest(row, rows), rows: rows, token: token, attempt: attempt}
		return nil
	})
	return claim, err
}

func (service *LiveService) retryBattleSettlement(ctx context.Context, battleId uuid.UUID, token string, attempt int) error {
	return service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := service.lockBattle(ctx, tx, battleId)
		if err != nil || row.State != battlerecord.StateEnded || row.SettlementLeaseToken == nil || *row.SettlementLeaseToken != token {
			return err
		}
		update := row.Update().ClearSettlementLeaseUntil().ClearSettlementLeaseToken()
		if attempt < maxBattleSettlementAttempts {
			update.SetSettlementNextAttemptAt(service.Now().Add(battleSettlementRetryDelay(attempt)))
		} else {
			update.ClearSettlementNextAttemptAt()
			service.Logger.ErrorContext(ctx, "battle settlement retries exhausted; operator recovery required", "battle_id", battleId.String(), "attempts", attempt)
		}
		_, err = update.Save(ctx)
		return err
	})
}

func battleSettlementRetryDelay(attempt int) time.Duration {
	if attempt < 1 {
		attempt = 1
	}
	delay := battleSettlementRetryBase
	for step := 1; step < attempt; step++ {
		if delay >= battleSettlementRetryMax/2 {
			return battleSettlementRetryMax
		}
		delay *= 2
	}
	return delay
}

func (service *LiveService) commitBattleSettlement(ctx context.Context, battleId uuid.UUID, claim *battleSettlementClaim, settlement interfaces.BattleSettlement) error {
	return service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := service.lockBattle(ctx, tx, battleId)
		if err != nil || row.State == battlerecord.StateSettled {
			return err
		}
		if row.State != battlerecord.StateEnded || row.SettlementLeaseToken == nil || *row.SettlementLeaseToken != claim.token {
			return nil // A newer lease owns recovery; ledger idempotency makes its retry safe.
		}
		next, err := NextBattleState(BattleState(row.State), SettlementCommitted)
		if err != nil {
			return err
		}
		stored := buildStoredSettlement(claim.rows, settlement)
		settledAt := settlement.SettledAt
		if settledAt.IsZero() {
			settledAt = service.Now()
		}
		saved, err := row.Update().SetState(battlerecord.State(next)).SetSettledAt(settledAt).
			SetSettlement(writeStoredSettlement(stored)).ClearSettlementLeaseUntil().ClearSettlementLeaseToken().ClearSettlementNextAttemptAt().Save(ctx)
		if err != nil {
			return err
		}
		return service.announceSettlement(ctx, tx, saved, stored)
	})
}

func buildSettlementRequest(battle *ent.Battle, rows []*ent.BattleParticipant) interfaces.SettleBattleRequest {
	request := interfaces.SettleBattleRequest{BattleId: battle.ID.String(), LiveId: battle.LiveID.String(), HostUserId: battle.HostID.String(), Rule: interfaces.SettlementRuleKeepOwn}
	if len(battle.WinnerUserIds) == 1 {
		request.WinnerUserId = battle.WinnerUserIds[0]
		if battle.WinnerTakesAll {
			request.Rule = interfaces.SettlementRuleWinnerTA
		}
	}
	for _, row := range rows {
		outcome := interfaces.OutcomeActive
		switch {
		case row.RemovedByHost:
			outcome = interfaces.OutcomeRemovedByHost
		case string(row.State) == string(ParticipantForfeited), string(row.State) == string(ParticipantLeft):
			outcome = interfaces.OutcomeForfeited
		}
		request.Participants = append(request.Participants, interfaces.SettlementParticipant{UserId: row.UserID.String(), Outcome: outcome})
	}
	return request
}

func buildStoredSettlement(rows []*ent.BattleParticipant, settlement interfaces.BattleSettlement) StoredSettlement {
	stored := StoredSettlement{RuleApplied: settlement.RuleApplied, LedgerTransactionId: settlement.LedgerTransactionId}
	earned := map[string]int64{}
	for _, payout := range settlement.Payouts {
		earned[payout.CreditedUserId] += payout.HoldingCoins
	}
	paidTo := map[string]string{}
	for _, payout := range settlement.Payouts {
		paidTo[payout.UserId] = payout.CreditedUserId
	}
	moved := map[string]bool{}
	for _, transfer := range settlement.Transfers {
		stored.Transfers = append(stored.Transfers, types.BattleTransferView{FromUserId: transfer.FromUserId, ToUserId: transfer.ToUserId, Coins: transfer.Coins})
		moved[transfer.FromUserId] = true
	}
	for _, row := range rows {
		user := row.UserID.String()
		recipient := paidTo[user]
		if moved[user] || recipient == "" {
			recipient = user
		}
		stored.Payouts = append(stored.Payouts, types.BattlePayoutView{UserId: user, Score: row.Score, EarnedCoins: earned[user], PaidToUserId: recipient})
	}
	return stored
}

func (service *LiveService) announceSettlement(ctx context.Context, tx *ent.Tx, battle *ent.Battle, stored StoredSettlement) error {
	now := service.Now()
	liveId, battleId := battle.LiveID.String(), battle.ID.String()
	if len(stored.Transfers) > 0 {
		err := events.EnqueueOutboxEventInTransaction(ctx, tx, events.BattleSettled, liveId, now, map[string]any{"liveId": liveId, "battleId": battleId, "transfers": stored.Transfers})
		if err != nil {
			return err
		}
	}
	if len(battle.WinnerUserIds) == 1 {
		view, err := service.presentBattle(ctx, tx.Client(), battle)
		if err != nil {
			return err
		}
		err = events.EnqueueOutboxEventInTransaction(ctx, tx, events.BattleWinnerCelebrated, liveId, now, map[string]any{
			"liveId": liveId, "battleId": battleId, "winnerUserIds": battle.WinnerUserIds, "mvpGifter": view.MvpGifter, "animationAssetId": events.WinnerCelebrationAnimationId,
		})
		if err != nil {
			return err
		}
	}
	return service.emitStageUpdated(ctx, tx, battle.LiveID)
}
