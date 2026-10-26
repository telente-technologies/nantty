package jobs

import (
	"context"
	"encoding/json"
	"fmt"

	"nantty/modules/moderation/src/container"
	recordvoluntaryremoval "nantty/modules/moderation/src/modules/copyrightClaims/commands/recordVoluntaryRemoval"
	platformevents "nantty/platform/events"
)

func HandlePostDeletedMessage(c *container.Container) platformevents.MessageHandler {
	return func(ctx context.Context, body []byte) error {
		var envelope platformevents.EventEnvelope
		if err := json.Unmarshal(body, &envelope); err != nil {
			return fmt.Errorf("%w: event is not an envelope", platformevents.ErrPoisonMessage)
		}
		if envelope.Type != "post.deleted" {
			return nil
		}
		var data struct {
			PostId string `json:"postId"`
		}
		if err := json.Unmarshal(envelope.Data, &data); err != nil || data.PostId == "" {
			return fmt.Errorf("%w: post.deleted data is malformed", platformevents.ErrPoisonMessage)
		}
		removedAt := c.Now()
		if !envelope.OccurredAt.IsZero() {
			removedAt = envelope.OccurredAt
		}
		_, err := recordvoluntaryremoval.Handler{Container: c}.Execute(ctx, recordvoluntaryremoval.Command{TargetId: data.PostId, RemovedAt: removedAt})
		return err
	}
}
