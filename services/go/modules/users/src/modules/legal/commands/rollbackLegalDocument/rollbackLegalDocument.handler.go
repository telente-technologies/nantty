package rollbacklegaldocument

import (
	"context"
	"fmt"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	accountservices "zudomart/modules/users/src/modules/accountEnforcement/services"
	createlegalversion "zudomart/modules/users/src/modules/legal/commands/createLegalVersion"
	"zudomart/modules/users/src/modules/legal/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.VersionView, error) {
	reason, err := accountservices.RequireReason(command.Reason)
	if err != nil {
		return services.VersionView{}, err
	}
	tx, err := handler.Container.Client.Tx(ctx)
	if err != nil {
		return services.VersionView{}, err
	}
	source, err := services.LoadVersionInTransaction(ctx, tx, command.FromVersionId, false)
	_ = tx.Rollback()
	if err != nil {
		return services.VersionView{}, err
	}
	if source.DocumentKey != command.DocumentKey {
		return services.VersionView{}, usersErrors.ValidationFailedFor("fromVersionId", "belongs to a different document")
	}
	from := source.VersionNumber
	return createlegalversion.Handler{Container: handler.Container}.Execute(ctx, createlegalversion.Command{
		Actor: command.Actor, DocumentKey: command.DocumentKey, BodyMarkdown: source.BodyMarkdown, ChangeSummary: fmt.Sprintf("Rollback to version %d: %s", from, reason),
		IsMaterialChange: true, RolledBackFrom: &from,
	})
}
