package updatestaffmember

import (
	"context"
	"strings"

	"zudomart/modules/catalog/src/container"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/storemember"
	addstaffmember "zudomart/modules/catalog/src/modules/storeTeam/commands/addStaffMember"
	"zudomart/modules/catalog/src/modules/storeTeam/dtos"
	"zudomart/modules/catalog/src/modules/storeTeam/services"
	catalogservices "zudomart/modules/catalog/src/services"
	"zudomart/modules/catalog/src/utils"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.StaffMemberView, error) {
	request := command.Request
	if request.LocationIds != nil {
		if err := addstaffmember.RequireStoreLocations(ctx, command.Store, *request.LocationIds); err != nil {
			return dtos.StaffMemberView{}, err
		}
	}
	var updated *ent.StoreMember
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		storeRow, err := services.LockStoreForTeamChange(ctx, tx, command.Store.StoreId)
		if err != nil {
			return err
		}
		member, err := tx.StoreMember.Query().Where(storemember.ID(command.MemberId), storemember.StoreID(storeRow.ID)).Only(ctx)
		if ent.IsNotFound(err) {
			return catalogerrors.StaffNotFound
		}
		if err != nil {
			return err
		}
		if err := guardStaffChange(command, member); err != nil {
			return err
		}
		update := member.Update()
		changed := []string{}
		if request.Role != nil && *request.Role != member.Role {
			update.SetRole(*request.Role)
			changed = append(changed, "role "+member.Role+" to "+*request.Role)
		}
		if request.LocationIds != nil {
			update.SetLocationIds(*request.LocationIds)
			changed = append(changed, "locations")
		}
		if request.Permissions.Present {
			if request.Permissions.Values == nil {
				update.ClearPermissions()
				changed = append(changed, "permissions reset to role defaults")
			} else {
				update.SetPermissions(request.Permissions.Values)
				changed = append(changed, "custom permissions")
			}
		}
		if request.Status != nil && *request.Status != member.Status {
			if member.Status == "invited" {
				var issues utils.Issues
				issues.Add("status", "the person must accept the team request in the Zudomart app first")
				return issues.AsError()
			}
			if *request.Status == "active" {
				if err := services.RequireFreeSeat(ctx, tx, storeRow.ID, command.Plan, &member.ID); err != nil {
					return err
				}
			}
			update.SetStatus(*request.Status)
			changed = append(changed, "status "+*request.Status)
		}
		if updated, err = update.Save(ctx); err != nil {
			return err
		}
		if len(changed) == 0 {
			return nil
		}
		summary := "Changed " + strings.Join(changed, ", ")
		if err := catalogservices.RecordStoreAuditInTransaction(ctx, tx, catalogservices.AuditRecordFor(command.Store, command.Actor, "staff.updated", "staff", member.ID.String(), summary)); err != nil {
			return err
		}
		return services.EnqueueTeamEvent(ctx, tx, "store.staff_updated", updated, storeRow.Name, command.Actor.AccountId, handler.Container.Now())
	})
	if err != nil {
		return dtos.StaffMemberView{}, err
	}
	views, err := services.PresentStaffMembers(ctx, handler.Container, []*ent.StoreMember{updated})
	if err != nil {
		return dtos.StaffMemberView{}, err
	}
	return views[0], nil
}

func guardStaffChange(command Command, member *ent.StoreMember) error {
	if member.AccountID == command.Actor.AccountId {
		return catalogerrors.CannotEditSelf
	}
	if member.Role == "owner" {
		return catalogerrors.OwnerProtected
	}
	if command.Request.Role != nil && *command.Request.Role == "owner" {
		return catalogerrors.OwnerRoleReserved
	}
	touchesManager := member.Role == "manager" || (command.Request.Role != nil && *command.Request.Role == "manager")
	if touchesManager && command.Store.Role != "owner" {
		return catalogerrors.OwnerOnly
	}
	return nil
}
