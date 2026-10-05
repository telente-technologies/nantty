package validators

import (
	"zudomart/modules/users/src/modules/usernames/dtos"
	"zudomart/modules/users/src/utils"
)

func ValidateChangeUsernameRequest(request dtos.ChangeUsernameRequest) error {
	collector := &utils.IssueCollector{}
	collector.RequireLength("username", request.Username, 1, 64)
	return collector.Result()
}

func ValidateWithholdUsernameRequest(request dtos.WithholdUsernameRequest) error {
	collector := &utils.IssueCollector{}
	collector.RequireLength("username", request.Username, 1, 64)
	collector.RequireLength("reason", request.Reason, 5, 120)
	collector.RequireLength("note", request.Note, 0, 500)
	return collector.Result()
}

func ValidateAddReservedUsernameRuleRequest(request dtos.AddReservedUsernameRuleRequest) error {
	collector := &utils.IssueCollector{}
	collector.RequireLength("term", request.Term, 2, 30)
	collector.RequireOneOf("matchKind", request.MatchKind, []string{"exact", "prefix", "contains", "brand"})
	if request.Category != "" {
		collector.RequireOneOf("category", request.Category, []string{"BRAND", "GOVERNMENT", "SYSTEM", "OFFENSIVE", "PUBLIC_FIGURE"})
	}
	collector.RequireLength("note", request.Note, 0, 500)
	collector.RequireLength("reason", request.Reason, 0, 500)
	return collector.Result()
}
