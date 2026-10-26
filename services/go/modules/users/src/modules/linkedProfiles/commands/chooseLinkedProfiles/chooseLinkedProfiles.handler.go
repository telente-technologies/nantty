package chooselinkedprofiles

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/linkedprofile"
	"nantty/modules/users/src/generated/ent/profile"
	"nantty/modules/users/src/modules/linkedProfiles/services"
	usersservices "nantty/modules/users/src/services"
	"nantty/modules/users/src/types"
)

type Command struct {
	AccountId uuid.UUID
	Keep      []string
	Actor     *types.StaffActor
	Reason    string
}

type Handler struct {
	Container *container.Container
}

var ErrNothingToChoose = usersErrors.Conflict("NO_CHOICE_REQUIRED", "Your profiles already follow the rule.")

func (handler Handler) Execute(ctx context.Context, command Command) (services.Summary, error) {
	keep := map[uuid.UUID]bool{}
	for _, raw := range command.Keep {
		identifier, err := uuid.Parse(raw)
		if err != nil {
			return services.Summary{}, usersErrors.ValidationFailedFor("keep", "must list profile ids")
		}
		keep[identifier] = true
	}
	var before, after []map[string]string
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := usersservices.LockLinkedProfilesOfAccount(ctx, tx, command.AccountId); err != nil {
			return err
		}
		query := tx.LinkedProfile.Query().Where(linkedprofile.AccountID(command.AccountId))
		if command.Actor == nil {
			query = query.Where(linkedprofile.StatusNEQ(linkedprofile.StatusRetired))
		}
		rows, err := query.All(ctx)
		if err != nil {
			return err
		}
		if err := validateChoice(rows, keep, command.Actor != nil); err != nil {
			return err
		}
		before, after = describe(rows, nil), describe(rows, keep)
		return applyChoice(ctx, tx, rows, keep)
	})
	if err != nil {
		return services.Summary{}, err
	}
	if command.Actor != nil {
		err = usersservices.RecordStaffAuditEntry(ctx, *command.Actor, usersservices.StaffAuditEntry{
			Action: "linked_profiles.resolved", SubjectType: "account", SubjectId: command.AccountId.String(), Reason: command.Reason, Before: before, After: after,
		})
		if err != nil {
			return services.Summary{}, err
		}
	}
	return services.BuildSummary(ctx, handler.Container, command.AccountId)
}

func validateChoice(rows []*ent.LinkedProfile, keep map[uuid.UUID]bool, byStaff bool) error {
	held, slotKept, brandKept, matched := false, 0, 0, 0
	for _, row := range rows {
		held = held || row.Status == linkedprofile.StatusHeld
		if !keep[row.ProfileID] {
			continue
		}
		matched++
		if row.Kind == linkedprofile.KindBrand {
			brandKept++
		} else {
			slotKept++
		}
	}
	if !held && !byStaff {
		return ErrNothingToChoose
	}
	if matched != len(keep) {
		return usersErrors.ValidationFailedFor("keep", "must only list your own linked profiles")
	}
	if slotKept > 1 {
		return usersErrors.ErrProfileLimitStoreOrBusiness
	}
	if brandKept > 1 {
		return usersErrors.ErrProfileLimitOneBrand
	}
	return nil
}

func applyChoice(ctx context.Context, tx *ent.Tx, rows []*ent.LinkedProfile, keep map[uuid.UUID]bool) error {
	for _, row := range rows {
		if !keep[row.ProfileID] {
			if err := setState(ctx, tx, row, linkedprofile.StatusRetired); err != nil {
				return err
			}
		}
	}
	for _, row := range rows {
		if keep[row.ProfileID] {
			if err := setState(ctx, tx, row, linkedprofile.StatusActive); err != nil {
				return err
			}
		}
	}
	return nil
}

func setState(ctx context.Context, tx *ent.Tx, row *ent.LinkedProfile, status linkedprofile.Status) error {
	update := row.Update().SetStatus(status)
	if status == linkedprofile.StatusActive {
		update.ClearHoldReason()
	} else {
		update.SetHoldReason("Not kept when choosing profiles.")
	}
	if err := update.Exec(ctx); err != nil {
		return err
	}
	_, err := tx.Profile.Update().Where(profile.ID(row.ProfileID)).SetPublishingHeld(status != linkedprofile.StatusActive).Save(ctx)
	return err
}

func describe(rows []*ent.LinkedProfile, keep map[uuid.UUID]bool) []map[string]string {
	described := make([]map[string]string, 0, len(rows))
	for _, row := range rows {
		status := string(row.Status)
		if keep != nil {
			status = map[bool]string{true: "active", false: "retired"}[keep[row.ProfileID]]
		}
		described = append(described, map[string]string{"kind": string(row.Kind), "profileId": row.ProfileID.String(), "status": status})
	}
	return described
}
