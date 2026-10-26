package listusers

import (
	"strings"

	"entgo.io/ent/dialect/sql"

	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent/predicate"
	"nantty/modules/users/src/generated/ent/profile"
	"nantty/modules/users/src/generated/ent/profilecheckmark"
	"nantty/modules/users/src/generated/ent/profilesignal"
	"nantty/modules/users/src/modules/accountEnforcement/services"
)

var liveCheckmarkStatuses = []any{string(profilecheckmark.StatusVerified), string(profilecheckmark.StatusGrace)}

func profileIdIn(subquery *sql.Selector, negate bool) predicate.Profile {
	return func(selector *sql.Selector) {
		condition := sql.In(selector.C(profile.FieldID), subquery)
		if negate {
			condition = sql.Not(condition)
		}
		selector.Where(condition)
	}
}

func liveCheckmarks(color string) *sql.Selector {
	subquery := sql.Select(profilecheckmark.FieldProfileID).From(sql.Table(profilecheckmark.Table))
	conditions := []*sql.Predicate{sql.In(profilecheckmark.FieldStatus, liveCheckmarkStatuses...)}
	if color != "" {
		conditions = append(conditions, sql.EQ(profilecheckmark.FieldColor, color))
	}
	return subquery.Where(sql.And(conditions...))
}

func signalsWithRiskBetween(minimum, maximum int) *sql.Selector {
	return sql.Select(profilesignal.FieldProfileID).From(sql.Table(profilesignal.Table)).
		Where(sql.And(sql.GTE(profilesignal.FieldRiskScore, minimum), sql.LTE(profilesignal.FieldRiskScore, maximum)))
}

func buildFilterPredicates(query Query) ([]predicate.Profile, error) {
	predicates := []predicate.Profile{}
	switch verification := strings.ToUpper(strings.TrimSpace(query.Verification)); verification {
	case "":
	case "BLUE", "GOLD", "BLACK":
		predicates = append(predicates, profileIdIn(liveCheckmarks(strings.ToLower(verification)), false))
	case "NONE":
		predicates = append(predicates, profileIdIn(liveCheckmarks(""), true))
	default:
		return nil, usersErrors.ValidationFailedFor("verification", "must be BLUE, GOLD, BLACK or NONE")
	}
	switch risk := strings.ToUpper(strings.TrimSpace(query.Risk)); risk {
	case "":
	case "LOW":
		predicates = append(predicates, profileIdIn(signalsWithRiskBetween(34, 100), true))
	case "MEDIUM":
		predicates = append(predicates, profileIdIn(signalsWithRiskBetween(34, 66), false))
	case "HIGH":
		predicates = append(predicates, profileIdIn(signalsWithRiskBetween(67, 100), false))
	default:
		return nil, usersErrors.ValidationFailedFor("risk", "must be LOW, MEDIUM or HIGH")
	}
	switch role := strings.ToLower(strings.TrimSpace(query.Role)); role {
	case "", "seller":
	case "creator":
		predicates = append(predicates, profile.CreatorStatusEQ(profile.CreatorStatusApproved))
	default:
		return nil, usersErrors.ValidationFailedFor("role", "must be seller or creator")
	}
	return predicates, nil
}

func matchesAccountFilters(query Query, summary services.PlatformUserSummary) bool {
	if status := strings.ToUpper(strings.TrimSpace(query.Status)); status != "" && summary.Status != status {
		return false
	}
	return !strings.EqualFold(strings.TrimSpace(query.Role), "seller") || summary.IsSeller
}
