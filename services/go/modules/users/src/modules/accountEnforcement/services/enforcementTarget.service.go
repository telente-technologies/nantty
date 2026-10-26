package services

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/profile"
	usersservices "nantty/modules/users/src/services"
	"nantty/platform/identityports"
)

type Target struct {
	Account identityports.AccountSummary
	Profile *ent.Profile
}

func ParseAccountIdentifier(raw string) (uuid.UUID, error) {
	parsed, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, usersErrors.NotFound("That user was not found.")
	}
	return parsed, nil
}

func LoadTarget(ctx context.Context, application *container.Container, raw string) (Target, error) {
	accountId, err := ParseAccountIdentifier(raw)
	if err != nil {
		return Target{}, err
	}
	directory, err := identityports.Default.AccountDirectory()
	if err != nil {
		return Target{}, err
	}
	summary, found, err := directory.FindAccountSummary(ctx, accountId)
	if err != nil {
		return Target{}, err
	}
	if !found {
		return Target{}, usersErrors.NotFound("That user was not found.")
	}
	row, err := application.Client.Profile.Query().Where(profile.AccountID(accountId), profile.KindEQ(profile.KindPersonal)).Only(ctx)
	if ent.IsNotFound(err) && summary.Status != "deleted" {
		row, err = usersservices.CreatePersonalProfileFromAccount(ctx, application, summary)
	}
	if ent.IsNotFound(err) {
		return Target{Account: summary}, nil
	}
	return Target{Account: summary, Profile: row}, err
}

func RequireReason(raw string) (string, error) {
	reason := strings.TrimSpace(raw)
	if len(reason) < 5 || len(reason) > 1000 {
		return "", usersErrors.ValidationFailedFor("reason", "must be 5 to 1000 characters")
	}
	return reason, nil
}

func (target Target) Label() string {
	return target.Account.Username
}
