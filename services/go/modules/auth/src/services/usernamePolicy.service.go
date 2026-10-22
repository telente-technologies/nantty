package services

import (
	"context"
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/auth/src/container"
	authErrors "zudomart/modules/auth/src/errors"
	"zudomart/modules/auth/src/generated/ent"
	"zudomart/modules/auth/src/generated/ent/account"
	"zudomart/platform/httpserver"
	"zudomart/platform/identityports"
	"zudomart/platform/usernames"
)

type UsernameAvailability struct {
	Available bool   `json:"available"`
	Reason    string `json:"reason,omitempty"`

	Suggestions []string `json:"suggestions,omitempty"`
}

func unavailableBecause(reason usernames.UnavailableReason) UsernameAvailability {
	return UsernameAvailability{Reason: string(reason)}
}

func JudgeUsername(ctx context.Context, client *ent.Client, raw string, requester uuid.UUID) (string, UsernameAvailability, error) {
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

func CheckUsernameAvailability(ctx context.Context, application *container.Container, raw, name string, authenticated bool) (UsernameAvailability, error) {
	username, verdict, err := JudgeUsername(ctx, application.Client, raw, uuid.Nil)
	if err != nil {
		return verdict, err
	}
	if !authenticated {
		verdict.Suggestions = nil
		if verdict.Reason != "" && verdict.Reason != string(usernames.ReasonInvalid) {
			verdict.Reason = "unavailable"
		}
		return verdict, nil
	}
	if verdict.Reason != string(usernames.ReasonTaken) && verdict.Reason != string(usernames.ReasonRecentlyUsed) {
		return verdict, nil
	}
	verdict.Suggestions, err = SuggestUsernames(ctx, application.Client, application.Now(), username, name)
	return verdict, err
}

func UsernameRejection(verdict UsernameAvailability) error {
	switch verdict.Reason {
	case string(usernames.ReasonTaken):
		return authErrors.ErrUsernameAlreadyInUse
	case string(usernames.ReasonInvalid):
		return authErrors.Unprocessable("Usernames are 3-30 lowercase letters, numbers, dots or underscores, include a letter, and cannot start or end with a dot or use two dots in a row.")
	}
	return httpserver.NewApiError(http.StatusUnprocessableEntity, "USERNAME_UNAVAILABLE", "This username is not available.")
}

func ChooseAvailableUsername(ctx context.Context, client *ent.Client, requested string, seeds ...string) (string, error) {
	if requested != "" {
		username, verdict, err := JudgeUsername(ctx, client, requested, uuid.Nil)
		if err != nil {
			return "", err
		}
		if !verdict.Available {
			return "", UsernameRejection(verdict)
		}
		return username, nil
	}
	for _, candidate := range usernames.GenerateCandidates(seeds, usernames.SystemReservedRules()) {
		username, verdict, err := JudgeUsername(ctx, client, candidate, uuid.Nil)
		if err != nil {
			return "", err
		}
		if verdict.Available {
			return username, nil
		}
	}
	return "", authErrors.Unprocessable("Could not generate a username. Choose one yourself.")
}
