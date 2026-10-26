package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"nantty/modules/live/src/container"
	"nantty/modules/live/src/services"
	"nantty/modules/live/src/types"
	platformevents "nantty/platform/events"
)

type liveSafetyEventData struct {
	LiveId     string `json:"liveId"`
	IncidentId string `json:"incidentId"`
	Category   string `json:"category"`
	Reason     string `json:"reason"`
	Source     string `json:"source"`
	Message    string `json:"message"`
	BoostUntil string `json:"boostUntil"`
}

var liveSafetyEventTypes = map[string]bool{"live.safetyHold": true, "live.safetyReleased": true, "live.safetyWarning": true, "live.samplingBoosted": true, "live.moderatorEnded": true}

func IsLiveSafetyEvent(eventType string) bool { return liveSafetyEventTypes[eventType] }

func ApplyLiveSafetyMessage(deployed *container.Container) platformevents.MessageHandler {
	return func(ctx context.Context, body []byte) error {
		var envelope platformevents.EventEnvelope
		if err := json.Unmarshal(body, &envelope); err != nil {
			return fmt.Errorf("%w: live event is not an envelope", platformevents.ErrPoisonMessage)
		}
		if !IsLiveSafetyEvent(envelope.Type) {
			return nil
		}
		var data liveSafetyEventData
		if err := json.Unmarshal(envelope.Data, &data); err != nil || data.LiveId == "" {
			return fmt.Errorf("%w: %s data is malformed", platformevents.ErrPoisonMessage, envelope.Type)
		}
		service := services.NewLiveService(deployed)
		switch envelope.Type {
		case "live.safetyHold":
			return service.ApplyLiveSafetyHold(ctx, types.LiveSafetyHoldCommand{LiveId: data.LiveId, IncidentId: data.IncidentId, Category: data.Category, Reason: data.Reason, Source: data.Source})
		case "live.safetyReleased":
			return service.ReleaseLiveSafetyHold(ctx, data.LiveId, data.IncidentId)
		case "live.safetyWarning":
			return service.WarnLiveHost(ctx, data.LiveId, data.IncidentId, data.Category, data.Message)
		case "live.samplingBoosted":
			until, err := time.Parse(time.RFC3339, data.BoostUntil)
			if err != nil {
				return fmt.Errorf("%w: boostUntil is not a timestamp", platformevents.ErrPoisonMessage)
			}
			return service.BoostLiveSafetySampling(ctx, data.LiveId, until)
		}
		return service.EndLiveByModerator(ctx, data.LiveId, data.IncidentId, data.Reason)
	}
}

func HandleLiveDomainEvent(deployed *container.Container) platformevents.MessageHandler {
	visibility, safety := ApplyContentVisibilityChangedMessage(deployed), ApplyLiveSafetyMessage(deployed)
	return func(ctx context.Context, body []byte) error {
		var envelope platformevents.EventEnvelope
		if err := json.Unmarshal(body, &envelope); err != nil {
			return fmt.Errorf("%w: live event is not an envelope", platformevents.ErrPoisonMessage)
		}
		if IsLiveSafetyEvent(envelope.Type) {
			return safety(ctx, body)
		}
		if envelope.Type == "accountHealth.changed" {
			return services.NewLiveService(deployed).HandleAccountHealthChangedMessage(ctx, body)
		}
		return visibility(ctx, body)
	}
}

func RunLiveSafetySamplerUntilContextDone(ctx context.Context, deployed *container.Container) {
	services.NewLiveService(deployed).RunLiveSafetySamplerUntilContextDone(ctx)
}
