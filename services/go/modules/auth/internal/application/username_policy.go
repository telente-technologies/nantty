package application

import (
	"context"
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/auth/internal/ent"
	"zudomart/modules/auth/internal/ent/account"
	"zudomart/platform/httpserver"
	"zudomart/platform/identityports"
	"zudomart/platform/usernames"
)

type UsernameAvailability struct {
	Available bool   `json:"available"`
	Reason    string `json:"reason,omitempty"`
}

func unavailableBecause(reason usernames.UnavailableReason) UsernameAvailability {
	return UsernameAvailability{Reason: string(reason)}
}

func (application *AuthApplication) judgeUsername(ctx context.Context, client *ent.Client, raw string, requester uuid.UUID) (string, UsernameAvailability, error) {
	username := usernames.NormalizeRequestedUsername(raw)
	if !usernames.HasValidFormat(username) {
		return username, unavailableBecause(usernames.ReasonInvalid), nil
	}
	if _, reserved := usernames.FindMatchingReservedRule(username, usernames.SystemReservedRules()); reserved {
		return username, unavailableBecause(usernames.ReasonReserved), nil
	}
	if guard, err := identityports.Default.UsernameGuard(); err == nil {
		block, err := guard.DescribeUsernameBlock(ctx, username, requester)
		if err != nil {
			return username, UsernameAvailability{}, err
		}
		if block.Blocked {
			return username, UsernameAvailability{Reason: block.Reason}, nil
		}
	}
	taken, err := client.Account.Query().Where(account.Username(username), account.IDNEQ(requester)).Exist(ctx)
	if err != nil || taken {
		return username, unavailableBecause(usernames.ReasonTaken), err
	}
	return username, UsernameAvailability{Available: true}, nil
}

func (application *AuthApplication) CheckUsernameAvailability(ctx context.Context, raw string) (UsernameAvailability, error) {
	_, verdict, err := application.judgeUsername(ctx, application.Client, raw, uuid.Nil)
	return verdict, err
}

func usernameRejection(verdict UsernameAvailability) error {
	switch verdict.Reason {
	case string(usernames.ReasonTaken):
		return errUsernameAlreadyInUse
	case string(usernames.ReasonInvalid):
		return unprocessable("Usernames are 3-30 lowercase letters, numbers, dots or underscores, include a letter, and cannot start or end with a dot or use two dots in a row.")
	}
	return httpserver.NewApiError(http.StatusUnprocessableEntity, "USERNAME_UNAVAILABLE", "This username is not available.")
}

func (application *AuthApplication) chooseAvailableUsername(ctx context.Context, client *ent.Client, requested string, seeds ...string) (string, error) {
	if requested != "" {
		username, verdict, err := application.judgeUsername(ctx, client, requested, uuid.Nil)
		if err != nil {
			return "", err
		}
		if !verdict.Available {
			return "", usernameRejection(verdict)
		}
		return username, nil
	}
	for _, candidate := range usernames.GenerateCandidates(seeds, usernames.SystemReservedRules()) {
		username, verdict, err := application.judgeUsername(ctx, client, candidate, uuid.Nil)
		if err != nil {
			return "", err
		}
		if verdict.Available {
			return username, nil
		}
	}
	return "", unprocessable("Could not generate a username. Choose one yourself.")
}
