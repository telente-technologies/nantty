package services

import (
	"context"
	"log/slog"
	"nantty/modules/live/src/events"
	"time"

	"nantty/modules/live/src/generated/ent"
	battlerecord "nantty/modules/live/src/generated/ent/battle"
	"nantty/modules/live/src/generated/ent/battleparticipant"
	"nantty/modules/live/src/generated/ent/guestslot"

	"entgo.io/ent/dialect/sql"
	"github.com/google/uuid"
)

const timerBatchSize = 50

func (service *LiveService) RunDueTimerSweepsUntilContextDone(ctx context.Context) error {
	ticker := time.NewTicker(service.Settings.TimerPollInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			for name, sweep := range map[string]func(context.Context) error{
				"guest slots": service.sweepDueGuestSlots, "silent hosts": service.sweepSilentHosts, "battles": service.sweepDueBattles, "settlements": service.SettleDueBattles,
				"live reminders": service.sweepDueLiveReminders,
			} {
				if err := sweep(ctx); err != nil && ctx.Err() == nil {
					service.Logger.WarnContext(ctx, "timer sweep failed", slog.String("sweep", name), slog.Any("error", err))
				}
			}
		}
	}
}

func (service *LiveService) AdvanceDueTimersOnce(ctx context.Context) error {
	for _, sweep := range []func(context.Context) error{service.sweepDueGuestSlots, service.sweepSilentHosts, service.sweepDueBattles, service.SettleDueBattles, service.sweepDueLiveReminders} {
		if err := sweep(ctx); err != nil {
			return err
		}
	}
	return nil
}

func (service *LiveService) sweepDueGuestSlots(ctx context.Context) error {
	now := service.Now()
	due, err := service.Client.GuestSlot.Query().Where(guestslot.Or(
		guestslot.And(guestslot.StateEQ(guestslot.StateInvited), guestslot.ExpiresAtLTE(now)),
		guestslot.And(guestslot.StateIn(guestslot.StateJoining, guestslot.StateReconnecting), guestslot.StateDeadlineAtLTE(now)),
	)).Limit(timerBatchSize).IDs(ctx)
	if err != nil {
		return err
	}
	for _, slotId := range due {
		if err := service.expireOneSlot(ctx, slotId); err != nil {
			return err
		}
	}
	return nil
}

func (service *LiveService) expireOneSlot(ctx context.Context, slotId uuid.UUID) error {
	return service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		slot, err := tx.GuestSlot.Query().Where(guestslot.ID(slotId)).ForUpdate(sql.WithLockAction(sql.SkipLocked)).Only(ctx)
		if ent.IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}
		event, due := dueEventForSlot(slot, service.Now())
		if !due {
			return nil
		}
		session, err := service.lockLiveSession(ctx, tx, slot.LiveID)
		if err != nil {
			return err
		}
		if slot, err = service.applySlotEvent(ctx, tx, slot, event); err != nil {
			return err
		}
		if slot.State == guestslot.StateLeft {
			if err := service.departFromBattle(ctx, tx, session, slot.UserID, false); err != nil {
				return err
			}
			if err := service.emitGuestChanged(ctx, tx, events.GuestLeft, slot, "reconnectTimeout"); err != nil {
				return err
			}
		}
		return service.emitStageUpdated(ctx, tx, slot.LiveID)
	})
}

func dueEventForSlot(slot *ent.GuestSlot, now time.Time) (GuestSlotEvent, bool) {
	switch slot.State {
	case guestslot.StateInvited:
		return InvitationExpires, !now.Before(slot.ExpiresAt)
	case guestslot.StateJoining:
		return GuestJoinTimesOut, slot.StateDeadlineAt != nil && !now.Before(*slot.StateDeadlineAt)
	case guestslot.StateReconnecting:
		return ReconnectTimesOut, slot.StateDeadlineAt != nil && !now.Before(*slot.StateDeadlineAt)
	}
	return "", false
}

func (service *LiveService) sweepDueBattles(ctx context.Context) error {
	now := service.Now()
	due, err := service.Client.Battle.Query().Where(battlerecord.Or(
		battlerecord.And(battlerecord.StateEQ(battlerecord.StatePending), battlerecord.ProposalExpiresAtLTE(now)),
		battlerecord.And(battlerecord.StateEQ(battlerecord.StateCountdown), battlerecord.StartsAtLTE(now)),
		battlerecord.And(battlerecord.StateEQ(battlerecord.StateActive), battlerecord.EndsAtLTE(now)),
	)).Limit(timerBatchSize).IDs(ctx)
	if err != nil {
		return err
	}
	for _, battleId := range due {
		if err := service.advanceOneBattle(ctx, battleId); err != nil {
			return err
		}
	}
	return nil
}

func (service *LiveService) advanceOneBattle(ctx context.Context, battleId uuid.UUID) error {
	return service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		battle, err := tx.Battle.Query().Where(battlerecord.ID(battleId)).ForUpdate(sql.WithLockAction(sql.SkipLocked)).Only(ctx)
		if ent.IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}
		now := service.Now()
		switch battle.State {
		case battlerecord.StateCountdown:
			if battle.StartsAt != nil && !now.Before(*battle.StartsAt) {
				return service.activateBattle(ctx, tx, battle)
			}
		case battlerecord.StateActive:
			if battle.EndsAt != nil && !now.Before(*battle.EndsAt) {
				return service.endBattleInTransaction(ctx, tx, battle, TimerElapsed, EndedByTimer)
			}
		case battlerecord.StatePending:
			return service.expireProposal(ctx, tx, battle, now)
		}
		return nil
	})
}

func (service *LiveService) activateBattle(ctx context.Context, tx *ent.Tx, battle *ent.Battle) error {
	update, err := service.moveBattle(battle, CountdownElapsed)
	if err != nil {
		return err
	}
	active, err := update.Save(ctx)
	if err != nil {
		return err
	}
	return service.emitStageUpdated(ctx, tx, active.LiveID)
}

func (service *LiveService) expireProposal(ctx context.Context, tx *ent.Tx, battle *ent.Battle, now time.Time) error {
	if battle.HostDecisionDeadlineAt != nil && !now.Before(*battle.HostDecisionDeadlineAt) {
		return service.cancelBattle(ctx, tx, battle, ProposalAbandoned, "hostDidNotDecide")
	}
	if battle.ProposalExpiresAt == nil || now.Before(*battle.ProposalExpiresAt) {
		return nil
	}
	changed, err := tx.BattleParticipant.Update().Where(battleparticipant.BattleID(battle.ID), battleparticipant.ConsentEQ(battleparticipant.ConsentPending)).
		SetConsent(battleparticipant.ConsentDeclined).Save(ctx)
	if err != nil || changed == 0 {
		return err
	}
	return service.emitStageUpdated(ctx, tx, battle.LiveID)
}
