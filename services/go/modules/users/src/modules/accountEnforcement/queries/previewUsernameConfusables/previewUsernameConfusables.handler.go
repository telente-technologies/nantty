package previewusernameconfusables

import (
	"context"
	"strings"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent/usernamehold"
	"nantty/platform/identityports"
	"nantty/platform/usernames"
)

var kindLabels = map[string]string{"exact": "EXACT", "prefix": "PREFIX", "contains": "PATTERN", "brand": "PATTERN"}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, candidate string) (Result, error) {
	normalized := usernames.NormalizeRequestedUsername(candidate)
	if normalized == "" || len(normalized) > 60 {
		return Result{}, usersErrors.ValidationFailedFor("candidate", "must be 1 to 60 characters")
	}
	result := Result{Candidate: candidate, Normalized: normalized, Skeleton: usernames.BuildConfusableSkeleton(normalized), Collisions: []Collision{}}
	if err := handler.collectRuleCollisions(ctx, &result); err != nil {
		return result, err
	}
	withheld, err := handler.Container.Client.UsernameHold.Query().Where(usernamehold.Username(normalized), usernamehold.KindEQ(usernamehold.KindWithheld)).Exist(ctx)
	if err != nil {
		return result, err
	}
	result.IsWithheld = withheld
	directory, err := identityports.Default.AccountDirectory()
	if err != nil {
		return result, err
	}
	owner, found, err := directory.FindAccountSummaryByUsername(ctx, normalized)
	if err == nil && found {
		id := owner.ID.String()
		result.TakenByUserId, result.TakenByUsername = &id, &owner.Username
	}
	return result, err
}

func (handler Handler) collectRuleCollisions(ctx context.Context, result *Result) error {
	custom, err := handler.Container.Client.ReservedUsernameRule.Query().All(ctx)
	if err != nil {
		return err
	}
	type entry struct {
		id, term, kind, category string
	}
	entries := make([]entry, 0, len(custom))
	for _, rule := range usernames.SystemReservedRules() {
		entries = append(entries, entry{id: "system:" + string(rule.Kind) + ":" + rule.Term, term: rule.Term, kind: string(rule.Kind), category: "SYSTEM"})
	}
	for _, row := range custom {
		category := strings.ToUpper(row.Category)
		if category == "" {
			category = "BRAND"
		}
		entries = append(entries, entry{id: row.ID.String(), term: row.Term, kind: string(row.MatchKind), category: category})
	}
	for _, candidate := range entries {
		rule := usernames.ReservedRule{Term: candidate.term, Kind: usernames.MatchKind(candidate.kind)}
		if _, matched := usernames.FindMatchingReservedRule(result.Normalized, []usernames.ReservedRule{rule}); !matched {
			continue
		}
		result.Collisions = append(result.Collisions, Collision{EntryId: candidate.id, Value: candidate.term, Kind: kindLabels[candidate.kind], Category: candidate.category, MatchedBy: matchedBy(result, candidate.term, candidate.kind)})
	}
	return nil
}

func matchedBy(result *Result, term, kind string) string {
	switch {
	case result.Normalized == term:
		return "EXACT"
	case result.Skeleton == usernames.BuildConfusableSkeleton(term):
		return "SKELETON"
	case kind == "prefix":
		return "PREFIX"
	}
	return "PATTERN"
}
