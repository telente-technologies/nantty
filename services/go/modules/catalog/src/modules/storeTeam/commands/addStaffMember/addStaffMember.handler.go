package addstaffmember

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/storemember"
	"nantty/modules/catalog/src/modules/storeTeam/dtos"
	"nantty/modules/catalog/src/modules/storeTeam/services"
	catalogservices "nantty/modules/catalog/src/services"
	"nantty/modules/catalog/src/utils"
	"nantty/platform/commerceports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.StaffMemberView, error) {
	request := command.Request
	if request.Role == "owner" {
		return dtos.StaffMemberView{}, catalogerrors.OwnerRoleReserved
	}
	if request.Role == "manager" && command.Store.Role != "owner" {
		return dtos.StaffMemberView{}, catalogerrors.OwnerOnly
	}
	accountId := uuid.MustParse(request.UserId)
	profile, active, err := handler.Container.Users.ActivePersonalProfileExists(ctx, accountId)
	if err != nil {
		return dtos.StaffMemberView{}, err
	}
	if !active {
		var issues utils.Issues
		issues.Add("userId", "must be an existing Nantty user")
		return dtos.StaffMemberView{}, issues.AsError()
	}
	if err := RequireStoreLocations(ctx, command.Store, request.LocationIds); err != nil {
		return dtos.StaffMemberView{}, err
	}
	var created *ent.StoreMember
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		storeRow, err := services.LockStoreForTeamChange(ctx, tx, command.Store.StoreId)
		if err != nil {
			return err
		}
		exists, err := tx.StoreMember.Query().Where(storemember.StoreID(storeRow.ID), storemember.AccountID(accountId)).Exist(ctx)
		if err != nil {
			return err
		}
		if exists {
			return catalogerrors.StaffExists
		}
		if err := services.RequireFreeSeat(ctx, tx, storeRow.ID, command.Plan, nil); err != nil {
			return err
		}
		create := tx.StoreMember.Create().SetStoreID(storeRow.ID).SetAccountID(accountId).SetRole(request.Role).SetStatus("invited").
			SetLocationIds(request.LocationIds).SetInvitedByAccountID(command.Actor.AccountId)
		if request.Permissions != nil {
			create.SetPermissions(*request.Permissions)
		}
		if created, err = create.Save(ctx); err != nil {
			return err
		}
		summary := "Invited @" + profile.Handle + " as " + request.Role
		if err := catalogservices.RecordStoreAuditInTransaction(ctx, tx, catalogservices.AuditRecordFor(command.Store, command.Actor, "staff.invited", "staff", created.ID.String(), summary)); err != nil {
			return err
		}
		return services.EnqueueTeamEvent(ctx, tx, "store.staff_invited", created, storeRow.Name, command.Actor.AccountId, handler.Container.Now())
	})
	if err != nil {
		return dtos.StaffMemberView{}, err
	}
	return services.PresentStaffMember(created, profile), nil
}

func RequireStoreLocations(ctx context.Context, store commerceports.StoreAccess, locationIds []string) error {
	inventory, err := commerceports.Default.InventoryStock()
	if err != nil {
		return err
	}
	parsed := make([]uuid.UUID, 0, len(locationIds))
	for _, raw := range locationIds {
		parsed = append(parsed, uuid.MustParse(raw))
	}
	owned, err := inventory.StoreOwnsLocations(ctx, store.StoreId, parsed)
	if err != nil {
		return err
	}
	if !owned {
		var issues utils.Issues
		issues.Add("locationIds", "must be locations of this store")
		return issues.AsError()
	}
	return nil
}
