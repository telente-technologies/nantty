package services

import "slices"

const SubjectType = "brand"

var transitions = map[string]map[string]string{
	"approve":      {"PENDING": "OFFICIAL", "NEEDS_INFO": "OFFICIAL"},
	"reject":       {"PENDING": "REJECTED", "NEEDS_INFO": "REJECTED"},
	"request-info": {"PENDING": "NEEDS_INFO"},
	"revoke":       {"OFFICIAL": "REVOKED"},
}

var actionNames = map[string]string{"approve": "approve", "reject": "reject", "request-info": "request_info", "revoke": "revoke"}

func NextOfficialStatus(action, current string) (string, bool) {
	next, allowed := transitions[action][current]
	return next, allowed
}

func AuditActionFor(action string) string { return "brand.official_" + actionNames[action] }

func AllowedOfficialActions(current string) []string {
	allowed := []string{}
	for _, action := range []string{"approve", "reject", "request-info", "revoke"} {
		if _, ok := transitions[action][current]; ok {
			allowed = append(allowed, action)
		}
	}
	return allowed
}

func IsOfficialAction(action string) bool {
	return slices.Contains([]string{"approve", "reject", "request-info", "revoke"}, action)
}
