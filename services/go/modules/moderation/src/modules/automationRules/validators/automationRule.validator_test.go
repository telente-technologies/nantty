package validators

import (
	"encoding/json"
	"strings"
	"testing"

	"zudomart/modules/moderation/src/modules/automationRules/services"
	"zudomart/platform/httpserver"
)

func content(overrides map[string]any) json.RawMessage {
	base := map[string]any{
		"name": "Hide scam reports", "description": "", "isEnabled": true, "event": "report.created", "conditionMatch": "ALL",
		"conditions": []any{map[string]any{"field": "reason", "operator": "EQUALS", "value": "scam"}},
		"actions":    []any{map[string]any{"type": "hide_target", "parameters": map[string]any{"priority": "60"}}},
	}
	for key, value := range overrides {
		if value == nil {
			delete(base, key)
			continue
		}
		base[key] = value
	}
	encoded, _ := json.Marshal(base)
	return encoded
}

func issuePaths(err error) string {
	apiError, _ := err.(*httpserver.ApiError)
	if apiError == nil {
		return ""
	}
	paths := []string{}
	for _, issue := range apiError.Issues {
		paths = append(paths, issue.Path)
	}
	return strings.Join(paths, ",")
}

func TestRuleContentLimits(t *testing.T) {
	tooManyConditions := []any{}
	for range 11 {
		tooManyConditions = append(tooManyConditions, map[string]any{"field": "reason", "operator": "EQUALS", "value": "x"})
	}
	sixActions := []any{}
	for range 6 {
		sixActions = append(sixActions, map[string]any{"type": "flag_user", "parameters": map[string]any{}})
	}
	cases := []struct {
		name      string
		overrides map[string]any
		wantPath  string
	}{
		{"valid", nil, ""},
		{"name too short", map[string]any{"name": "ab"}, "content.name"},
		{"name too long", map[string]any{"name": strings.Repeat("n", 121)}, "content.name"},
		{"unknown event", map[string]any{"event": "payout.requested"}, "content.event"},
		{"field must belong to the event", map[string]any{"conditions": []any{map[string]any{"field": "storeId", "operator": "EQUALS", "value": "x"}}}, "content.conditions.0.field"},
		{"operator must be known", map[string]any{"conditions": []any{map[string]any{"field": "reason", "operator": "eq", "value": "x"}}}, "content.conditions.0.operator"},
		{"value is required", map[string]any{"conditions": []any{map[string]any{"field": "reason", "operator": "EQUALS", "value": " "}}}, "content.conditions.0.value"},
		{"at most ten conditions", map[string]any{"conditions": tooManyConditions}, "content.conditions"},
		{"at least one action", map[string]any{"actions": []any{}}, "content.actions"},
		{"at most five actions", map[string]any{"actions": sixActions}, "content.actions"},
		{"priority range", map[string]any{"actions": []any{map[string]any{"type": "hide_target", "parameters": map[string]any{"priority": "101"}}}}, "content.actions.0.parameters.priority"},
		{"unknown parameter", map[string]any{"actions": []any{map[string]any{"type": "hide_target", "parameters": map[string]any{"holdHours": "4"}}}}, "content.actions.0.parameters.holdHours"},
		{"hide needs a target", map[string]any{"event": "store.created", "conditions": []any{}}, "content.actions.0.type"},
		{"threshold count range", map[string]any{"threshold": map[string]any{"count": 1001, "withinSeconds": 60}}, "content.threshold"},
		{"threshold window at most 7 days", map[string]any{"threshold": map[string]any{"count": 2, "withinSeconds": 7*86400 + 1}}, "content.threshold"},
		{"cooldown at most 30 days", map[string]any{"cooldownSeconds": 30*86400 + 1}, "content.cooldownSeconds"},
		{"hourly cap range", map[string]any{"maxExecutionsPerHour": 0}, "content.maxExecutionsPerHour"},
		{"isEnabled is required", map[string]any{"isEnabled": nil}, "content.isEnabled"},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			_, err := ValidateRuleContent(content(testCase.overrides), nil)
			if got := issuePaths(err); got != testCase.wantPath {
				t.Fatalf("issues %q, want %q", got, testCase.wantPath)
			}
		})
	}
	if _, err := ValidateRuleContent(json.RawMessage(`{"name":"Hide","bogus":1}`), nil); err == nil {
		t.Fatal("unknown content fields are rejected")
	}
}

func TestRuleLimitsDefaultAndCarryOverWhenTheConsoleOmitsThem(t *testing.T) {
	created, err := ValidateRuleContent(content(nil), nil)
	if err != nil || created.Threshold != nil || created.CooldownSeconds != nil || created.MaxExecutionsPerHour != services.DefaultMaxExecutionsPerHour {
		t.Fatalf("defaults: %+v %v", created, err)
	}
	cooldown := 300
	previous := services.RuleContent{Threshold: &services.Threshold{Count: 3, WithinSeconds: 600}, CooldownSeconds: &cooldown, MaxExecutionsPerHour: 5}
	kept, err := ValidateRuleContent(content(nil), &previous)
	if err != nil || kept.Threshold == nil || kept.Threshold.Count != 3 || *kept.CooldownSeconds != 300 || kept.MaxExecutionsPerHour != 5 {
		t.Fatalf("omitted limits keep the previous version's values: %+v %v", kept, err)
	}
	cleared, err := ValidateRuleContent(content(map[string]any{"threshold": nil, "cooldownSeconds": 0}), &previous)
	if err != nil || cleared.CooldownSeconds == nil || *cleared.CooldownSeconds != 0 {
		t.Fatalf("explicit values win: %+v %v", cleared, err)
	}
	nulled, _ := ValidateRuleContent(json.RawMessage(strings.Replace(string(content(nil)), "{", `{"threshold":null,"cooldownSeconds":null,`, 1)), &previous)
	if nulled.Threshold != nil || nulled.CooldownSeconds != nil {
		t.Fatalf("explicit null clears the limit: %+v", nulled)
	}
}
