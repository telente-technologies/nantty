package appealstrike

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/events"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/strike"
	"zudomart/modules/moderation/src/modules/accountHealth/services"
	appealservices "zudomart/modules/moderation/src/modules/appeals/services"
	"zudomart/platform/httpserver"
)

const StrikeAppealedType = "strike.appealed"

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	account, err := uuid.Parse(command.AccountId)
	if err != nil {
		return httpserver.ErrUnauthorized
	}
	identifier, err := uuid.Parse(command.StrikeId)
	if err != nil {
		return httpserver.ErrNotFound
	}
	message := strings.TrimSpace(command.Message)
	if len(message) < 20 || len(message) > 2000 {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "message", Message: "explain your appeal in 20 to 2000 characters"}})
	}
	row, err := handler.Container.Client.Strike.Query().Where(strike.ID(identifier), strike.AccountID(account)).Only(ctx)
	if ent.IsNotFound(err) {
		return httpserver.ErrNotFound
	}
	if err != nil {
		return err
	}
	now := handler.Container.Now()
	if !services.CanAppeal(row, now) {
		return httpserver.NewApiError(http.StatusConflict, "STRIKE_NOT_APPEALABLE", "This strike has already been appealed, has expired or was removed.")
	}
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := tx.Strike.UpdateOne(row).SetAppealStatus(strike.AppealStatusPending).SetAppealMessage(message).SetAppealedAt(now).Exec(ctx); err != nil {
			return err
		}
		if _, err := appealservices.OpenForStrike(ctx, tx, row, message, now); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, StrikeAppealedType, row.ID.String(), now, map[string]string{"strikeId": row.ID.String(), "accountId": account.String(), "kind": string(row.Kind), "source": string(row.Source)})
	})
}
