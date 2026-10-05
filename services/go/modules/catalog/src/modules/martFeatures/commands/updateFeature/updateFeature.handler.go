package updatefeature

import (
	"context"
	"reflect"

	"zudomart/modules/catalog/src/container"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/generated/ent"
	featureservices "zudomart/modules/catalog/src/modules/martFeatures/services"
	"zudomart/modules/catalog/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (any, error) {
	var updated *ent.MartFeature
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.MartFeature.Get(ctx, command.FeatureId)
		if ent.IsNotFound(err) {
			return catalogerrors.NotFound
		}
		if err != nil {
			return err
		}
		before := featureservices.FieldsOf(row)
		after, err := featureservices.ResolveFields(handler.Container.Settings, command.Request, &before)
		if err != nil {
			return err
		}
		if reflect.DeepEqual(before, after) {
			return catalogerrors.NoChange
		}
		updated, err = row.Update().SetTitle(after.Title).ClearSubtitle().SetNillableSubtitle(after.Subtitle).SetKind(after.Kind).SetImageID(after.ImageId).
			SetTargetType(after.TargetType).SetTargetValue(after.TargetValue).SetCountries(after.Countries).SetStartsAt(after.StartsAt).
			ClearEndsAt().SetNillableEndsAt(after.EndsAt).Save(ctx)
		if err != nil {
			return err
		}
		return services.RecordStaffChange(ctx, handler.Container, command.Actor, services.StaffChange{
			Action: "catalog.feature_updated", SubjectType: featureservices.SubjectType, SubjectId: row.ID.String(), SubjectLabel: after.Title,
			Reason: command.Request.Reason, Before: before, After: after,
		})
	})
	if err != nil {
		return nil, err
	}
	return map[string]any{"item": featureservices.Present(handler.Container.Settings, updated, handler.Container.Now())}, nil
}
