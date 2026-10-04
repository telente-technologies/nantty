package getusersearchsource

import (
	"context"
	"strings"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	enforcementservices "zudomart/modules/users/src/modules/accountEnforcement/services"
	"zudomart/modules/users/src/modules/searchSources/dtos"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.UserSearchSource, error) {
	target, err := enforcementservices.LoadTarget(ctx, handler.Container, query.AccountId)
	if err != nil {
		return dtos.UserSearchSource{}, err
	}
	if target.Account.Status == "deleted" || target.Profile == nil {
		return dtos.UserSearchSource{}, usersErrors.NotFound("That user was not found.")
	}
	summary, err := enforcementservices.BuildPlatformUserSummary(ctx, handler.Container, target)
	if err != nil {
		return dtos.UserSearchSource{}, err
	}
	profile := target.Profile
	source := dtos.UserSearchSource{
		AccountId: target.Account.ID.String(), Username: profile.Handle, DisplayName: summary.DisplayName, Bio: profile.Bio, AvatarUrl: profile.AvatarURL,
		Verified: profile.Verified, IsCreator: summary.IsCreator, IsPrivate: profile.IsPrivate, Status: strings.ToLower(target.Account.Status),
		FollowerCount: summary.FollowerCount, CreatedAt: summary.JoinedAt,
	}
	if summary.Verification != nil {
		source.Verified = source.Verified || summary.Verification.BadgeVisible
		source.Verification = map[string]any{"color": strings.ToLower(summary.Verification.Color), "tier": strings.ToLower(summary.Verification.Tier), "badgeVisible": summary.Verification.BadgeVisible}
	}
	return source, nil
}
