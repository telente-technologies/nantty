package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	usersservices "zudomart/modules/users/src/services"

	platformevents "zudomart/platform/events"
)

const AccountRegisteredEventType = "account.registered"

type EntitlementApplier func(ctx context.Context, eventType string, data json.RawMessage) error

func HandleEntitlementEventMessage(apply EntitlementApplier) platformevents.MessageHandler {
	return func(ctx context.Context, body []byte) error {
		var envelope platformevents.EventEnvelope
		if err := json.Unmarshal(body, &envelope); err != nil || envelope.Type == "" {
			return fmt.Errorf("%w: entitlement event: %v", platformevents.ErrPoisonMessage, err)
		}
		if !strings.HasPrefix(envelope.Type, "entitlement.") && !strings.HasPrefix(envelope.Type, "verificationRefund.") && envelope.Type != AccountRegisteredEventType && envelope.Type != usersservices.SellerApplicationReviewedEventType {
			return nil
		}
		return apply(ctx, envelope.Type, envelope.Data)
	}
}
