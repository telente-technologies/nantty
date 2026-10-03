package application

import (
	"context"
	"log/slog"
	"time"

	"zudomart/modules/live/internal/domain"
	"zudomart/modules/live/internal/ent"
	battlerecord "zudomart/modules/live/internal/ent/battle"
	"zudomart/modules/live/internal/ent/battleparticipant"
	"zudomart/modules/live/internal/ent/guestslot"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"
)

const timerBatchSize = 50

func (application *LiveApplication) RunDueTimerSweepsUntilContextDone(ctx context.Context) error {
	ticker := time.NewTicker(application.Settings.TimerPollInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			for name, sweep := range map[string]func(context.Context) error{
				"guest slots": application.sweepDueGuestSlots, "battles": application.sweepDueBattles, "settlements": application.SettleDueBattles,
			} {
				if err := sweep(ctx); err != nil && ctx.Err() == nil {
					application.Logger.WarnContext(ctx, "timer sweep failed", slog.String("sweep", name), slog.Any("error", err))
				}
			}
		}
	}
}

func (application *LiveApplication) AdvanceDueTimersOnce(ctx context.Context) error {
	for _, sweep := range []func(context.Context) error{application.sweepDueGuestSlots, application.sweepDueBattles, application.SettleDueBattles} {
		if err := sweep(ctx); err != nil {
			return err
		}
	}
	return nil
}

func (application *LiveApplication) sweepDueGuestSlots(ctx context.Context) error {
	now := application.Now()
	due, err := application.Client.GuestSlot.Query().Where(guestslot.Or(
		guestslot.And(guestslot.StateEQ(guestslot.StateInvited), guestslot.ExpiresAtLTE(now)),
		guestslot.And(guestslot.StateIn(guestslot.StateJoining, guestslot.StateReconnecting), guestslot.StateDeadlineAtLTE(now)),
	)).Limit(timerBatchSize).IDs(ctx)
	if err != nil {
		return err
	}
	for _, slotId := range due {
		if err := application.expireOneSlot(ctx, slotId); err != nil {
			return err
		}
	}
	return nil
}

func (application *LiveApplication) expireOneSlot(ctx context.Context, slotId uuid.UUID) error {
	return application.runInTransaction(ctx, func(tx *ent.Tx) error {
		slot, err := tx.GuestSlot.Query().Where(guestslot.ID(slotId)).ForUpdate(sql.WithLockAction(sql.SkipLocked)).Only(ctx)
		if ent.IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}
		event, due := dueEventForSlot(slot, application.Now())
		if !due {
			return nil
		}
		session, err := application.lockLiveSession(ctx, tx, slot.LiveID)
		if err != nil {
			return err
		}
		if slot, err = application.applySlotEvent(ctx, tx, slot, event); err != nil {
			return err
		}
		if slot.State == guestslot.StateLeft {
			if err := application.departFromBattle(ctx, tx, session, slot.UserID, false); err != nil {
				return err
			}
			if err := application.emitGuestChanged(ctx, tx, eventGuestLeft, slot, "reconnectTimeout"); err != nil {
				return err
			}
		}
		return application.emitStageUpdated(ctx, tx, slot.LiveID)
	})
}

func dueEventForSlot(slot *ent.GuestSlot, now time.Time) (domain.GuestSlotEvent, bool) {
	switch slot.State {
	case guestslot.StateInvited:
		return domain.InvitationExpires, !now.Before(slot.ExpiresAt)
	case guestslot.StateJoining:
		return domain.GuestJoinTimesOut, slot.StateDeadlineAt != nil && !now.Before(*slot.StateDeadlineAt)
	case guestslot.StateReconnecting:
		return domain.ReconnectTimesOut, slot.StateDeadlineAt != nil && !now.Before(*slot.StateDeadlineAt)
	}
	return "", false
}

func (application *LiveApplication) sweepDueBattles(ctx context.Context) error {
	now := application.Now()
	due, err := application.Client.Battle.Query().Where(battlerecord.Or(
		battlerecord.And(battlerecord.StateEQ(battlerecord.StatePending), battlerecord.ProposalExpiresAtLTE(now)),
		battlerecord.And(battlerecord.StateEQ(battlerecord.StateCountdown), battlerecord.StartsAtLTE(now)),
		battlerecord.And(battlerecord.StateEQ(battlerecord.StateActive), battlerecord.EndsAtLTE(now)),
	)).Limit(timerBatchSize).IDs(ctx)
	if err != nil {
		return err
	}
	for _, battleId := range due {
		if err := application.advanceOneBattle(ctx, battleId); err != nil {
			return err
		}
	}
	return nil
}

func (application *LiveApplication) advanceOneBattle(ctx context.Context, battleId uuid.UUID) error {
	return application.runInTransaction(ctx, func(tx *ent.Tx) error {
		battle, err := tx.Battle.Query().Where(battlerecord.ID(battleId)).ForUpdate(sql.WithLockAction(sql.SkipLocked)).Only(ctx)
		if ent.IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}
		now := application.Now()
		switch battle.State {
		case battlerecord.StateCountdown:
			if battle.StartsAt != nil && !now.Before(*battle.StartsAt) {
				return application.activateBattle(ctx, tx, battle)
			}
		case battlerecord.StateActive:
			if battle.EndsAt != nil && !now.Before(*battle.EndsAt) {
				return application.endBattleInTransaction(ctx, tx, battle, domain.TimerElapsed, domain.EndedByTimer)
			}
		case battlerecord.StatePending:
			return application.expireProposal(ctx, tx, battle, now)
		}
		return nil
	})
}

func (application *LiveApplication) activateBattle(ctx context.Context, tx *ent.Tx, battle *ent.Battle) error {
	update, err := application.moveBattle(battle, domain.CountdownElapsed)
	if err != nil {
		return err
	}
	active, err := update.Save(ctx)
	if err != nil {
		return err
	}
	return application.emitStageUpdated(ctx, tx, active.LiveID)
}

func (application *LiveApplication) expireProposal(ctx context.Context, tx *ent.Tx, battle *ent.Battle, now time.Time) error {
	if battle.HostDecisionDeadlineAt != nil && !now.Before(*battle.HostDecisionDeadlineAt) {
		return application.cancelBattle(ctx, tx, battle, domain.ProposalAbandoned, "hostDidNotDecide")
	}
	if battle.ProposalExpiresAt == nil || now.Before(*battle.ProposalExpiresAt) {
		return nil
	}
	changed, err := tx.BattleParticipant.Update().Where(battleparticipant.BattleID(battle.ID), battleparticipant.ConsentEQ(battleparticipant.ConsentPending)).
		SetConsent(battleparticipant.ConsentDeclined).Save(ctx)
	if err != nil || changed == 0 {
		return err
	}
	return application.emitStageUpdated(ctx, tx, battle.LiveID)
}
