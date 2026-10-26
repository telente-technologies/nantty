package getcreatorapplicationdetail

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/modules/creatorProgram/services"
	"nantty/platform/identityports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, rawId string) (services.ProgramApplication, error) {
	identifier, err := uuid.Parse(rawId)
	if err != nil {
		return services.ProgramApplication{}, usersErrors.NotFound("That application was not found.")
	}
	row, err := handler.Container.Client.CreatorApplication.Get(ctx, identifier)
	if ent.IsNotFound(err) {
		return services.ProgramApplication{}, usersErrors.NotFound("That application was not found.")
	}
	if err != nil {
		return services.ProgramApplication{}, err
	}
	view, err := services.BuildProgramApplication(ctx, handler.Container, row)
	if err != nil {
		return view, err
	}
	history := []json.RawMessage{}
	if reader, portErr := identityports.Default.AuditHistoryReader(); portErr == nil {
		history, err = reader.ListAuditHistoryForSubject(ctx, "creator_application", row.ID.String(), 50)
	}
	view.History = history
	return view, err
}
