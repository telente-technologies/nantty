package applybillingevent

import (
	"context"
	"time"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/profilecheckmark"
	"nantty/modules/users/src/modules/checkmarks/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	if command.Event != "lapsed" && command.Event != "restored" && command.Event != "ended" && command.Event != "paused" {
		return usersErrors.ValidationFailedFor("event", "must be lapsed, restored, paused or ended")
	}
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.ProfileCheckmark.Query().Where(profilecheckmark.ProfileID(command.ProfileId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return usersErrors.NotFound("That profile has no checkmark.")
		}
		if err != nil {
			return err
		}
		if row.Source == profilecheckmark.SourceLifetimeGrant || row.Status == profilecheckmark.StatusRevoked || (row.Status == profilecheckmark.StatusSuspended && row.Color != profilecheckmark.ColorBlack) {
			return nil
		}
		profile, err := tx.Profile.Get(ctx, row.ProfileID)
		if err != nil {
			return err
		}
		change := services.CheckmarkChange{Profile: profile, Color: row.Color, Source: row.Source, SourceId: row.SourceID, CurrentPeriodEnd: command.PeriodEnd, ReverificationDueAt: row.ReverificationDueAt}
		now := handler.Container.Now()
		switch {
		case command.Event == "restored":
			if row.Color == profilecheckmark.ColorBlack {
				approved, err := services.IsBlackApplicationApproved(ctx, handler.Container.Database, row.ProfileID)
				if err != nil || !approved {
					return err
				}
			}
			change.Status = profilecheckmark.StatusVerified
		case command.Event == "paused":
			change.Status = profilecheckmark.StatusSuspended
		case row.Color == profilecheckmark.ColorBlack && command.Event == "lapsed":
			if end := graceEnd(ctx, now); end != nil {
				change.Status, change.GraceEndsAt = profilecheckmark.StatusGrace, end
			} else {
				change.Status = profilecheckmark.StatusExpired
			}
		default:
			change.Status = profilecheckmark.StatusExpired
		}
		if _, err = services.SetProfileCheckmarkInTransaction(ctx, tx, now, change); err != nil || command.Event != "lapsed" || command.Price == nil {
			return err
		}
		notice := services.NoticeBase(profile, string(row.Color))
		notice.Price, notice.FailedAt = command.Price, now.UTC().Format(time.RFC3339)
		if change.GraceEndsAt != nil {
			notice.GraceEndsAt = change.GraceEndsAt.UTC().Format(time.RFC3339)
		}
		return services.EnqueueCheckmarkNoticeInTransaction(ctx, tx, now, "checkmark.renewalFailed", notice)
	})
}

func graceEnd(ctx context.Context, now time.Time) *time.Time {
	days := services.LoadPricingRules(ctx).BlackGraceDays
	if days <= 0 {
		return nil
	}
	end := now.AddDate(0, 0, days)
	return &end
}
