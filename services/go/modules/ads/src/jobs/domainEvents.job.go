package jobs

import (
	"context"
	"encoding/json"
	"fmt"

	"zudomart/modules/ads/src/container"
	billingservices "zudomart/modules/ads/src/modules/billing/services"
	"zudomart/modules/ads/src/services"
	platformevents "zudomart/platform/events"
)

func HandleDomainEventMessage(deployed *container.Container) func(context.Context, []byte) error {
	holds := services.CreatorMonetisationHolds{Client: deployed.Client, Now: deployed.Now}
	return func(ctx context.Context, body []byte) error {
		var envelope platformevents.EventEnvelope
		if err := json.Unmarshal(body, &envelope); err != nil {
			return fmt.Errorf("%w: not an envelope", platformevents.ErrPoisonMessage)
		}
		switch envelope.Type {
		case "accountHealth.changed":
			return holds.HandleAccountHealthMessage(ctx, body)
		case billingservices.AdBalanceToppedUp:
			return billingservices.HandleToppedUpEvent(ctx, deployed, envelope)
		}
		return nil
	}
}
