package changeusername

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/events"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/usernamehold"
	usernameservices "zudomart/modules/users/src/modules/usernames/services"
	"zudomart/modules/users/src/services"
	"zudomart/modules/users/src/types"
	"zudomart/modules/users/src/useraudit"
	"zudomart/platform/httpserver"
	"zudomart/platform/identityports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.UserView, error) {
	owner, err := uuid.Parse(command.AccountId)
	if err != nil {
		return types.UserView{}, usersErrors.ErrAccountUnavailable
	}
	row, summary, err := services.EnsurePersonalProfile(ctx, handler.Container, owner)
	if err != nil {
		return types.UserView{}, err
	}
	window, err := usernameservices.CalculateChangeWindow(ctx, handler.Container, owner)
	if err != nil {
		return types.UserView{}, err
	}
	if window.NextChangeAvailableAt != nil {
		return types.UserView{}, usersErrors.TooManyRequestsWithCode("USERNAME_CHANGE_TOO_SOON", fmt.Sprintf("You changed your username recently. Try again after %s.", window.NextChangeAvailableAt.UTC().Format(time.RFC3339)))
	}
	username, verdict, err := services.JudgeUsername(ctx, handler.Container, command.Username, owner, true)
	if err != nil {
		return types.UserView{}, err
	}
	if username == row.Handle {
		return types.UserView{}, usersErrors.Unprocessable("That is already your username.")
	}
	if !verdict.Available {
		return types.UserView{}, rejectionFor(verdict)
	}
	directory, err := identityports.Default.AccountDirectory()
	if err != nil {
		return types.UserView{}, err
	}
	if err := directory.RenameAccountUsername(ctx, owner, username); err != nil {
		if errors.Is(err, identityports.ErrUsernameAlreadyTaken) {
			return types.UserView{}, usersErrors.ErrUsernameTaken
		}
		return types.UserView{}, err
	}
	updated, err := handler.recordChange(ctx, row.ID, owner, row.Handle, username, window.Rules.Quarantine)
	if err != nil {
		if revertErr := directory.RenameAccountUsername(ctx, owner, row.Handle); revertErr != nil {
			handler.Container.Logger.ErrorContext(ctx, "username rename could not be reverted", "accountId", owner.String(), "error", revertErr.Error())
		}
		return types.UserView{}, err
	}
	summary.Username = username
	if auditErr := useraudit.RecordUserAuditEntry(ctx, useraudit.UserAuditEntry{
		AccountId: owner.String(), AccountName: username, Action: "user.username_changed", SubjectType: "user", SubjectId: owner.String(), SubjectLabel: username,
		Reason: "user_change", Before: map[string]string{"username": row.Handle}, After: map[string]string{"username": username},
	}); auditErr != nil {
		handler.Container.Logger.WarnContext(ctx, "username change audit failed", "accountId", owner.String(), "error", auditErr.Error())
	}
	return types.BuildUserView(updated, summary, true), err
}

func (handler Handler) recordChange(ctx context.Context, profileId, owner uuid.UUID, previous, username string, quarantine time.Duration) (*ent.Profile, error) {
	var updated *ent.Profile
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		var err error
		now := handler.Container.Now()
		if updated, err = tx.Profile.UpdateOneID(profileId).SetHandle(username).Save(ctx); err != nil {
			return err
		}
		if err := tx.UsernameChange.Create().SetAccountID(owner).SetPreviousUsername(previous).SetNewUsername(username).SetReason("user_change").Exec(ctx); err != nil {
			return err
		}
		if _, err := tx.UsernameHold.Delete().Where(usernamehold.UsernameIn(previous, username), usernamehold.KindEQ(usernamehold.KindQuarantine)).Exec(ctx); err != nil {
			return err
		}
		if err := tx.UsernameHold.Create().SetUsername(previous).SetKind(usernamehold.KindQuarantine).SetHeldForAccountID(owner).SetReason("released").
			SetExpiresAt(now.Add(quarantine)).Exec(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "username.changed", owner.String(), now, events.UsernameChangedEventData{
			AccountId: owner.String(), ProfileId: profileId.String(), PreviousUsername: previous, Username: username,
		})
	})
	return updated, err
}

func rejectionFor(verdict services.Availability) error {
	switch verdict.Reason {
	case "taken":
		return usersErrors.ErrUsernameTaken
	case "invalid":
		return usersErrors.UnprocessableWithCode("USERNAME_INVALID", "Usernames are 3-30 lowercase letters, numbers, dots or underscores, include a letter, and cannot start or end with a dot or use two dots in a row.")
	}
	return httpserver.NewApiError(http.StatusUnprocessableEntity, "USERNAME_UNAVAILABLE", "This username is not available ("+verdict.Reason+").")
}
