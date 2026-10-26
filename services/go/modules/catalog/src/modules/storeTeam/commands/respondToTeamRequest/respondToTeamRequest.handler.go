package respondtoteamrequest

import (
	"context"

	"nantty/modules/catalog/src/container"
	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/storemember"
	"nantty/modules/catalog/src/modules/storeTeam/services"
	catalogservices "nantty/modules/catalog/src/services"
	"nantty/platform/commerceports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		member, err := tx.StoreMember.Query().Where(storemember.ID(command.MemberId), storemember.AccountID(command.Actor.AccountId), storemember.Status("invited")).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return catalogerrors.TeamRequestNotFound
		}
		if err != nil {
			return err
		}
		storeRow, err := tx.Store.Get(ctx, member.StoreID)
		if err != nil {
			return err
		}
		now := handler.Container.Now()
		action, summary, eventType := "staff.declined", "Declined the team request", "store.staff_declined"
		if command.Accept {
			if member, err = member.Update().SetStatus("active").SetAcceptedAt(now).SetLastActiveAt(now).Save(ctx); err != nil {
				return err
			}
			action, summary, eventType = "staff.joined", "Joined the team as "+member.Role, "store.staff_joined"
		} else if err := tx.StoreMember.DeleteOne(member).Exec(ctx); err != nil {
			return err
		}
		store := commerceports.StoreAccess{StoreId: member.StoreID}
		actor := command.Actor
		actor.Role = member.Role
		if err := catalogservices.RecordStoreAuditInTransaction(ctx, tx, catalogservices.AuditRecordFor(store, actor, action, "staff", member.ID.String(), summary)); err != nil {
			return err
		}
		return services.EnqueueTeamEvent(ctx, tx, eventType, member, storeRow.Name, command.Actor.AccountId, now)
	})
}
