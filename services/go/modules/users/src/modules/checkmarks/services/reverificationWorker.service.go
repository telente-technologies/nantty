package services

import (
	"context"
	"time"

	"nantty/modules/users/src/container"
	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/blackapplication"
	"nantty/modules/users/src/generated/ent/profilecheckmark"
	checkmarkevents "nantty/modules/users/src/modules/checkmarks/events"
)

type ReverificationWorker struct {
	Container *container.Container
}

func (worker ReverificationWorker) RunOnce(ctx context.Context) error {
	now := worker.Container.Now()
	due, err := worker.Container.Client.BlackApplication.Query().Where(blackapplication.StatusEQ(blackapplication.StatusApproved), blackapplication.ReverificationRemindedAtIsNil(), blackapplication.ReverificationDueAtLTE(now.AddDate(0, 0, 30))).Limit(20).All(ctx)
	if err != nil {
		return err
	}
	for _, row := range due {
		err := worker.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
			if err := tx.BlackApplication.UpdateOne(row).SetReverificationRemindedAt(now).Exec(ctx); err != nil {
				return err
			}
			return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, checkmarkevents.BlackReverificationDueType, row.ProfileID.String(), now, checkmarkevents.ApplicationEventData{ApplicationId: row.ID.String(), ProfileId: row.ProfileID.String(), AccountId: row.AccountID.String(), Color: "black"})
		})
		if err != nil {
			return err
		}
	}
	return worker.moveLapsedCheckmarks(ctx)
}

func (worker ReverificationWorker) moveLapsedCheckmarks(ctx context.Context) error {
	now := worker.Container.Now()
	overdue, err := worker.Container.Client.ProfileCheckmark.Query().Where(profilecheckmark.ColorEQ(profilecheckmark.ColorBlack), profilecheckmark.StatusEQ(profilecheckmark.StatusVerified), profilecheckmark.ReverificationDueAtLTE(now)).Limit(20).All(ctx)
	if err != nil {
		return err
	}
	graceDays := LoadPricingRules(ctx).BlackGraceDays
	for _, row := range overdue {
		grace := now.AddDate(0, 0, graceDays)
		if err := worker.changeStatus(ctx, row, profilecheckmark.StatusGrace, &grace); err != nil {
			return err
		}
	}
	ended, err := worker.Container.Client.ProfileCheckmark.Query().Where(profilecheckmark.StatusEQ(profilecheckmark.StatusGrace), profilecheckmark.GraceEndsAtLTE(now)).Limit(20).All(ctx)
	if err != nil {
		return err
	}
	for _, row := range ended {
		if err := worker.changeStatus(ctx, row, profilecheckmark.StatusExpired, nil); err != nil {
			return err
		}
	}
	return nil
}

func (worker ReverificationWorker) changeStatus(ctx context.Context, row *ent.ProfileCheckmark, status profilecheckmark.Status, graceEnds *time.Time) error {
	return worker.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		profile, err := tx.Profile.Get(ctx, row.ProfileID)
		if err != nil {
			return err
		}
		_, err = SetProfileCheckmarkInTransaction(ctx, tx, worker.Container.Now(), CheckmarkChange{
			Profile: profile, Color: row.Color, Status: status, Source: row.Source, SourceId: row.SourceID, ReverificationDueAt: row.ReverificationDueAt, GraceEndsAt: graceEnds,
		})
		return err
	})
}
