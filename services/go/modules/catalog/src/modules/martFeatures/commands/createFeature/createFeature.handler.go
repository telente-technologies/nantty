package createfeature

import (
	"context"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/generated/ent"
	featureservices "zudomart/modules/catalog/src/modules/martFeatures/services"
	"zudomart/modules/catalog/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (any, error) {
	fields, err := featureservices.ResolveFields(handler.Container.Settings, command.Request, nil)
	if err != nil {
		return nil, err
	}
	var created *ent.MartFeature
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		count, err := tx.MartFeature.Query().Count(ctx)
		if err != nil {
			return err
		}
		created, err = tx.MartFeature.Create().SetTitle(fields.Title).SetNillableSubtitle(fields.Subtitle).SetKind(fields.Kind).SetImageID(fields.ImageId).
			SetTargetType(fields.TargetType).SetTargetValue(fields.TargetValue).SetCountries(fields.Countries).SetStartsAt(fields.StartsAt).
			SetNillableEndsAt(fields.EndsAt).SetPriority(count + 1).Save(ctx)
		if err != nil {
			return err
		}
		return services.RecordStaffChange(ctx, handler.Container, command.Actor, services.StaffChange{
			Action: "catalog.feature_created", SubjectType: featureservices.SubjectType, SubjectId: created.ID.String(), SubjectLabel: created.Title,
			Reason: command.Request.Reason, After: fields,
		})
	})
	if err != nil {
		return nil, err
	}
	return map[string]any{"item": featureservices.Present(handler.Container.Settings, created, handler.Container.Now())}, nil
}
