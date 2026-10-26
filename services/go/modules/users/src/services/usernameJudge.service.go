package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/profile"
	"nantty/modules/users/src/generated/ent/usernamehold"
	"nantty/platform/identityports"
	"nantty/platform/usernames"
)

type Availability struct {
	Available bool   `json:"available"`
	Reason    string `json:"reason,omitempty"`
}

func unavailable(reason usernames.UnavailableReason) Availability {
	return Availability{Reason: string(reason)}
}

func ListReservedRules(ctx context.Context, client *ent.Client) ([]usernames.ReservedRule, error) {
	custom, err := client.ReservedUsernameRule.Query().All(ctx)
	if err != nil {
		return nil, err
	}
	rules := usernames.SystemReservedRules()
	for _, row := range custom {
		rules = append(rules, usernames.ReservedRule{Term: row.Term, Kind: usernames.MatchKind(row.MatchKind)})
	}
	return rules, nil
}

func holdIsActive(hold *ent.UsernameHold, now time.Time) bool {
	return hold.ExpiresAt == nil || hold.ExpiresAt.After(now)
}

func JudgeUsername(ctx context.Context, application *container.Container, raw string, requester uuid.UUID, includeAccountDirectory bool) (string, Availability, error) {
	username := usernames.NormalizeRequestedUsername(raw)
	if !usernames.HasValidFormat(username) {
		return username, unavailable(usernames.ReasonInvalid), nil
	}
	rules, err := ListReservedRules(ctx, application.Client)
	if err != nil {
		return username, Availability{}, err
	}
	if _, reserved := usernames.FindMatchingReservedRule(username, rules); reserved {
		return username, unavailable(usernames.ReasonReserved), nil
	}
	hold, err := application.Client.UsernameHold.Query().Where(usernamehold.Username(username)).Only(ctx)
	if err != nil && !ent.IsNotFound(err) {
		return username, Availability{}, err
	}
	if hold != nil && holdIsActive(hold, application.Now()) {
		if hold.Kind == usernamehold.KindWithheld {
			return username, unavailable(usernames.ReasonWithheld), nil
		}
		if hold.HeldForAccountID == nil || *hold.HeldForAccountID != requester {
			return username, unavailable(usernames.ReasonRecentlyUsed), nil
		}
	}
	handleTaken, err := application.Client.Profile.Query().Where(profile.Handle(username), profile.AccountIDNEQ(requester)).Exist(ctx)
	if err != nil || handleTaken {
		return username, unavailable(usernames.ReasonTaken), err
	}
	if !includeAccountDirectory {
		return username, Availability{Available: true}, nil
	}
	directory, err := identityports.Default.AccountDirectory()
	if err != nil {
		return username, Availability{}, err
	}
	taken, err := directory.IsUsernameTaken(ctx, username, requester)
	if err != nil || taken {
		return username, unavailable(usernames.ReasonTaken), err
	}
	return username, Availability{Available: true}, nil
}

type UsernameGuardService struct {
	Container *container.Container
}

func (guard UsernameGuardService) DescribeUsernameBlock(ctx context.Context, username string, requester uuid.UUID) (identityports.UsernameBlock, error) {
	_, verdict, err := JudgeUsername(ctx, guard.Container, username, requester, false)
	return identityports.UsernameBlock{Blocked: !verdict.Available, Reason: verdict.Reason}, err
}

type AccountCountryService struct {
	Container *container.Container
}

func (lookup AccountCountryService) FindAccountCountryCode(ctx context.Context, accountId uuid.UUID) (string, error) {
	row, err := lookup.Container.Client.Profile.Query().Where(profile.AccountID(accountId), profile.KindEQ(profile.KindPersonal)).Only(ctx)
	if ent.IsNotFound(err) || (err == nil && row.CountryCode == nil) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return *row.CountryCode, nil
}
