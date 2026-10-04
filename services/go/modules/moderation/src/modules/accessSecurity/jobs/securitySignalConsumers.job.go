package jobs

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"zudomart/modules/moderation/src/container"
	recordaccessviolation "zudomart/modules/moderation/src/modules/accessSecurity/commands/recordAccessViolation"
	recordbotscore "zudomart/modules/moderation/src/modules/accessSecurity/commands/recordBotScore"
	"zudomart/modules/moderation/src/modules/accessSecurity/services"
	platformevents "zudomart/platform/events"
	"zudomart/platform/httpserver"
)

const AccessViolationEventType = "security.accessViolationDetected"

func HandleAccessViolationEnvelope(application *container.Container) platformevents.MessageHandler {
	return func(ctx context.Context, body []byte) error {
		var envelope platformevents.EventEnvelope
		if err := json.Unmarshal(body, &envelope); err != nil {
			return fmt.Errorf("%w: security event is not an envelope", platformevents.ErrPoisonMessage)
		}
		if envelope.Type != AccessViolationEventType {
			return nil
		}
		var command recordaccessviolation.Command
		if err := json.Unmarshal(envelope.Data, &command); err != nil {
			return fmt.Errorf("%w: %s data is malformed", platformevents.ErrPoisonMessage, AccessViolationEventType)
		}
		if command.ViolationId == "" {
			command.ViolationId = envelope.Id
		}
		_, err := recordaccessviolation.Handler{Container: application}.Execute(ctx, command)
		return poisonWhenInvalid(err)
	}
}

func HandleBotScoreMessage(application *container.Container) platformevents.MessageHandler {
	return func(ctx context.Context, body []byte) error {
		var command recordbotscore.Command
		if err := json.Unmarshal(body, &command); err != nil {
			return fmt.Errorf("%w: bot score is not JSON", platformevents.ErrPoisonMessage)
		}
		if !command.AdvisoryOnly {
			return nil
		}
		_, err := recordbotscore.Handler{Container: application}.Execute(ctx, command)
		return poisonWhenInvalid(err)
	}
}

func RunBotScoreConsumerUntilContextDone(ctx context.Context, application *container.Container, queues platformevents.QueueConsumer) {
	queueName := services.Thresholds(application).BotScoresQueue
	for ctx.Err() == nil {
		if err := queues.ConsumeQueueUntilContextDone(ctx, queueName, HandleBotScoreMessage(application), application.Logger); err != nil && ctx.Err() == nil {
			application.Logger.ErrorContext(ctx, "bot score consumer stopped; retrying in 30s", slog.Any("error", err))
		}
		select {
		case <-ctx.Done():
		case <-time.After(30 * time.Second):
		}
	}
}

func poisonWhenInvalid(err error) error {
	var apiError *httpserver.ApiError
	if errors.As(err, &apiError) && apiError.Status >= 400 && apiError.Status < 500 && apiError.Status != 429 {
		return fmt.Errorf("%w: %s", platformevents.ErrPoisonMessage, apiError.Message)
	}
	return err
}
