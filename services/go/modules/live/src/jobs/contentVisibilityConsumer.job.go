package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/live/src/container"
	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/generated/ent/livesession"
	"zudomart/modules/live/src/services"
	"zudomart/modules/live/src/types"
	platformevents "zudomart/platform/events"
)

var knownModerationVisibilities = map[string]bool{"visible": true, "restricted": true, "hidden": true, "removed": true}

type contentVisibilityChangedData struct {
	TargetType string `json:"targetType"`
	TargetId   string `json:"targetId"`
	Visibility string `json:"visibility"`
}

func ApplyContentVisibilityChangedMessage(deployed *container.Container) platformevents.MessageHandler {
	return func(ctx context.Context, body []byte) error {
		var envelope platformevents.EventEnvelope
		if err := json.Unmarshal(body, &envelope); err != nil {
			return fmt.Errorf("%w: live event is not an envelope", platformevents.ErrPoisonMessage)
		}
		if envelope.Type != "content.visibilityChanged" {
			return nil
		}
		var data contentVisibilityChangedData
		if err := json.Unmarshal(envelope.Data, &data); err != nil || !knownModerationVisibilities[data.Visibility] {
			return fmt.Errorf("%w: content.visibilityChanged data is malformed", platformevents.ErrPoisonMessage)
		}
		liveId, err := uuid.Parse(data.TargetId)
		if err != nil || data.TargetType != "live" {
			return nil
		}
		occurredAt := envelope.OccurredAt
		if occurredAt.IsZero() {
			occurredAt = time.Now()
		}
		session, err := deployed.Client.LiveSession.UpdateOneID(liveId).Where(livesession.Or(livesession.ModerationVisibilityAtIsNil(), livesession.ModerationVisibilityAtLT(occurredAt))).
			SetModerationVisibility(data.Visibility).SetModerationVisibilityAt(occurredAt).Save(ctx)
		if ent.IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}
		if (data.Visibility == "hidden" || data.Visibility == "removed") && session.State != livesession.StateEnded {
			return services.NewLiveService(deployed).EndLiveSession(ctx, types.Actor{UserId: session.HostID}, session.ID)
		}
		return nil
	}
}

func ConsumeLiveEventsUntilContextDone(ctx context.Context, deployed *container.Container, bus platformevents.MessageBusSelection) {
	if deployed.Settings.EventsQueueName == "" {
		return
	}
	_, queues, err := platformevents.CreateJobQueueAndConsumerFromEnvironment(ctx, bus)
	if err != nil || queues == nil {
		deployed.Logger.Error("live event consumer disabled: no message broker configured", slog.Any("error", err))
		return
	}
	if err := queues.ConsumeQueueUntilContextDone(ctx, deployed.Settings.EventsQueueName, HandleLiveDomainEvent(deployed), deployed.Logger); err != nil {
		deployed.Logger.Error("live event consumer stopped", slog.Any("error", err))
	}
}
