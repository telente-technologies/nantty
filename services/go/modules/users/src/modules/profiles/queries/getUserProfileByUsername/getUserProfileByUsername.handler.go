package getuserprofilebyusername

import (
	"context"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/profile"
	getuserprofile "zudomart/modules/users/src/modules/profiles/queries/getUserProfile"
	"zudomart/modules/users/src/types"
	"zudomart/platform/identityports"
	"zudomart/platform/usernames"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (types.UserView, error) {
	username := usernames.NormalizeRequestedUsername(query.Username)
	row, err := handler.Container.Client.Profile.Query().Where(profile.Handle(username), profile.KindEQ(profile.KindPersonal)).Only(ctx)
	if ent.IsNotFound(err) {
		return handler.viewAccountNotYetMirrored(ctx, username)
	}
	if err != nil {
		return types.UserView{}, err
	}
	return getuserprofile.ViewPublicProfileOfAccount(ctx, handler.Container, row.AccountID)
}

func (handler Handler) viewAccountNotYetMirrored(ctx context.Context, username string) (types.UserView, error) {
	directory, err := identityports.Default.AccountDirectory()
	if err != nil {
		return types.UserView{}, err
	}
	summary, found, err := directory.FindAccountSummaryByUsername(ctx, username)
	if err != nil {
		return types.UserView{}, err
	}
	if !found {
		return types.UserView{}, usersErrors.ErrProfileNotFound
	}
	return getuserprofile.ViewPublicProfileOfAccount(ctx, handler.Container, summary.ID)
}
