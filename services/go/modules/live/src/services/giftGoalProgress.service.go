package services

import (
	"context"
	"nantty/modules/live/src/events"

	"github.com/google/uuid"

	"nantty/modules/live/src/generated/ent"
	"nantty/modules/live/src/generated/ent/giftgoal"
	"nantty/modules/live/src/generated/ent/goalcontribution"
)

func (service *LiveService) applyGiftToActiveGoal(ctx context.Context, tx *ent.Tx, liveId uuid.UUID, gift committedGift) error {
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
	return service.advanceGoal(ctx, tx, goal, goal.ProgressCoins+gift.TotalCoins, goal.TargetCoins)
}

func (service *LiveService) advanceGoal(ctx context.Context, tx *ent.Tx, goal *ent.GiftGoal, progress, target int64) error {
	now := service.Now()
	update := goal.Update().SetProgressCoins(progress).SetTargetCoins(target)
	completed := progress >= target
	if completed {
		update.SetStatus(giftgoal.StatusCompleted).SetCompletedAt(now)
	}
	saved, err := update.Save(ctx)
	if err != nil {
		return err
	}
	contributors, err := service.topGoalContributors(ctx, tx, saved)
	if err != nil {
		return err
	}
	data := events.GoalEventData{
		LiveId: saved.LiveID.String(), GoalId: saved.ID.String(), Title: saved.Title, TargetCoins: saved.TargetCoins, ProgressCoins: saved.ProgressCoins, TopContributors: contributors,
	}
	eventType := events.GoalProgressed
	if completed {
		eventType, data.CompletedAt = events.GoalCompleted, &now
	}
	return events.EnqueueOutboxEventInTransaction(ctx, tx, eventType, saved.LiveID.String(), now, data)
}

func (service *LiveService) topGoalContributors(ctx context.Context, tx *ent.Tx, goal *ent.GiftGoal) ([]events.GoalContributor, error) {
	rows, err := tx.GoalContribution.Query().Where(goalcontribution.GoalID(goal.ID)).Order(ent.Desc(goalcontribution.FieldCoins)).Limit(3).All(ctx)
	if err != nil {
		return nil, err
	}
	contributors := make([]events.GoalContributor, 0, len(rows))
	for _, row := range rows {
		contributors = append(contributors, events.GoalContributor{UserId: row.SenderID.String(), Coins: row.Coins})
	}
	return contributors, nil
}
