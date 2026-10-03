package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	platformevents "zudomart/platform/events"
)

type EntitlementApplier func(ctx context.Context, eventType string, data json.RawMessage) error

func HandleEntitlementEventMessage(apply EntitlementApplier) platformevents.MessageHandler {
	return func(ctx context.Context, body []byte) error {
		var envelope platformevents.EventEnvelope
		if err := json.Unmarshal(body, &envelope); err != nil || envelope.Type == "" {
			return fmt.Errorf("%w: entitlement event: %v", platformevents.ErrPoisonMessage, err)
		}
		if !strings.HasPrefix(envelope.Type, "entitlement.") {
			return nil
		}
		return apply(ctx, envelope.Type, envelope.Data)
	}
}
