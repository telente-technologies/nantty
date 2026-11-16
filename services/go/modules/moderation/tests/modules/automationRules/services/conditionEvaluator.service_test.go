package services_test

import (
	"testing"

	"nantty/modules/moderation/src/modules/automationRules/services"
)

func TestConditionsFollowTheConsoleDryRunSemantics(t *testing.T) {
	data := map[string]any{"reason": "Scam", "recipientCount": float64(40), "isVerified": true, "accountAgeDays": float64(2), "empty": nil}
	cases := []struct {
		name      string
		condition services.Condition
		want      bool
	}{
		{"text equality ignores case", services.Condition{"reason", "EQUALS", "scam"}, true},
		{"numbers compare numerically", services.Condition{"recipientCount", "EQUALS", "40.0"}, true},
		{"not equals", services.Condition{"reason", "NOT_EQUALS", "spam"}, true},
		{"greater than", services.Condition{"recipientCount", "GREATER_THAN", "39"}, true},
		{"greater than is strict", services.Condition{"recipientCount", "GREATER_THAN", "40"}, false},
		{"less than", services.Condition{"accountAgeDays", "LESS_THAN", "7"}, true},
		{"greater than needs numbers", services.Condition{"reason", "GREATER_THAN", "1"}, false},
		{"contains ignores case", services.Condition{"reason", "CONTAINS", "CA"}, true},
		{"in is a comma list", services.Condition{"reason", "IN", "spam, scam ,hate"}, true},
		{"in misses", services.Condition{"reason", "IN", "spam,hate"}, false},
		{"booleans read as text", services.Condition{"isVerified", "EQUALS", "TRUE"}, true},
		{"missing field is not met", services.Condition{"country", "EQUALS", "NG"}, false},
		{"missing field is not met for not equals", services.Condition{"country", "NOT_EQUALS", "NG"}, false},
		{"null field is not met", services.Condition{"empty", "NOT_EQUALS", "x"}, false},
		{"invalid field path is not met", services.Condition{"reason.length", "EQUALS", "4"}, false},
		{"unknown operator is not met", services.Condition{"reason", "exists", ""}, false},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if _, got := services.EvaluateCondition(testCase.condition, data); got != testCase.want {
				t.Fatalf("got %v, want %v", got, testCase.want)
			}
		})
	}
}

func TestConditionMatchAllAnyAndEmpty(t *testing.T) {
	data := map[string]any{"reason": "scam", "recipientCount": float64(3)}
	hit, miss := services.Condition{"reason", "EQUALS", "scam"}, services.Condition{"recipientCount", "GREATER_THAN", "10"}
	cases := []struct {
		match      string
		conditions []services.Condition
		want       bool
	}{
		{"ALL", nil, true},
		{"ALL", []services.Condition{hit, miss}, false},
		{"ALL", []services.Condition{hit}, true},
		{"ANY", []services.Condition{hit, miss}, true},
		{"ANY", []services.Condition{miss}, false},
	}
	for _, testCase := range cases {
		steps, got := services.ConditionsMet(services.RuleContent{ConditionMatch: testCase.match, Conditions: testCase.conditions}, data)
		if got != testCase.want || len(steps) != len(testCase.conditions) {
			t.Fatalf("%s %v = %v with %d steps", testCase.match, testCase.conditions, got, len(steps))
		}
	}
}
