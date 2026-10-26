package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/enums"
	"nantty/modules/catalog/src/events"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/product"
	"nantty/modules/catalog/src/generated/ent/store"
	platformevents "nantty/platform/events"
)

type contentVisibilityChangedData struct {
	TargetType string `json:"targetType"`
	TargetId   string `json:"targetId"`
	Visibility string `json:"visibility"`
}

func ApplyContentVisibilityChangedMessage(deployed *container.Container) platformevents.MessageHandler {
	return func(ctx context.Context, body []byte) error {
		var envelope platformevents.EventEnvelope
		if err := json.Unmarshal(body, &envelope); err != nil {
			return fmt.Errorf("%w: catalog event is not an envelope", platformevents.ErrPoisonMessage)
		}
		if envelope.Type != "content.visibilityChanged" {
			return nil
		}
		var data contentVisibilityChangedData
		if err := json.Unmarshal(envelope.Data, &data); err != nil || !enums.IsModerationVisibility(data.Visibility) {
			return fmt.Errorf("%w: content.visibilityChanged data is malformed", platformevents.ErrPoisonMessage)
		}
		targetId, err := uuid.Parse(data.TargetId)
		if err != nil || (data.TargetType != "product" && data.TargetType != "store") {
			return nil
		}
		occurredAt := envelope.OccurredAt
		if occurredAt.IsZero() {
			occurredAt = deployed.Now()
		}
		return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
			return applyModerationVisibility(ctx, deployed, tx, data.TargetType, targetId, data.Visibility, occurredAt)
		})
	}
}

func applyModerationVisibility(ctx context.Context, deployed *container.Container, tx *ent.Tx, targetType string, targetId uuid.UUID, visibility string, occurredAt time.Time) error {
	now := deployed.Now()
	if targetType == "store" {
		affected, err := tx.Store.UpdateOneID(targetId).Where(store.Or(store.ModerationVisibilityAtIsNil(), store.ModerationVisibilityAtLT(occurredAt))).
			SetModerationVisibility(visibility).SetModerationVisibilityAt(occurredAt).Save(ctx)
		if ent.IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "store.updated", affected.ID.String(), now, map[string]any{"storeId": affected.ID, "moderationVisibility": visibility})
	}
	affected, err := tx.Product.UpdateOneID(targetId).Where(product.Or(product.ModerationVisibilityAtIsNil(), product.ModerationVisibilityAtLT(occurredAt))).
		SetModerationVisibility(visibility).SetModerationVisibilityAt(occurredAt).Save(ctx)
	if ent.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	return events.EnqueueOutboxEventInTransaction(ctx, tx, "product.updated", affected.ID.String(), now, map[string]any{
		"productId": affected.ID, "storeId": affected.StoreID, "status": affected.Status, "visibility": affected.Visibility, "categoryId": affected.CategoryID, "moderationVisibility": visibility,
	})
}

func ConsumeCatalogEventsUntilContextDone(ctx context.Context, deployed *container.Container, bus platformevents.MessageBusSelection) {
	if deployed.Settings.EventsQueueName == "" {
		return
	}
	_, queues, err := platformevents.CreateJobQueueAndConsumerFromEnvironment(ctx, bus)
	if err != nil || queues == nil {
		deployed.Logger.Error("catalog event consumer disabled: no message broker configured", slog.Any("error", err))
		return
	}
	if err := queues.ConsumeQueueUntilContextDone(ctx, deployed.Settings.EventsQueueName, ApplyContentVisibilityChangedMessage(deployed), deployed.Logger); err != nil {
		deployed.Logger.Error("catalog event consumer stopped", slog.Any("error", err))
	}
}
