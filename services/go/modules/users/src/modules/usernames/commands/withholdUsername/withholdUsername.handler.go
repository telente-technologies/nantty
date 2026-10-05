package withholdusername

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/events"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/profile"
	"zudomart/modules/users/src/generated/ent/usernamehold"
	"zudomart/modules/users/src/services"
	"zudomart/platform/identityports"
	"zudomart/platform/usernames"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	username := usernames.NormalizeRequestedUsername(command.Username)
	reason := strings.TrimSpace(command.Reason)
	if !usernames.HasValidFormat(username) {
		return usersErrors.UnprocessableWithCode("USERNAME_INVALID", "Enter a valid username to withhold.")
	}
	if len(reason) < 5 || len(reason) > 120 || len(command.Note) > 500 {
		return usersErrors.Unprocessable("Give a reason of 5 to 120 characters and a note of at most 500.")
	}
	inUse, err := handler.usernameIsOwned(ctx, username)
	if err != nil {
		return err
	}
	if inUse {
		return usersErrors.ErrUsernameTaken
	}
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if _, err := tx.UsernameHold.Delete().Where(usernamehold.Username(username)).Exec(ctx); err != nil {
			return err
		}
		if err := tx.UsernameHold.Create().SetUsername(username).SetKind(usernamehold.KindWithheld).SetReason(reason).SetNote(command.Note).SetCreatedBy(command.Actor.Id).SetCreatedByName(command.Actor.Name).Exec(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "username.withheld", username, handler.Container.Now(), events.UsernameWithheldEventData{Username: username, Reason: reason})
	})
	if err != nil {
		return err
	}
	return services.RecordStaffAuditEvent(ctx, command.Actor, "users.username_withheld", "username", username, reason, nil, map[string]string{"username": username})
}

func (handler Handler) usernameIsOwned(ctx context.Context, username string) (bool, error) {
	if owned, err := handler.Container.Client.Profile.Query().Where(profile.Handle(username)).Exist(ctx); err != nil || owned {
		return owned, err
	}
	directory, err := identityports.Default.AccountDirectory()
	if err != nil {
		return false, err
	}
	return directory.IsUsernameTaken(ctx, username, uuid.Nil)
}
