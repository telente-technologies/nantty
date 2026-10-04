package services

import (
	"context"
	"time"
	liveerrors "zudomart/modules/live/src/errors"
	"zudomart/modules/live/src/events"
	"zudomart/modules/live/src/types"

	"github.com/google/uuid"

	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/generated/ent/livesession"
	"zudomart/modules/live/src/generated/ent/pointsentry"
	"zudomart/modules/live/src/generated/ent/pointsrule"
)

var engagementActions = map[string]bool{"like": true, "share": true, "follow": true, "watch": true}

func (service *LiveService) AwardEngagementPoints(ctx context.Context, actor types.Actor, liveId uuid.UUID, action string) (types.EngagementAward, error) {
	if !engagementActions[action] {
		return types.EngagementAward{}, liveerrors.EngagementUnknown
	}
	var result types.EngagementAward
	err := service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := tx.LiveSession.Get(ctx, liveId)
		if ent.IsNotFound(err) {
			return liveerrors.LiveNotFound
		}
		if err != nil {
			return err
		}
		if session.State != livesession.StateLive {
			return liveerrors.LiveNotActive
		}
		if _, err := tx.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "engagement:"+actor.UserId.String()+":"+action); err != nil {
			return err
		}
		awarded, err := service.decideEngagementPoints(ctx, tx, actor.UserId, liveId, action)
		if err != nil {
			return err
		}
		if awarded > 0 {
			err := service.recordPointsInTransaction(ctx, tx, service.loadPointsContext(session), pointsAward{
				UserId: actor.UserId, Type: "engagement", Amount: awarded, SourceType: action, SourceId: liveId.String(),
				IdempotencyKey: "engagement:" + action + ":" + uuid.NewString(),
			})
			if err != nil {
				return err
			}
			if err := service.emitLeaderboardUpdated(ctx, tx, liveId); err != nil {
				return err
			}
		}
		total, likes, err := service.readViewerPoints(ctx, tx.Client(), actor.UserId, liveId)
		result = types.EngagementAward{Awarded: awarded, TotalPoints: total, LikePointsThisMinute: likes}
		return err
	})
	return result, err
}

func (service *LiveService) decideEngagementPoints(ctx context.Context, tx *ent.Tx, userId, liveId uuid.UUID, action string) (int64, error) {
	rule, err := tx.PointsRule.Query().Where(pointsrule.ID(action), pointsrule.Active(true)).Only(ctx)
	if ent.IsNotFound(err) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	now := service.Now()
	countSince := func(since time.Time, scoped bool) (int, error) {
		query := tx.PointsEntry.Query().Where(pointsentry.UserID(userId), pointsentry.SourceType(action), pointsentry.CreatedAtGT(since))
		if scoped {
			query = query.Where(pointsentry.LiveID(liveId))
		}
		return query.Count(ctx)
	}
	checks := []struct {
		limit  int
		since  time.Time
		scoped bool
	}{
		{rule.PerMinuteCap, now.Add(-time.Minute), false},
		{rule.PerDayCap, now.Add(-24 * time.Hour), false},
		{rule.PerLiveCap, time.Time{}, true},
	}
	for _, check := range checks {
		if check.limit == 0 {
			continue
		}
		used, err := countSince(check.since, check.scoped)
		if err != nil || used >= check.limit {
			return 0, err
		}
	}
	return rule.Points, nil
}

func (service *LiveService) readViewerPoints(ctx context.Context, db *ent.Client, userId, liveId uuid.UUID) (int64, int, error) {
	var totals []struct {
		UserID uuid.UUID `json:"user_id"`
		Total  int64     `json:"total"`
	}
	err := db.PointsEntry.Query().Where(pointsentry.UserID(userId), pointsentry.LiveID(liveId)).GroupBy(pointsentry.FieldUserID).
		Aggregate(ent.As(ent.Sum(pointsentry.FieldAmount), "total")).Scan(ctx, &totals)
	if err != nil {
		return 0, 0, err
	}
	var total int64
	if len(totals) > 0 {
		total = totals[0].Total
	}
	likes, err := db.PointsEntry.Query().Where(pointsentry.UserID(userId), pointsentry.SourceType("like"), pointsentry.CreatedAtGT(service.Now().Add(-time.Minute))).Count(ctx)
	return total, likes, err
}

func (service *LiveService) GetMyLivePoints(ctx context.Context, actor types.Actor, liveId uuid.UUID) (types.ViewerLivePoints, error) {
	total, likes, err := service.readViewerPoints(ctx, service.Client, actor.UserId, liveId)
	return types.ViewerLivePoints{TotalPoints: total, LikePointsThisMinute: likes}, err
}

func (service *LiveService) emitLeaderboardUpdated(ctx context.Context, tx *ent.Tx, liveId uuid.UUID) error {
	standings, err := service.computeLiveStandings(ctx, tx.Client(), liveId, nil)
	if err != nil {
		return err
	}
	top := make([]events.LeaderboardEventEntry, 0, 5)
	for index, row := range standings {
		if index == 5 {
			break
		}
		top = append(top, events.LeaderboardEventEntry{UserId: row.UserId.String(), Coins: row.Coins, Points: row.Points})
	}
	return events.EnqueueOutboxEventInTransaction(ctx, tx, events.LeaderboardUpdated, liveId.String(), service.Now(), events.LeaderboardEventData{LiveId: liveId.String(), Scope: "live", Top: top})
}
