package services

import (
	"context"
	"time"

	"nantty/modules/auth/src/generated/ent"
	"nantty/modules/auth/src/generated/ent/account"
	"nantty/platform/httpserver"
	"nantty/platform/identityports"
	"nantty/platform/usernames"
)

const suggestionCount = 3

func SuggestUsernames(ctx context.Context, client *ent.Client, now time.Time, seeds ...string) ([]string, error) {
	candidates := usernames.BuildSuggestionCandidates(seeds, usernames.SystemReservedRules(), now.Year())
	unavailable := map[string]struct{}{}
	if guard, err := identityports.Default.UsernameGuard(); err == nil {
		blocked, err := guard.FindBlockedUsernames(ctx, candidates)
		if err != nil {
			return nil, err
		}
		for _, username := range blocked {
			unavailable[username] = struct{}{}
		}
	}
	taken, err := client.Account.Query().Where(account.UsernameIn(candidates...)).Select(account.FieldUsername).Strings(ctx)
	if err != nil {
		return nil, err
	}
	for _, username := range taken {
		unavailable[username] = struct{}{}
	}
	suggestions := make([]string, 0, suggestionCount)
	for _, candidate := range candidates {
		if _, skip := unavailable[candidate]; !skip && len(suggestions) < suggestionCount {
			suggestions = append(suggestions, candidate)
		}
	}
	return suggestions, nil
}

func AttachUsernameSuggestions(ctx context.Context, client *ent.Client, now time.Time, failure error, seeds ...string) error {
	apiError := httpserver.ConvertErrorToApiError(failure)
	if failure == nil || apiError.Code != "USERNAME_TAKEN" {
		return failure
	}
	suggestions, err := SuggestUsernames(ctx, client, now, seeds...)
	if err != nil {
		return failure
	}
	return apiError.WithSuggestions(suggestions)
}
