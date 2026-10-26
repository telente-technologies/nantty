package seeddefaultsettings

import (
	"context"
	"encoding/json"

	"nantty/modules/admin/src/container"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/platformsetting"
	"nantty/modules/admin/src/modules/platformSettings/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, _ Command) error {
	for key, definition := range services.PlatformSettingDefinitions {
		if definition.Projection != nil {
			continue
		}
		raw, err := json.Marshal(definition.DefaultValue)
		if err != nil {
			return err
		}
		seeded := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
			if exists, err := tx.PlatformSetting.Query().Where(platformsetting.Key(key)).Exist(ctx); err != nil || exists {
				return err
			}
			if err := tx.PlatformSetting.Create().SetKey(key).SetValue(raw).SetVersion(1).SetUpdatedBy("system").SetUpdatedAt(handler.Container.Now()).Exec(ctx); err != nil {
				return err
			}
			return tx.PlatformSettingRevision.Create().SetKey(key).SetVersion(1).SetValue(raw).SetReason("initial defaults").SetActor("system").Exec(ctx)
		})
		if seeded != nil && !ent.IsConstraintError(seeded) {
			return seeded
		}
	}
	return nil
}
