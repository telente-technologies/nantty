package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/profile"
	"nantty/modules/users/src/generated/ent/profilecheckmark"
	checkmarkevents "nantty/modules/users/src/modules/checkmarks/events"
)

func ColorForProfileType(profileType profile.ProfileType) profilecheckmark.Color {
	switch profileType {
	case profile.ProfileTypeBusiness, profile.ProfileTypeBrand:
		return profilecheckmark.ColorGold
	case profile.ProfileTypeGovernment:
		return profilecheckmark.ColorBlack
	}
	return profilecheckmark.ColorBlue
}

func BadgeVisible(status profilecheckmark.Status) bool {
	return status == profilecheckmark.StatusVerified || status == profilecheckmark.StatusGrace
}

type CheckmarkChange struct {
	Profile             *ent.Profile
	Color               profilecheckmark.Color
	Status              profilecheckmark.Status
	Source              profilecheckmark.Source
	SourceId            *uuid.UUID
	CurrentPeriodEnd    *time.Time
	ReverificationDueAt *time.Time
	GraceEndsAt         *time.Time
	ReserveHandle       bool
}

func SetProfileCheckmarkInTransaction(ctx context.Context, tx *ent.Tx, now time.Time, change CheckmarkChange) (*ent.ProfileCheckmark, error) {
	existing, err := tx.ProfileCheckmark.Query().Where(profilecheckmark.ProfileID(change.Profile.ID)).ForUpdate().Only(ctx)
	var row *ent.ProfileCheckmark
	switch {
	case ent.IsNotFound(err):
		create := tx.ProfileCheckmark.Create().SetProfileID(change.Profile.ID).SetAccountID(change.Profile.AccountID).SetColor(change.Color).SetStatus(change.Status).SetSource(change.Source).SetHandleReserved(change.ReserveHandle)
		applyOptionalToCreate(create, change)
		row, err = create.Save(ctx)
	case err != nil:
		return nil, err
	default:
		update := existing.Update().SetColor(change.Color).SetStatus(change.Status).SetSource(change.Source).SetHandleReserved(existing.HandleReserved || change.ReserveHandle)
		applyOptionalToUpdate(update, change)
		row, err = update.Save(ctx)
	}
	if err != nil {
		return nil, err
	}
	if err := tx.Profile.UpdateOneID(change.Profile.ID).SetVerified(BadgeVisible(change.Status)).Exec(ctx); err != nil {
		return nil, err
	}
	return row, usersevents.EnqueueOutboxEventInTransaction(ctx, tx, checkmarkevents.CheckmarkChangedType, change.Profile.ID.String(), now, checkmarkevents.CheckmarkChangedData{
		ProfileId: change.Profile.ID.String(), AccountId: change.Profile.AccountID.String(), Color: string(change.Color), Status: string(change.Status), Source: string(change.Source),
		Lifetime: change.Source == profilecheckmark.SourceLifetimeGrant, BadgeVisible: BadgeVisible(change.Status), HandleReserved: row.HandleReserved, PeriodEnd: optionalTime(change.CurrentPeriodEnd),
	})
}

func applyOptionalToCreate(create *ent.ProfileCheckmarkCreate, change CheckmarkChange) {
	if change.SourceId != nil {
		create.SetSourceID(*change.SourceId)
	}
	if change.CurrentPeriodEnd != nil {
		create.SetCurrentPeriodEnd(*change.CurrentPeriodEnd)
	}
	if change.ReverificationDueAt != nil {
		create.SetReverificationDueAt(*change.ReverificationDueAt)
	}
	if change.GraceEndsAt != nil {
		create.SetGraceEndsAt(*change.GraceEndsAt)
	}
}

func applyOptionalToUpdate(update *ent.ProfileCheckmarkUpdateOne, change CheckmarkChange) {
	if change.SourceId != nil {
		update.SetSourceID(*change.SourceId)
	}
	if change.CurrentPeriodEnd != nil {
		update.SetCurrentPeriodEnd(*change.CurrentPeriodEnd)
	}
	if change.ReverificationDueAt != nil {
		update.SetReverificationDueAt(*change.ReverificationDueAt)
	}
	if change.GraceEndsAt != nil {
		update.SetGraceEndsAt(*change.GraceEndsAt)
	} else {
		update.ClearGraceEndsAt()
	}
}

func optionalTime(moment *time.Time) *string {
	if moment == nil {
		return nil
	}
	formatted := moment.UTC().Format(time.RFC3339)
	return &formatted
}
