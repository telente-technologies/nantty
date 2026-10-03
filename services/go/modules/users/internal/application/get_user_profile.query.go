package application

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/users/internal/ent"
	"zudomart/modules/users/internal/ent/profile"
)

func (application *UsersApplication) GetMyProfile(ctx context.Context, accountId string) (UserView, error) {
	owner, err := uuid.Parse(accountId)
	if err != nil {
		return UserView{}, errAccountUnavailable
	}
	row, summary, err := application.ensurePersonalProfile(ctx, owner)
	if err != nil {
		return UserView{}, err
	}
	isCreator, err := application.hasActiveCreatorProfile(ctx, owner)
	if err != nil {
		return UserView{}, err
	}
	return application.buildUserView(row, summary, isCreator, true), nil
}

func (application *UsersApplication) GetUserProfileByAccountId(ctx context.Context, accountId string) (UserView, error) {
	target, err := uuid.Parse(accountId)
	if err != nil {
		return UserView{}, errProfileNotFound
	}
	return application.viewOtherUsersProfile(ctx, target)
}

func (application *UsersApplication) GetUserProfileByUsername(ctx context.Context, username string) (UserView, error) {
	row, err := application.Client.Profile.Query().Where(profile.HandleEQ(normalizeHandleForLookup(username)), profile.KindEQ(profile.KindPersonal)).Only(ctx)
	if ent.IsNotFound(err) {
		return UserView{}, errProfileNotFound
	}
	if err != nil {
		return UserView{}, err
	}
	return application.viewOtherUsersProfile(ctx, row.AccountID)
}

func (application *UsersApplication) viewOtherUsersProfile(ctx context.Context, accountId uuid.UUID) (UserView, error) {
	row, summary, err := application.ensurePersonalProfile(ctx, accountId)
	if err != nil {
		if err == errAccountUnavailable {
			return UserView{}, errProfileNotFound
		}
		return UserView{}, err
	}
	isCreator, err := application.hasActiveCreatorProfile(ctx, accountId)
	if err != nil {
		return UserView{}, err
	}
	return application.buildUserView(row, summary, isCreator, false), nil
}
