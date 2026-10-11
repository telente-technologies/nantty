package reassignbrand

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/events"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/brand"
	"zudomart/modules/catalog/src/services"
	"zudomart/platform/httpserver"
)

type Command struct {
	Actor       services.StaffActor
	BrandId     uuid.UUID
	ToAccountId string
	Reason      string
}

type Result struct {
	BrandId        string `json:"brandId"`
	OwnerAccountId string `json:"ownerAccountId"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	reason := strings.TrimSpace(command.Reason)
	target, err := uuid.Parse(command.ToAccountId)
	if err != nil || len(reason) < 5 || len(reason) > 500 {
		return Result{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "reason", Message: "send toAccountId and a reason of 5 to 500 characters"}})
	}
	if _, found, err := handler.Container.Users.ActivePersonalProfileExists(ctx, target); err != nil || !found {
		return Result{}, firstError(err, catalogerrors.NotFound)
	}
	row, err := handler.Container.Client.Brand.Query().Where(brand.ID(command.BrandId)).Only(ctx)
	if ent.IsNotFound(err) {
		return Result{}, catalogerrors.BrandNotFound
	}
	if err != nil {
		return Result{}, err
	}
	if row.OwnerAccountID == nil {
		return Result{}, catalogerrors.BrandNotFound
	}
	previous := *row.OwnerAccountID
	if err := handler.Container.LinkedProfiles.TransferBrand(ctx, row.ID, previous, target); err != nil {
		return Result{}, err
	}
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := tx.Brand.UpdateOneID(row.ID).SetOwnerAccountID(target).Exec(ctx); err != nil {
			return err
		}
		if err := events.EnqueueOutboxEventInTransaction(ctx, tx, "brand.updated", row.ID.String(), handler.Container.Now(), map[string]any{"brandId": row.ID, "ownerAccountId": target}); err != nil {
			return err
		}
		return services.RecordStaffChange(ctx, handler.Container, command.Actor, services.StaffChange{
			Action: "brand.reassigned", SubjectType: "brand", SubjectId: row.ID.String(), SubjectLabel: row.Name, Reason: reason,
			Before: map[string]string{"ownerAccountId": previous.String()}, After: map[string]string{"ownerAccountId": target.String()},
		})
	})
	if err != nil {
		if rollbackErr := handler.Container.LinkedProfiles.TransferBrand(ctx, row.ID, target, previous); rollbackErr != nil {
			handler.Container.Logger.Error("restore brand registry owner", "error", rollbackErr)
		}
		return Result{}, err
	}
	return Result{BrandId: row.ID.String(), OwnerAccountId: target.String()}, nil
}

func firstError(primary, fallback error) error {
	if primary != nil {
		return primary
	}
	return fallback
}
