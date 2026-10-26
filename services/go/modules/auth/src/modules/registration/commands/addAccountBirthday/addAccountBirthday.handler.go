package addaccountbirthday

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/auth/src/container"
	authErrors "nantty/modules/auth/src/errors"
	"nantty/modules/auth/src/generated/ent"
	"nantty/modules/auth/src/generated/ent/account"
	"nantty/modules/auth/src/services"
	"nantty/modules/auth/src/utils"
)

type Handler struct {
	*container.Container
}

func (application Handler) Execute(ctx context.Context, command Command) (Result, error) {
	accountId, err := uuid.Parse(command.AccountId)
	if err != nil {
		return Result{}, authErrors.ErrInvalidCredentials
	}
	now := application.Now()
	birthday, err := utils.ParseBirthday(command.Birthday, now)
	if err != nil {
		return Result{}, err
	}
	existing, err := application.Client.Account.Query().Where(account.ID(accountId), account.StatusEQ(account.StatusActive)).Only(ctx)
	if ent.IsNotFound(err) {
		return Result{}, authErrors.ErrInvalidCredentials
	}
	if err != nil {
		return Result{}, err
	}
	if existing.Birthday != nil {
		return Result{}, authErrors.ErrBirthdayAlreadySet
	}
	if utils.IsBelowMinimumAccountAge(birthday, now) {
		return Result{}, application.suspendAccountBelowMinimumAge(ctx, existing, command, now)
	}
	updated, err := application.Client.Account.Update().Where(account.ID(accountId), account.BirthdayIsNil()).SetBirthday(birthday).Save(ctx)
	if err != nil {
		return Result{}, err
	}
	if updated == 0 {
		return Result{}, authErrors.ErrBirthdayAlreadySet
	}
	services.RecordAccountSecurityEvent(ctx, application.Container, existing.ID, existing.Username, "account.birthdayAdded", map[string]any{})
	return Result{Birthday: birthday.Format(time.DateOnly), AgeBracket: utils.AgeBracketFromBirthday(&birthday, now)}, nil
}

func (application Handler) suspendAccountBelowMinimumAge(ctx context.Context, existing *ent.Account, command Command, now time.Time) error {
	email := ""
	if existing.Email != nil {
		email = *existing.Email
	}
	if err := services.RecordAgeGateRefusal(ctx, application.Client, application.Settings.OneTimeCodePepper, email, command.Client.DeviceId, now); err != nil {
		return err
	}
	if err := (services.AccountEnforcementService{Container: application.Container}).SuspendAccountAndRevokeSessions(ctx, existing.ID); err != nil {
		return err
	}
	services.RecordAccountSecurityEvent(ctx, application.Container, existing.ID, existing.Username, "account.suspendedBelowMinimumAge", map[string]any{"reviewRequired": true})
	return authErrors.ErrBelowMinimumAge
}
