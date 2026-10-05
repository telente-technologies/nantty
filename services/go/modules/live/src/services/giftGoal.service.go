package services

import (
	"context"
	"strings"
	liveerrors "zudomart/modules/live/src/errors"
	"zudomart/modules/live/src/types"

	"github.com/google/uuid"

	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/generated/ent/gift"
	"zudomart/modules/live/src/generated/ent/giftgoal"
)

const minimumGoalTargetCoins = 10

func presentGoal(goal *ent.GiftGoal) types.GiftGoalView {
	return types.GiftGoalView{
		Id: goal.ID.String(), LiveId: goal.LiveID.String(), CreatorId: goal.CreatorID.String(), Title: goal.Title, TargetCoins: goal.TargetCoins, GiftId: goal.GiftID,
		ProgressCoins: goal.ProgressCoins, Status: string(goal.Status), CompletedAt: formatOptionalTime(goal.CompletedAt),
	}
}

func (service *LiveService) ListGiftGoals(ctx context.Context, liveId uuid.UUID) ([]types.GiftGoalView, error) {
	rows, err := service.Client.GiftGoal.Query().Where(giftgoal.LiveID(liveId), giftgoal.StatusNEQ(giftgoal.StatusCancelled)).Order(ent.Desc(giftgoal.FieldCreatedAt)).All(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]types.GiftGoalView, 0, len(rows))
	for _, row := range rows {
		views = append(views, presentGoal(row))
	}
	return views, nil
}

func (service *LiveService) requireGoalGift(ctx context.Context, input types.GiftGoalInput) error {
	if input.GiftId == nil {
		return nil
	}
	exists, err := service.Client.Gift.Query().Where(gift.ID(*input.GiftId), gift.IsActive(true)).Exist(ctx)
	if err == nil && !exists {
		err = liveerrors.GiftNotFound
	}
	return err
}

func (service *LiveService) CreateGiftGoal(ctx context.Context, actor types.Actor, liveId uuid.UUID, input types.GiftGoalInput) (types.GiftGoalView, error) {
	if err := service.requireGoalGift(ctx, input); err != nil {
		return types.GiftGoalView{}, err
	}
	var created *ent.GiftGoal
	err := service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := service.lockLiveSession(ctx, tx, liveId)
		if err != nil {
			return err
		}
		if session.HostID != actor.UserId {
			return liveerrors.NotLiveHost
		}
		active, err := tx.GiftGoal.Query().Where(giftgoal.LiveID(liveId), giftgoal.StatusEQ(giftgoal.StatusActive)).Exist(ctx)
		if err != nil || active {
			if err == nil {
				err = liveerrors.Api(409, "GOAL_ALREADY_ACTIVE", "Finish or edit your current goal first.")
			}
			return err
		}
		created, err = tx.GiftGoal.Create().SetLiveID(liveId).SetCreatorID(actor.UserId).SetTitle(strings.TrimSpace(*input.Title)).
			SetTargetCoins(*input.TargetCoins).SetNillableGiftID(input.GiftId).Save(ctx)
		return err
	})
	if err != nil {
		return types.GiftGoalView{}, err
	}
	return presentGoal(created), nil
}

func (service *LiveService) UpdateGiftGoal(ctx context.Context, actor types.Actor, liveId, goalId uuid.UUID, input types.GiftGoalInput) (types.GiftGoalView, error) {
	if err := service.requireGoalGift(ctx, input); err != nil {
		return types.GiftGoalView{}, err
	}
	var updated *ent.GiftGoal
	err := service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		goal, err := service.lockHostGoal(ctx, tx, actor, liveId, goalId)
		if err != nil {
			return err
		}
		title, target := goal.Title, goal.TargetCoins
		if input.Title != nil {
			title = strings.TrimSpace(*input.Title)
		}
		if input.TargetCoins != nil {
			target = *input.TargetCoins
		}
		if goal.Status != giftgoal.StatusActive {
			updated, err = goal.Update().SetTitle(title).Save(ctx)
			return err
		}
		update := goal.Update().SetTitle(title)
		if input.GiftIdPresent {
			update.SetNillableGiftID(input.GiftId)
			if input.GiftId == nil {
				update.ClearGiftID()
			}
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		if target != goal.TargetCoins {
			if err := service.advanceGoal(ctx, tx, goal, goal.ProgressCoins, target); err != nil {
				return err
			}
		}
		updated, err = tx.GiftGoal.Get(ctx, goalId)
		return err
	})
	if err != nil {
		return types.GiftGoalView{}, err
	}
	return presentGoal(updated), nil
}

func (service *LiveService) CancelGiftGoal(ctx context.Context, actor types.Actor, liveId, goalId uuid.UUID) error {
	return service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		goal, err := service.lockHostGoal(ctx, tx, actor, liveId, goalId)
		if err != nil || goal.Status != giftgoal.StatusActive {
			return err
		}
		return goal.Update().SetStatus(giftgoal.StatusCancelled).Exec(ctx)
	})
}

func (service *LiveService) lockHostGoal(ctx context.Context, tx *ent.Tx, actor types.Actor, liveId, goalId uuid.UUID) (*ent.GiftGoal, error) {
	session, err := service.lockLiveSession(ctx, tx, liveId)
	if err != nil {
		return nil, err
	}
	if session.HostID != actor.UserId {
		return nil, liveerrors.NotLiveHost
	}
	goal, err := tx.GiftGoal.Query().Where(giftgoal.ID(goalId), giftgoal.LiveID(liveId)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil, liveerrors.Api(404, "GOAL_NOT_FOUND", "Goal not found.")
	}
	return goal, err
}
