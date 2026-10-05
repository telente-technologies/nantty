package removestaffmember

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/storemember"
	"zudomart/modules/catalog/src/modules/storeTeam/services"
	catalogservices "zudomart/modules/catalog/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
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
		switch {
		case member.AccountID == command.Actor.AccountId:
			return catalogerrors.CannotRemoveSelf
		case member.Role == "owner":
			return catalogerrors.OwnerProtected
		case member.Role == "manager" && command.Store.Role != "owner":
			return catalogerrors.OwnerOnly
		}
		if err := tx.StoreMember.DeleteOne(member).Exec(ctx); err != nil {
			return err
		}
		profiles, err := handler.Container.Users.PersonalProfilesByAccount(ctx, []uuid.UUID{member.AccountID})
		if err != nil {
			return err
		}
		summary := "Removed @" + profiles[member.AccountID].Handle + " (" + member.Role + ")"
		if err := catalogservices.RecordStoreAuditInTransaction(ctx, tx, catalogservices.AuditRecordFor(command.Store, command.Actor, "staff.removed", "staff", member.ID.String(), summary)); err != nil {
			return err
		}
		member.Status = "removed"
		return services.EnqueueTeamEvent(ctx, tx, "store.staff_removed", member, storeRow.Name, command.Actor.AccountId, handler.Container.Now())
	})
}
