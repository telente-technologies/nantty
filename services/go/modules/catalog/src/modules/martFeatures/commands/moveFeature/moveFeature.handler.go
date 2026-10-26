package movefeature

import (
	"context"
	"slices"

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
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		ordered, err := featureservices.Ordered(ctx, tx.Client())
		if err != nil {
			return err
		}
		index := slices.IndexFunc(ordered, func(row *ent.MartFeature) bool { return row.ID == command.FeatureId })
		if index < 0 {
			return catalogerrors.NotFound
		}
		target := index - 1
		if command.Direction == "down" {
			target = index + 1
		}
		if target < 0 || target >= len(ordered) {
			return catalogerrors.CannotMove
		}
		moving := ordered[index]
		ordered[index], ordered[target] = ordered[target], ordered[index]
		for position, row := range ordered {
			if row.Priority != position+1 {
				if err := tx.MartFeature.UpdateOneID(row.ID).SetPriority(position + 1).Exec(ctx); err != nil {
					return err
				}
			}
		}
		return services.RecordStaffChange(ctx, handler.Container, command.Actor, services.StaffChange{
			Action: "catalog.feature_reordered", SubjectType: featureservices.SubjectType, SubjectId: moving.ID.String(), SubjectLabel: moving.Title,
			Before: map[string]int{"priority": index + 1}, After: map[string]int{"priority": target + 1},
		})
	})
	if err != nil {
		return nil, err
	}
	views, err := featureservices.PresentAll(ctx, handler.Container)
	return map[string]any{"items": views}, err
}
