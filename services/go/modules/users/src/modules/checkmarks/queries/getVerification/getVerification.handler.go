package getverification

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/modules/checkmarks/services"
	"zudomart/platform/identityports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, rawId string) (services.VerificationView, error) {
	identifier, err := uuid.Parse(rawId)
	if err != nil {
		return services.VerificationView{}, usersErrors.NotFound("That verification request was not found.")
	}
	row, err := handler.Container.Client.VerificationApplication.Get(ctx, identifier)
	if ent.IsNotFound(err) {
		return services.VerificationView{}, usersErrors.NotFound("That verification request was not found.")
	}
	if err != nil {
		return services.VerificationView{}, err
	}
	view, err := services.BuildVerificationView(ctx, handler.Container, row)
	if err != nil {
		return view, err
	}
	history := []json.RawMessage{}
	if reader, portErr := identityports.Default.AuditHistoryReader(); portErr == nil {
		history, err = reader.ListAuditHistoryForSubject(ctx, "verification", row.ID.String(), 50)
	}
	view.History = history
	return view, err
}
