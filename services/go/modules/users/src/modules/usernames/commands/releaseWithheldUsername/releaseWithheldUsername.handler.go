package releasewithheldusername

import (
	"context"
	"strings"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent/usernamehold"
	"nantty/modules/users/src/services"
	"nantty/platform/httpserver"
	"nantty/platform/usernames"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	username := usernames.NormalizeRequestedUsername(command.Username)
	reason := strings.TrimSpace(command.Reason)
	if len(reason) < 5 || len(reason) > 120 {
		return usersErrors.Unprocessable("Give a reason of 5 to 120 characters.")
	}
	removed, err := handler.Container.Client.UsernameHold.Delete().Where(usernamehold.Username(username), usernamehold.KindEQ(usernamehold.KindWithheld)).Exec(ctx)
	if err != nil {
		return err
	}
	if removed == 0 {
		return httpserver.ErrNotFound
	}
	return services.RecordStaffAuditEvent(ctx, command.Actor, "users.username_released", "username", username, reason, map[string]string{"username": username}, nil)
}
