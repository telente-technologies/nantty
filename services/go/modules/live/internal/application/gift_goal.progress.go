package application

import (
	"context"
	"github.com/google/uuid"

	"zudomart/modules/live/internal/ent"
	"zudomart/modules/live/internal/ent/giftgoal"
	"zudomart/modules/live/internal/ent/goalcontribution"
)

func (application *LiveApplication) applyGiftToActiveGoal(ctx context.Context, tx *ent.Tx, liveId uuid.UUID, gift committedGift) error {
	goal, err := tx.GiftGoal.Query().Where(giftgoal.LiveID(liveId), giftgoal.StatusEQ(giftgoal.StatusActive)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	if goal.GiftID != nil && *goal.GiftID != gift.GiftId {
		return nil
	}
	err = tx.GoalContribution.Create().SetGoalID(goal.ID).SetSenderID(gift.SenderId).SetCoins(gift.TotalCoins).
		OnConflictColumns("goal_id", "sender_id").AddCoins(gift.TotalCoins).Exec(ctx)
	if err != nil {
		return err
	}
	return application.advanceGoal(ctx, tx, goal, goal.ProgressCoins+gift.TotalCoins, goal.TargetCoins)
}

func (application *LiveApplication) advanceGoal(ctx context.Context, tx *ent.Tx, goal *ent.GiftGoal, progress, target int64) error {
	now := application.Now()
	update := goal.Update().SetProgressCoins(progress).SetTargetCoins(target)
	completed := progress >= target
	if completed {
		update.SetStatus(giftgoal.StatusCompleted).SetCompletedAt(now)
	}
	saved, err := update.Save(ctx)
	if err != nil {
		return err
	}
	contributors, err := application.topGoalContributors(ctx, tx, saved)
	if err != nil {
		return err
	}
	data := GoalEventData{
		LiveId: saved.LiveID.String(), GoalId: saved.ID.String(), Title: saved.Title, TargetCoins: saved.TargetCoins, ProgressCoins: saved.ProgressCoins, TopContributors: contributors,
	}
	eventType := eventGoalProgressed
	if completed {
		eventType, data.CompletedAt = eventGoalCompleted, &now
	}
	return enqueueOutboxEventInTransaction(ctx, tx, eventType, saved.LiveID.String(), now, data)
}

func (application *LiveApplication) topGoalContributors(ctx context.Context, tx *ent.Tx, goal *ent.GiftGoal) ([]GoalContributor, error) {
	rows, err := tx.GoalContribution.Query().Where(goalcontribution.GoalID(goal.ID)).Order(ent.Desc(goalcontribution.FieldCoins)).Limit(3).All(ctx)
	if err != nil {
		return nil, err
	}
	contributors := make([]GoalContributor, 0, len(rows))
	for _, row := range rows {
		contributors = append(contributors, GoalContributor{UserId: row.SenderID.String(), Coins: row.Coins})
	}
	return contributors, nil
}
