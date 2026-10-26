package applyforcreator

import (
	"context"

	"github.com/google/uuid"
	"nantty/modules/users/src/container"
	submitcreatorapplication "nantty/modules/users/src/modules/creatorProgram/commands/submitCreatorApplication"
	"nantty/modules/users/src/services"
	"nantty/modules/users/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.UserView, error) {
	if _, err := (submitcreatorapplication.Handler{Container: handler.Container}).Execute(ctx, submitcreatorapplication.Command{AccountId: command.AccountId, Lenient: true}); err != nil {
		return types.UserView{}, err
	}
	owner, _ := uuid.Parse(command.AccountId)
	personal, summary, err := services.EnsurePersonalProfile(ctx, handler.Container, owner)
	if err != nil {
		return types.UserView{}, err
	}
	return types.BuildUserView(personal, summary, true), nil
}
