package services

import (
	"context"
	"time"
	liveerrors "zudomart/modules/live/src/errors"
	"zudomart/modules/live/src/events"
	"zudomart/modules/live/src/types"

	"github.com/google/uuid"

	"zudomart/modules/live/src/generated/ent"
	battlerecord "zudomart/modules/live/src/generated/ent/battle"
	"zudomart/modules/live/src/generated/ent/guestslot"
	"zudomart/modules/live/src/generated/ent/livesession"
	"zudomart/modules/live/src/generated/ent/liveviewer"
)

const finalLeaderboardSize = 20

func (service *LiveService) EndLiveSession(ctx context.Context, actor types.Actor, liveId uuid.UUID) error {
	return service.endLive(ctx, liveId, func(session *ent.LiveSession) (bool, error) {
		if session.HostID != actor.UserId {
			return false, liveerrors.NotLiveHost
		}
		return true, nil
	})
}

func (service *LiveService) endLive(ctx context.Context, liveId uuid.UUID, shouldEnd func(*ent.LiveSession) (bool, error)) error {
	var ended *ent.LiveSession
	err := service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := service.lockLiveSession(ctx, tx, liveId)
		if err != nil {
			return err
		}
		proceed, err := shouldEnd(session)
		if err != nil || !proceed || session.State == livesession.StateEnded {
			return err
		}
		if err := service.closeBattleBecauseLiveEnded(ctx, tx, liveId); err != nil {
			return err
		}
		now := service.Now()
		if err := tx.GuestSlot.Update().Where(guestslot.LiveID(liveId), guestslot.StateIn(occupyingSlotStates()...)).
			SetState(guestslot.StateLeft).SetLeftAt(now).SetEndReason("liveEnded").ClearStateDeadlineAt().Exec(ctx); err != nil {
			return err
		}
		if err := tx.LiveViewer.Update().Where(liveviewer.LiveID(liveId), liveviewer.LeftAtIsNil()).SetLeftAt(now).Exec(ctx); err != nil {
			return err
		}
		ended = session
		return service.finishLiveAndStoreFinalBoard(ctx, tx, session, now)
	})
	if err != nil || ended == nil {
		return err
	}
	service.afterLiveEnded(ctx, ended)
	service.settleEndedBattlesQuietly(ctx, liveId)
	service.bestEffortMedia(ctx, "close media room", service.Media.DeleteRoom(ctx, ended.LivekitRoom))
	return nil
}

func (service *LiveService) closeBattleBecauseLiveEnded(ctx context.Context, tx *ent.Tx, liveId uuid.UUID) error {
	battle, err := service.findOccupyingBattle(ctx, tx, liveId)
	if err != nil || battle == nil {
		return err
	}
	switch battle.State {
	case battlerecord.StatePending:
		return service.cancelBattle(ctx, tx, battle, HostEndsLive, "hostEndedLive")
	case battlerecord.StateCountdown, battlerecord.StateActive:
		return service.endBattleInTransaction(ctx, tx, battle, HostEndsLive, EndedByHostLive)
	}
	return nil
}

func (service *LiveService) finishLiveAndStoreFinalBoard(ctx context.Context, tx *ent.Tx, session *ent.LiveSession, now time.Time) error {
	standings, err := service.computeLiveStandings(ctx, tx.Client(), session.ID, nil)
	if err != nil {
		return err
	}
	if len(standings) > finalLeaderboardSize {
		standings = standings[:finalLeaderboardSize]
	}
	update := session.Update().SetState(livesession.StateEnded).SetEndedAt(now).SetViewers(0)
	for index, row := range standings {
		err := tx.LiveLeaderboardEntry.Create().SetLiveID(session.ID).SetUserID(row.UserId).SetRank(index + 1).SetCoins(row.Coins).SetPoints(row.Points).Exec(ctx)
		if err != nil {
			return err
		}
	}
	if len(standings) > 0 {
		update.SetTopSupporterUserID(standings[0].UserId)
	}
	if err := update.Exec(ctx); err != nil {
		return err
	}
	liveId := session.ID.String()
	err = events.EnqueueOutboxEventInTransaction(ctx, tx, events.LiveEnded, liveId, now, events.LiveEndedEventData{
		LiveId: liveId, HostId: session.HostID.String(), EndedAt: now, PeakViewers: session.PeakViewers, GiftCount: session.GiftCount, TotalCoins: session.TotalCoins,
	})
	if err != nil {
		return err
	}
	if len(standings) > 0 {
		participants, err := service.lookupParticipants(ctx, standings[0].UserId)
		if err != nil {
			return err
		}
		err = events.EnqueueOutboxEventInTransaction(ctx, tx, events.LiveTopSupporter, liveId, now, events.LiveTopSupporterEventData{
			LiveId: liveId, User: summarise(participants[standings[0].UserId]), Coins: standings[0].Coins, Points: standings[0].Points,
		})
		if err != nil {
			return err
		}
	}
	return service.emitStageUpdated(ctx, tx, session.ID)
}
