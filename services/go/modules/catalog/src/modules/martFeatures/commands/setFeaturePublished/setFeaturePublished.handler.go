package setfeaturepublished

import (
	"context"

	"nantty/modules/catalog/src/container"
	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/generated/ent"
	featureservices "nantty/modules/catalog/src/modules/martFeatures/services"
	"nantty/modules/catalog/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (any, error) {
	var updated *ent.MartFeature
	now := handler.Container.Now()
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.MartFeature.Get(ctx, command.FeatureId)
		if ent.IsNotFound(err) {
			return catalogerrors.NotFound
		}
		if err != nil {
			return err
		}
		if row.IsPublished == command.Published {
			return catalogerrors.NoChange
		}
		if updated, err = row.Update().SetIsPublished(command.Published).Save(ctx); err != nil {
			return err
		}
		action := "catalog.feature_published"
		if !command.Published {
			action = "catalog.feature_unpublished"
		}
		return services.RecordStaffChange(ctx, handler.Container, command.Actor, services.StaffChange{
			Action: action, SubjectType: featureservices.SubjectType, SubjectId: row.ID.String(), SubjectLabel: row.Title, Reason: command.Reason,
			Before: map[string]any{"isPublished": row.IsPublished, "status": featureservices.StatusOf(row, now)},
			After:  map[string]any{"isPublished": updated.IsPublished, "status": featureservices.StatusOf(updated, now)},
		})
	})
	if err != nil {
		return nil, err
	}
	return map[string]any{"item": featureservices.Present(handler.Container.Settings, updated, now)}, nil
}
