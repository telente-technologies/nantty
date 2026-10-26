package getusernamehold

import (
	"context"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/usernamehold"
	listheldusernames "nantty/modules/users/src/modules/accountEnforcement/queries/listHeldUsernames"
	"nantty/platform/usernames"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, raw string) (listheldusernames.Hold, error) {
	username := usernames.NormalizeRequestedUsername(raw)
	row, err := handler.Container.Client.UsernameHold.Query().Where(usernamehold.Username(username), usernamehold.KindEQ(usernamehold.KindQuarantine)).Only(ctx)
	if ent.IsNotFound(err) {
		return listheldusernames.Hold{Username: username}, nil
	}
	if err != nil {
		return listheldusernames.Hold{}, err
	}
	return listheldusernames.HoldView(row, handler.Container.Now()), nil
}
