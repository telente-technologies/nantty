package jobs

import (
	"context"
	"encoding/json"
	"fmt"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/events"
	"zudomart/modules/ads/src/generated/ent/adcontentsignal"
	billingservices "zudomart/modules/ads/src/modules/billing/services"
	boostservices "zudomart/modules/ads/src/modules/boosts/services"
	"zudomart/modules/ads/src/services"
	platformevents "zudomart/platform/events"
)

func HandleDomainEventMessage(deployed *container.Container) func(context.Context, []byte) error {
	holds := services.CreatorMonetisationHolds{Client: deployed.Client, Now: deployed.Now}
	members := services.CreatorProgramMembers{Client: deployed.Client, Now: deployed.Now}
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
		case services.CreatorApplicationDecided, services.CreatorStandingChanged:
			return members.HandleCreatorProgramMessage(ctx, envelope)
		case "post.deleted":
			return handlePostDeleted(ctx, deployed, envelope)
		case events.AdBoostCancelled:
			return boostservices.HandleBoostCancelledEvent(ctx, deployed, envelope)
		}
		return nil
	}
}

func handlePostDeleted(ctx context.Context, deployed *container.Container, envelope platformevents.EventEnvelope) error {
	var data struct {
		PostId string `json:"postId"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil || data.PostId == "" {
		return fmt.Errorf("%w: post.deleted data is malformed", platformevents.ErrPoisonMessage)
	}
	if err := deployed.Client.AdContentSignal.Update().Where(adcontentsignal.ContentID(data.PostId)).SetRemoved(true).SetUpdatedAt(deployed.Now()).Exec(ctx); err != nil {
		return err
	}
	_, err := boostservices.CancelBoostsForPost(ctx, deployed, data.PostId, boostservices.CancelReasonPostDeleted)
	return err
}
