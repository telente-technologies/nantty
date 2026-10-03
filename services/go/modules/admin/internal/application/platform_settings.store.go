package application

import (
	"context"
	"encoding/json"
	"slices"
	"strings"
	"time"

	"zudomart/modules/admin/internal/ent"
	"zudomart/modules/admin/internal/ent/platformsetting"
	"zudomart/platform/identityports"
	"zudomart/platform/staffauth"
)

type PlatformSettingView struct {
	Key       string          `json:"key"`
	Value     json.RawMessage `json:"value"`
	Version   int             `json:"version"`
	UpdatedBy string          `json:"updatedBy"`
	UpdatedAt string          `json:"updatedAt"`
}

type PlatformSettingChangedEventData struct {
	Key       string `json:"key"`
	Version   int    `json:"version"`
	ChangedBy string `json:"changedBy"`
}

type UpdatePlatformSettingInput struct {
	Key             string
	Value           json.RawMessage
	ExpectedVersion int
	Reason          string
}

func convertSettingToView(row *ent.PlatformSetting) PlatformSettingView {
	return PlatformSettingView{Key: row.Key, Value: row.Value, Version: row.Version, UpdatedBy: row.UpdatedBy, UpdatedAt: row.UpdatedAt.UTC().Format(time.RFC3339)}
}

func (application *AdminApplication) SeedDefaultPlatformSettings(ctx context.Context) error {
	for key, definition := range platformSettingDefinitions {
		raw, err := json.Marshal(definition.defaultValue)
		if err != nil {
			return err
		}
		seeded := application.runInTransaction(ctx, func(tx *ent.Tx) error {
			if exists, err := tx.PlatformSetting.Query().Where(platformsetting.Key(key)).Exist(ctx); err != nil || exists {
				return err
			}
			now := application.Now()
			if err := tx.PlatformSetting.Create().SetKey(key).SetValue(raw).SetVersion(1).SetUpdatedBy("system").SetUpdatedAt(now).Exec(ctx); err != nil {
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

func (application *AdminApplication) ListPlatformSettings(ctx context.Context) ([]PlatformSettingView, error) {
	rows, err := application.Client.PlatformSetting.Query().Order(ent.Asc(platformsetting.FieldKey)).All(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]PlatformSettingView, 0, len(rows))
	for _, row := range rows {
		views = append(views, convertSettingToView(row))
	}
	return views, nil
}

func (application *AdminApplication) GetPlatformSetting(ctx context.Context, key string) (PlatformSettingView, error) {
	row, err := application.Client.PlatformSetting.Query().Where(platformsetting.Key(key)).Only(ctx)
	if ent.IsNotFound(err) {
		return PlatformSettingView{}, errSettingNotFound
	}
	if err != nil {
		return PlatformSettingView{}, err
	}
	return convertSettingToView(row), nil
}

func (application *AdminApplication) ReadSettingValue(ctx context.Context, key string) (json.RawMessage, int, error) {
	view, err := application.GetPlatformSetting(ctx, key)
	if err == errSettingNotFound {
		return nil, 0, identityports.ErrSettingNotFound
	}
	return view.Value, view.Version, err
}

func (application *AdminApplication) ReadPublicPlatformSetting(ctx context.Context, key string) (PlatformSettingView, error) {
	if definition, known := platformSettingDefinitions[key]; !known || !definition.public {
		return PlatformSettingView{}, errSettingNotFound
	}
	return application.GetPlatformSetting(ctx, key)
}

func (application *AdminApplication) UpdatePlatformSettingWithOptimisticVersion(ctx context.Context, actor staffauth.Staff, input UpdatePlatformSettingInput) (PlatformSettingView, error) {
	definition, known := platformSettingDefinitions[input.Key]
	if !known {
		return PlatformSettingView{}, errSettingNotFound
	}
	if len(strings.TrimSpace(input.Reason)) < 5 || len(input.Reason) > 500 {
		return PlatformSettingView{}, unprocessable("Give a reason of 5-500 characters.")
	}
	canonical, err := definition.validate(input.Value)
	if err != nil {
		return PlatformSettingView{}, err
	}
	var updated *ent.PlatformSetting
	err = application.runInTransaction(ctx, func(tx *ent.Tx) error {
		current, err := tx.PlatformSetting.Query().Where(platformsetting.Key(input.Key)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return errSettingNotFound
		}
		if err != nil {
			return err
		}
		if current.Version != input.ExpectedVersion {
			return errVersionConflict
		}
		now := application.Now()
		if updated, err = current.Update().SetValue(canonical).SetVersion(current.Version + 1).SetUpdatedBy(actor.Id).SetUpdatedAt(now).Save(ctx); err != nil {
			return err
		}
		if err := tx.PlatformSettingRevision.Create().SetKey(input.Key).SetVersion(updated.Version).SetValue(canonical).SetReason(strings.TrimSpace(input.Reason)).SetActor(actor.Id).Exec(ctx); err != nil {
			return err
		}
		if err := enqueueOutboxEventInTransaction(ctx, tx, "platformSetting.changed", input.Key, now, PlatformSettingChangedEventData{Key: input.Key, Version: updated.Version, ChangedBy: actor.Id}); err != nil {
			return err
		}
		return application.recordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: actor.Id, ActorRole: actor.Role, Action: "platform_setting.changed", SubjectType: "platform_setting", SubjectId: input.Key,
			Before: current.Value, After: canonical, Reason: strings.TrimSpace(input.Reason),
		})
	})
	if err != nil {
		return PlatformSettingView{}, err
	}
	return convertSettingToView(updated), nil
}

func KnownPlatformSettingKeys() []string {
	keys := make([]string, 0, len(platformSettingDefinitions))
	for key := range platformSettingDefinitions {
		keys = append(keys, key)
	}
	slices.Sort(keys)
	return keys
}
