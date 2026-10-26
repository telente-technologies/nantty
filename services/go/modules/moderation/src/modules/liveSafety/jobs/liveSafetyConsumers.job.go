package jobs

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/livesafetyincident"
	ingestlivesafetyscore "nantty/modules/moderation/src/modules/liveSafety/commands/ingestLiveSafetyScore"
	"nantty/modules/moderation/src/modules/liveSafety/services"
	platformevents "nantty/platform/events"
	"nantty/platform/httpserver"
)

func HandleLiveSafetyScoreMessage(application *container.Container) platformevents.MessageHandler {
	return func(ctx context.Context, body []byte) error {
		var command ingestlivesafetyscore.Command
		if err := json.Unmarshal(body, &command); err != nil {
			return fmt.Errorf("%w: live safety score is not JSON", platformevents.ErrPoisonMessage)
		}
		_, err := ingestlivesafetyscore.Handler{Container: application}.Execute(ctx, command)
		return poisonWhenInvalid(err)
	}
}

type liveEndedData struct {
	LiveId string `json:"liveId"`
}

func HandleLiveEndedMessage(application *container.Container) platformevents.MessageHandler {
	return func(ctx context.Context, body []byte) error {
		var envelope platformevents.EventEnvelope
		if err := json.Unmarshal(body, &envelope); err != nil {
			return fmt.Errorf("%w: event is not an envelope", platformevents.ErrPoisonMessage)
		}
		if envelope.Type != "live.ended" {
			return nil
		}
		var data liveEndedData
		if err := json.Unmarshal(envelope.Data, &data); err != nil || data.LiveId == "" {
			return fmt.Errorf("%w: live.ended data is malformed", platformevents.ErrPoisonMessage)
		}
		return MarkIncidentLiveEnded(ctx, application, data.LiveId)
	}
}

func MarkIncidentLiveEnded(ctx context.Context, application *container.Container, liveId string) error {
	incident, err := services.FindOpenIncident(ctx, application.Client, liveId)
	if err != nil || incident == nil {
		return err
	}
	now := application.Now()
	update := application.Client.LiveSafetyIncident.UpdateOne(incident).SetLiveEndedAt(now).SetUpdatedAt(now)
	if ShouldCloseIncidentWhenLiveEnds(incident) {
		update.SetStatus(livesafetyincident.StatusClosed).SetResolution("live_ended")
	}
	return update.Exec(ctx)
}

func ShouldCloseIncidentWhenLiveEnds(incident *ent.LiveSafetyIncident) bool {
	return !incident.HoldActive && !incident.HashMatch && incident.AppealedAt == nil && incident.Priority != livesafetyincident.PriorityUrgent && incident.Resolution != "keep_paused"
}

func poisonWhenInvalid(err error) error {
	var apiError *httpserver.ApiError
	if errors.As(err, &apiError) && apiError.Status >= 400 && apiError.Status < 500 && apiError.Status != 429 {
		return fmt.Errorf("%w: %s", platformevents.ErrPoisonMessage, apiError.Message)
	}
	return err
}
