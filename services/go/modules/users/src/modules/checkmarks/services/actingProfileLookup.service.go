package services

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/generated/ent"
	usersservices "zudomart/modules/users/src/services"
	"zudomart/platform/identityports"
)

func LoadActingProfile(ctx context.Context, application *container.Container, rawAccountId string) (*ent.Profile, identityports.AccountSummary, error) {
	owner, err := uuid.Parse(rawAccountId)
	if err != nil {
		return nil, identityports.AccountSummary{}, usersErrors.ErrAccountUnavailable
	}
	personal, summary, err := usersservices.EnsurePersonalProfile(ctx, application, owner)
	if err != nil {
		return nil, summary, err
	}
	activeId, err := usersservices.ActiveProfileIdFor(ctx, application, owner, personal)
	if err != nil {
		return nil, summary, err
	}
	profileId, _ := uuid.Parse(activeId)
	acting, err := application.Client.Profile.Get(ctx, profileId)
	return acting, summary, err
}
