package application

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/domain"
	"zudomart/modules/live/internal/ent"
	battlerecord "zudomart/modules/live/internal/ent/battle"
	"zudomart/modules/live/internal/ent/guestslot"
	"zudomart/modules/live/internal/ent/livesession"
	"zudomart/modules/live/internal/ent/liveviewer"
)

const finalLeaderboardSize = 20

func (application *LiveApplication) EndLiveSession(ctx context.Context, actor Actor, liveId uuid.UUID) error {
	var room string
	err := application.runInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := application.lockLiveSession(ctx, tx, liveId)
		if err != nil {
			return err
		}
		room = session.LivekitRoom
		if session.HostID != actor.UserId {
			return errNotLiveHost
		}
		if session.State == livesession.StateEnded {
			return nil
		}
		if err := application.closeBattleBecauseLiveEnded(ctx, tx, liveId); err != nil {
			return err
		}
		now := application.Now()
		if err := tx.GuestSlot.Update().Where(guestslot.LiveID(liveId), guestslot.StateIn(occupyingSlotStates()...)).
			SetState(guestslot.StateLeft).SetLeftAt(now).SetEndReason("liveEnded").ClearStateDeadlineAt().Exec(ctx); err != nil {
			return err
		}
		if err := tx.LiveViewer.Update().Where(liveviewer.LiveID(liveId), liveviewer.LeftAtIsNil()).SetLeftAt(now).Exec(ctx); err != nil {
			return err
		}
		return application.finishLiveAndStoreFinalBoard(ctx, tx, session, now)
	})
	if err != nil {
		return err
	}
	application.settleEndedBattlesQuietly(ctx, liveId)
	application.bestEffortMedia(ctx, "remove host participant", application.Media.RemoveParticipant(ctx, room, actor.UserId.String()))
	return nil
}

func (application *LiveApplication) closeBattleBecauseLiveEnded(ctx context.Context, tx *ent.Tx, liveId uuid.UUID) error {
	battle, err := application.findOccupyingBattle(ctx, tx, liveId)
	if err != nil || battle == nil {
		return err
	}
	switch battle.State {
	case battlerecord.StatePending:
		return application.cancelBattle(ctx, tx, battle, domain.HostEndsLive, "hostEndedLive")
	case battlerecord.StateCountdown, battlerecord.StateActive:
		return application.endBattleInTransaction(ctx, tx, battle, domain.HostEndsLive, domain.EndedByHostLive)
	}
	return nil
}

func (application *LiveApplication) finishLiveAndStoreFinalBoard(ctx context.Context, tx *ent.Tx, session *ent.LiveSession, now time.Time) error {
	standings, err := application.computeLiveStandings(ctx, tx.Client(), session.ID, nil)
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
	err = enqueueOutboxEventInTransaction(ctx, tx, eventLiveEnded, liveId, now, LiveEndedEventData{
		LiveId: liveId, HostId: session.HostID.String(), EndedAt: now, PeakViewers: session.PeakViewers, GiftCount: session.GiftCount, TotalCoins: session.TotalCoins,
	})
	if err != nil {
		return err
	}
	if len(standings) > 0 {
		participants, err := application.lookupParticipants(ctx, standings[0].UserId)
		if err != nil {
			return err
		}
		err = enqueueOutboxEventInTransaction(ctx, tx, eventLiveTopSupporter, liveId, now, LiveTopSupporterEventData{
			LiveId: liveId, User: summarise(participants[standings[0].UserId]), Coins: standings[0].Coins, Points: standings[0].Points,
		})
		if err != nil {
			return err
		}
	}
	return application.emitStageUpdated(ctx, tx, session.ID)
}
