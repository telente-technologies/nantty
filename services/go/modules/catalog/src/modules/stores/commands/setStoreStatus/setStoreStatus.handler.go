package setstorestatus

import (
	"context"
	"time"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/enums"
	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/events"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/services"
)

type Handler struct {
	Container *container.Container
}

type StoreStatusView struct {
	Id              string     `json:"id"`
	Name            string     `json:"name"`
	Status          string     `json:"status"`
	StatusReason    *string    `json:"statusReason"`
	StatusChangedAt *time.Time `json:"statusChangedAt"`
}

func (handler Handler) Execute(ctx context.Context, command Command) (StoreStatusView, error) {
	var updated *ent.Store
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.Store.Get(ctx, command.StoreId)
		if ent.IsNotFound(err) {
			return catalogerrors.StoreNotFound
		}
		if err != nil {
			return err
		}
		if row.Status == command.Status {
			return catalogerrors.NoChange
		}
		now := handler.Container.Now()
		if updated, err = row.Update().SetStatus(command.Status).SetStatusReason(command.Reason).SetStatusChangedAt(now).Save(ctx); err != nil {
			return err
		}
		payload := map[string]any{"storeId": row.ID, "ownerAccountId": row.OwnerAccountID, "status": command.Status, "previousStatus": row.Status, "reason": command.Reason}
		if err := events.EnqueueOutboxEventInTransaction(ctx, tx, "store.statusChanged", row.ID.String(), now, payload); err != nil {
			return err
		}
		if err := events.EnqueueOutboxEventInTransaction(ctx, tx, "store.updated", row.ID.String(), now, map[string]any{"storeId": row.ID}); err != nil {
			return err
		}
		action := "store.suspended"
		if command.Status == enums.StoreActive {
			action = "store.reinstated"
		}
		return services.RecordStaffChange(ctx, handler.Container, command.Actor, services.StaffChange{
			Action: action, SubjectType: "store", SubjectId: row.ID.String(), SubjectLabel: row.Name, Reason: command.Reason,
			Before: map[string]string{"status": row.Status}, After: map[string]string{"status": command.Status},
		})
	})
	if err != nil {
		return StoreStatusView{}, err
	}
	return StoreStatusView{Id: updated.ID.String(), Name: updated.Name, Status: updated.Status, StatusReason: updated.StatusReason, StatusChangedAt: updated.StatusChangedAt}, nil
}
