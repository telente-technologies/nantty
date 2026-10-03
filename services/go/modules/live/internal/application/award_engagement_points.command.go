package application

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/ent"
	"zudomart/modules/live/internal/ent/livesession"
	"zudomart/modules/live/internal/ent/pointsentry"
	"zudomart/modules/live/internal/ent/pointsrule"
)

type EngagementAward struct {
	Awarded              int64 `json:"awarded"`
	TotalPoints          int64 `json:"totalPoints"`
	LikePointsThisMinute int   `json:"likePointsThisMinute"`
}

type ViewerLivePoints struct {
	TotalPoints          int64 `json:"totalPoints"`
	LikePointsThisMinute int   `json:"likePointsThisMinute"`
}

var engagementActions = map[string]bool{"like": true, "share": true, "follow": true, "watch": true}

func (application *LiveApplication) AwardEngagementPoints(ctx context.Context, actor Actor, liveId uuid.UUID, action string) (EngagementAward, error) {
	if !engagementActions[action] {
		return EngagementAward{}, errEngagementUnknown
	}
	var result EngagementAward
	err := application.runInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := tx.LiveSession.Get(ctx, liveId)
		if ent.IsNotFound(err) {
			return errLiveNotFound
		}
		if err != nil {
			return err
		}
		if session.State != livesession.StateLive {
			return errLiveNotActive
		}
		if _, err := tx.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "engagement:"+actor.UserId.String()+":"+action); err != nil {
			return err
		}
		awarded, err := application.decideEngagementPoints(ctx, tx, actor.UserId, liveId, action)
		if err != nil {
			return err
		}
		if awarded > 0 {
			err := application.recordPointsInTransaction(ctx, tx, application.loadPointsContext(session), pointsAward{
				UserId: actor.UserId, Type: "engagement", Amount: awarded, SourceType: action, SourceId: liveId.String(),
				IdempotencyKey: "engagement:" + action + ":" + uuid.NewString(),
			})
			if err != nil {
				return err
			}
			if err := application.emitLeaderboardUpdated(ctx, tx, liveId); err != nil {
				return err
			}
		}
		total, likes, err := application.readViewerPoints(ctx, tx.Client(), actor.UserId, liveId)
		result = EngagementAward{Awarded: awarded, TotalPoints: total, LikePointsThisMinute: likes}
		return err
	})
	return result, err
}

func (application *LiveApplication) decideEngagementPoints(ctx context.Context, tx *ent.Tx, userId, liveId uuid.UUID, action string) (int64, error) {
	rule, err := tx.PointsRule.Query().Where(pointsrule.ID(action), pointsrule.Active(true)).Only(ctx)
	if ent.IsNotFound(err) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	now := application.Now()
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

func (application *LiveApplication) readViewerPoints(ctx context.Context, db *ent.Client, userId, liveId uuid.UUID) (int64, int, error) {
	total, err := db.PointsEntry.Query().Where(pointsentry.UserID(userId), pointsentry.LiveID(liveId)).Aggregate(ent.Sum(pointsentry.FieldAmount)).Int(ctx)
	if err != nil && !ent.IsNotFound(err) {
		return 0, 0, err
	}
	likes, err := db.PointsEntry.Query().Where(pointsentry.UserID(userId), pointsentry.SourceType("like"), pointsentry.CreatedAtGT(application.Now().Add(-time.Minute))).Count(ctx)
	return int64(total), likes, err
}

func (application *LiveApplication) GetMyLivePoints(ctx context.Context, actor Actor, liveId uuid.UUID) (ViewerLivePoints, error) {
	total, likes, err := application.readViewerPoints(ctx, application.Client, actor.UserId, liveId)
	return ViewerLivePoints{TotalPoints: total, LikePointsThisMinute: likes}, err
}

func (application *LiveApplication) emitLeaderboardUpdated(ctx context.Context, tx *ent.Tx, liveId uuid.UUID) error {
	standings, err := application.computeLiveStandings(ctx, tx.Client(), liveId, nil)
	if err != nil {
		return err
	}
	top := make([]LeaderboardEventEntry, 0, 5)
	for index, row := range standings {
		if index == 5 {
			break
		}
		top = append(top, LeaderboardEventEntry{UserId: row.UserId.String(), Coins: row.Coins, Points: row.Points})
	}
	return enqueueOutboxEventInTransaction(ctx, tx, eventLeaderboardUpdated, liveId.String(), application.Now(), LeaderboardEventData{LiveId: liveId.String(), Scope: "live", Top: top})
}
