package decideapplication

import (
	"context"
	"log/slog"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/events"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/sellerapplication"
	"zudomart/modules/catalog/src/interfaces"
	applicationservices "zudomart/modules/catalog/src/modules/sellerApplications/services"
	"zudomart/modules/catalog/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	status, decision, action := "rejected", "rejected", "seller_application.rejected"
	if command.Approve {
		status, decision, action = "approved", "approved", "seller_application.approved"
	}
	var accountId uuid.UUID
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.SellerApplication.Query().Where(sellerapplication.ID(command.ApplicationId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return catalogerrors.NotFound
		}
		if err != nil {
			return err
		}
		if row.Status != "pending" {
			return catalogerrors.AlreadyDecided
		}
		accountId = row.AccountID
		now := handler.Container.Now()
		name := command.Actor.Staff.Name
		if err := row.Update().SetStatus(status).SetReviewedAt(now).SetReviewedByID(command.Actor.Staff.Id).SetReviewedByName(name).SetDecisionReason(command.Reason).Exec(ctx); err != nil {
			return err
		}
		if err := events.EnqueueOutboxEventInTransaction(ctx, tx, "sellerApplication.reviewed", row.ID.String(), now, map[string]any{
			"applicationId": row.ID, "accountId": row.AccountID, "decision": decision, "reason": command.Reason, "storeName": row.StoreName, "categoryId": row.CategoryID,
		}); err != nil {
			return err
		}
		return services.RecordStaffChange(ctx, handler.Container, command.Actor, services.StaffChange{
			Action: action, SubjectType: applicationservices.SubjectType, SubjectId: row.ID.String(), SubjectLabel: row.StoreName, Reason: command.Reason,
			Before: map[string]string{"status": "PENDING"}, After: map[string]string{"status": map[bool]string{true: "APPROVED", false: "REJECTED"}[command.Approve]},
		})
	})
	if err != nil || command.Approve {
		return err
	}
	if releaseErr := handler.Container.LinkedProfiles.Release(ctx, accountId, interfaces.LinkedClaim{Kind: "store", ProfileId: command.ApplicationId}); releaseErr != nil {
		handler.Container.Logger.Error("release linked store claim", slog.Any("error", releaseErr))
	}
	return nil
}
