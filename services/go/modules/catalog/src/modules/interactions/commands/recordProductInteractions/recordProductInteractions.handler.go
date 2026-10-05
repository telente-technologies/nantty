package recordproductinteractions

import (
	"context"
	"time"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/events"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/modules/interactions/dtos"
	"zudomart/modules/catalog/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.InteractionBatchResult, error) {
	now := handler.Container.Now()
	result := dtos.InteractionBatchResult{}
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		result = dtos.InteractionBatchResult{}
		for _, record := range command.Events {
			occurredAt := record.OccurredAt
			if occurredAt.IsZero() || occurredAt.After(now.Add(5*time.Minute)) || occurredAt.Before(now.Add(-24*time.Hour)) {
				occurredAt = now
			}
			data, kept := services.BuildInteractionEventData(services.InteractionInput{Event: record.Event, Payload: record.Payload, OccurredAt: occurredAt}, command.Actor, command.Consent)
			if !kept {
				result.Dropped++
				continue
			}
			if err := events.EnqueueOutboxEventInTransaction(ctx, tx, record.Event, subjectOf(data), occurredAt, data); err != nil {
				return err
			}
			if err := services.RecordStoreTrafficInTransaction(ctx, tx, record.Event, data, occurredAt); err != nil {
				return err
			}
			if err := services.RecordStoreVisitWhenPersonalized(ctx, tx, record.Event, data, occurredAt); err != nil {
				return err
			}
			result.Accepted++
		}
		return nil
	})
	return result, err
}

func subjectOf(data map[string]any) string {
	for _, key := range []string{"productId", "storeId", "categoryId"} {
		if value, found := data[key].(string); found {
			return value
		}
	}
	return "anonymous"
}
