package services

import (
	"context"

	"zudomart/modules/users/src/generated/ent/profile"
	"zudomart/modules/users/src/generated/ent/usernamehold"
	"zudomart/platform/usernames"
)

func (guard UsernameGuardService) FindBlockedUsernames(ctx context.Context, candidates []string) ([]string, error) {
	if len(candidates) == 0 {
		return nil, nil
	}
	client := guard.Container.Client
	blocked := map[string]struct{}{}
	rules, err := ListReservedRules(ctx, client)
	if err != nil {
		return nil, err
	}
	for _, candidate := range candidates {
		if _, reserved := usernames.FindMatchingReservedRule(candidate, rules); reserved {
			blocked[candidate] = struct{}{}
		}
	}
	holds, err := client.UsernameHold.Query().Where(usernamehold.UsernameIn(candidates...)).All(ctx)
	if err != nil {
		return nil, err
	}
	for _, hold := range holds {
		if holdIsActive(hold, guard.Container.Now()) {
			blocked[hold.Username] = struct{}{}
		}
	}
	handles, err := client.Profile.Query().Where(profile.HandleIn(candidates...)).Select(profile.FieldHandle).Strings(ctx)
	if err != nil {
		return nil, err
	}
	for _, handle := range handles {
		blocked[handle] = struct{}{}
	}
	result := make([]string, 0, len(blocked))
	for username := range blocked {
		result = append(result, username)
	}
	return result, nil
}
