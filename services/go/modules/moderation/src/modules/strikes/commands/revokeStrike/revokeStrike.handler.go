package revokestrike

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/modules/strikes/services"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, strikeId, reason string) error {
	identifier, err := uuid.Parse(strikeId)
	if err != nil {
		return httpserver.ErrNotFound
	}
	reason = strings.TrimSpace(reason)
	if len(reason) < 5 || len(reason) > 500 {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "reason", Message: "must be 5 to 500 characters"}})
	}
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		_, revokeErr := services.Recorder{Now: handler.Container.Now}.Revoke(ctx, tx, identifier, reason)
		return revokeErr
	})
}
