package convertlinkedprofile

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/linkedprofile"
	"zudomart/modules/users/src/modules/linkedProfiles/services"
	usersservices "zudomart/modules/users/src/services"
	"zudomart/modules/users/src/types"
)

type Command struct {
	Actor     types.StaffActor
	AccountId uuid.UUID
	ProfileId string
	ToKind    string
	Reason    string
}

type Handler struct {
	Container *container.Container
}

var ErrStoreStillOpen = usersErrors.Conflict("STORE_STILL_OPEN", "Close the store before turning it into a business page.")

func (handler Handler) Execute(ctx context.Context, command Command) (services.Summary, error) {
	reason := strings.TrimSpace(command.Reason)
	if len(reason) < 5 || len(reason) > 500 {
		return services.Summary{}, usersErrors.ValidationFailedFor("reason", "must be 5 to 500 characters")
	}
	profileId, err := uuid.Parse(command.ProfileId)
	if err != nil || (command.ToKind != "store" && command.ToKind != "business") {
		return services.Summary{}, usersErrors.ValidationFailedFor("toKind", "must be store or business for one of the account's profiles")
	}
	target := linkedprofile.Kind(command.ToKind)
	var previous linkedprofile.Kind
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := usersservices.LockLinkedProfilesOfAccount(ctx, tx, command.AccountId); err != nil {
			return err
		}
		row, err := tx.LinkedProfile.Query().Where(linkedprofile.AccountID(command.AccountId), linkedprofile.ProfileID(profileId), linkedprofile.KindIn(linkedprofile.KindStore, linkedprofile.KindBusiness)).Only(ctx)
		if ent.IsNotFound(err) {
			return usersErrors.ErrProfileNotFound
		}
		if err != nil {
			return err
		}
		if row.Kind == target {
			return usersErrors.Conflict("NO_CHANGE", "That profile is already a "+command.ToKind+".")
		}
		previous = row.Kind
		update := row.Update().SetKind(target)
		if target == linkedprofile.KindBusiness && row.StoreID != nil {
			open, err := handler.storeIsOpen(ctx, command.AccountId, *row.StoreID)
			if err != nil {
				return err
			}
			if open {
				return ErrStoreStillOpen
			}
			update.ClearStoreID()
		}
		return update.Exec(ctx)
	})
	if err != nil {
		return services.Summary{}, err
	}
	err = usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
		Action: "linked_profiles.converted", SubjectType: "account", SubjectId: command.AccountId.String(), SubjectLabel: profileId.String(), Reason: reason,
		Before: map[string]string{"profileId": profileId.String(), "kind": string(previous)}, After: map[string]string{"profileId": profileId.String(), "kind": command.ToKind},
	})
	if err != nil {
		return services.Summary{}, err
	}
	return services.BuildSummary(ctx, handler.Container, command.AccountId)
}

func (handler Handler) storeIsOpen(ctx context.Context, accountId, storeId uuid.UUID) (bool, error) {
	if handler.Container.Catalog == nil {
		return true, nil
	}
	stores, err := handler.Container.Catalog.FindStoresOfAccounts(ctx, []uuid.UUID{accountId})
	if err != nil {
		return true, err
	}
	for _, store := range stores {
		if store.Id == storeId {
			return store.Status != "closed", nil
		}
	}
	return false, nil
}
