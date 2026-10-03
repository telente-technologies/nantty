package application

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/ent"
	"zudomart/modules/live/internal/ent/giftgoal"
)

type GiftGoalView struct {
	Id            string  `json:"id"`
	LiveId        string  `json:"liveId"`
	CreatorId     string  `json:"creatorId"`
	Title         string  `json:"title"`
	TargetCoins   int64   `json:"targetCoins"`
	GiftId        *string `json:"giftId"`
	ProgressCoins int64   `json:"progressCoins"`
	Status        string  `json:"status"`
	CompletedAt   *string `json:"completedAt"`
}

type GiftGoalInput struct {
	Title       *string
	TargetCoins *int64
	GiftId      *string
}

const minimumGoalTargetCoins = 10

func presentGoal(goal *ent.GiftGoal) GiftGoalView {
	return GiftGoalView{
		Id: goal.ID.String(), LiveId: goal.LiveID.String(), CreatorId: goal.CreatorID.String(), Title: goal.Title, TargetCoins: goal.TargetCoins, GiftId: goal.GiftID,
		ProgressCoins: goal.ProgressCoins, Status: string(goal.Status), CompletedAt: formatOptionalTime(goal.CompletedAt),
	}
}

func (application *LiveApplication) ListGiftGoals(ctx context.Context, liveId uuid.UUID) ([]GiftGoalView, error) {
	rows, err := application.Client.GiftGoal.Query().Where(giftgoal.LiveID(liveId), giftgoal.StatusNEQ(giftgoal.StatusCancelled)).Order(ent.Desc(giftgoal.FieldCreatedAt)).All(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]GiftGoalView, 0, len(rows))
	for _, row := range rows {
		views = append(views, presentGoal(row))
	}
	return views, nil
}

func (application *LiveApplication) CreateGiftGoal(ctx context.Context, actor Actor, liveId uuid.UUID, input GiftGoalInput) (GiftGoalView, error) {
	var created *ent.GiftGoal
	err := application.runInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := application.lockLiveSession(ctx, tx, liveId)
		if err != nil {
			return err
		}
		if session.HostID != actor.UserId {
			return errNotLiveHost
		}
		active, err := tx.GiftGoal.Query().Where(giftgoal.LiveID(liveId), giftgoal.StatusEQ(giftgoal.StatusActive)).Exist(ctx)
		if err != nil || active {
			if err == nil {
				err = apiError(409, "GOAL_ALREADY_ACTIVE", "Finish or edit your current goal first.")
			}
			return err
		}
		created, err = tx.GiftGoal.Create().SetLiveID(liveId).SetCreatorID(actor.UserId).SetTitle(strings.TrimSpace(*input.Title)).
			SetTargetCoins(*input.TargetCoins).SetNillableGiftID(input.GiftId).Save(ctx)
		return err
	})
	if err != nil {
		return GiftGoalView{}, err
	}
	return presentGoal(created), nil
}

func (application *LiveApplication) UpdateGiftGoal(ctx context.Context, actor Actor, liveId, goalId uuid.UUID, input GiftGoalInput) (GiftGoalView, error) {
	var updated *ent.GiftGoal
	err := application.runInTransaction(ctx, func(tx *ent.Tx) error {
		goal, err := application.lockHostGoal(ctx, tx, actor, liveId, goalId)
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
		if err := goal.Update().SetTitle(title).Exec(ctx); err != nil {
			return err
		}
		if target != goal.TargetCoins {
			if err := application.advanceGoal(ctx, tx, goal, goal.ProgressCoins, target); err != nil {
				return err
			}
		}
		updated, err = tx.GiftGoal.Get(ctx, goalId)
		return err
	})
	if err != nil {
		return GiftGoalView{}, err
	}
	return presentGoal(updated), nil
}

func (application *LiveApplication) CancelGiftGoal(ctx context.Context, actor Actor, liveId, goalId uuid.UUID) error {
	return application.runInTransaction(ctx, func(tx *ent.Tx) error {
		goal, err := application.lockHostGoal(ctx, tx, actor, liveId, goalId)
		if err != nil || goal.Status != giftgoal.StatusActive {
			return err
		}
		return goal.Update().SetStatus(giftgoal.StatusCancelled).Exec(ctx)
	})
}

func (application *LiveApplication) lockHostGoal(ctx context.Context, tx *ent.Tx, actor Actor, liveId, goalId uuid.UUID) (*ent.GiftGoal, error) {
	session, err := application.lockLiveSession(ctx, tx, liveId)
	if err != nil {
		return nil, err
	}
	if session.HostID != actor.UserId {
		return nil, errNotLiveHost
	}
	goal, err := tx.GiftGoal.Query().Where(giftgoal.ID(goalId), giftgoal.LiveID(liveId)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil, apiError(404, "GOAL_NOT_FOUND", "Goal not found.")
	}
	return goal, err
}
