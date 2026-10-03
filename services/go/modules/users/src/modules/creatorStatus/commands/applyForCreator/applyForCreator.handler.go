package applyforcreator

import (
	"context"

	"github.com/google/uuid"
	"zudomart/modules/users/src/container"
	submitcreatorapplication "zudomart/modules/users/src/modules/creatorProgram/commands/submitCreatorApplication"
	"zudomart/modules/users/src/services"
	"zudomart/modules/users/src/types"
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
