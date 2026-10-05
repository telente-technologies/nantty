package services

import "testing"

func TestConditionsFollowTheConsoleDryRunSemantics(t *testing.T) {
	data := map[string]any{"reason": "Scam", "recipientCount": float64(40), "isVerified": true, "accountAgeDays": float64(2), "empty": nil}
	cases := []struct {
		name      string
		condition Condition
		want      bool
	}{
		{"text equality ignores case", Condition{"reason", "EQUALS", "scam"}, true},
		{"numbers compare numerically", Condition{"recipientCount", "EQUALS", "40.0"}, true},
		{"not equals", Condition{"reason", "NOT_EQUALS", "spam"}, true},
		{"greater than", Condition{"recipientCount", "GREATER_THAN", "39"}, true},
		{"greater than is strict", Condition{"recipientCount", "GREATER_THAN", "40"}, false},
		{"less than", Condition{"accountAgeDays", "LESS_THAN", "7"}, true},
		{"greater than needs numbers", Condition{"reason", "GREATER_THAN", "1"}, false},
		{"contains ignores case", Condition{"reason", "CONTAINS", "CA"}, true},
		{"in is a comma list", Condition{"reason", "IN", "spam, scam ,hate"}, true},
		{"in misses", Condition{"reason", "IN", "spam,hate"}, false},
		{"booleans read as text", Condition{"isVerified", "EQUALS", "TRUE"}, true},
		{"missing field is not met", Condition{"country", "EQUALS", "NG"}, false},
		{"missing field is not met for not equals", Condition{"country", "NOT_EQUALS", "NG"}, false},
		{"null field is not met", Condition{"empty", "NOT_EQUALS", "x"}, false},
		{"invalid field path is not met", Condition{"reason.length", "EQUALS", "4"}, false},
		{"unknown operator is not met", Condition{"reason", "exists", ""}, false},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if _, got := EvaluateCondition(testCase.condition, data); got != testCase.want {
				t.Fatalf("got %v, want %v", got, testCase.want)
			}
		})
	}
}

func TestConditionMatchAllAnyAndEmpty(t *testing.T) {
	data := map[string]any{"reason": "scam", "recipientCount": float64(3)}
	hit, miss := Condition{"reason", "EQUALS", "scam"}, Condition{"recipientCount", "GREATER_THAN", "10"}
	cases := []struct {
		match      string
		conditions []Condition
		want       bool
	}{
		{"ALL", nil, true},
		{"ALL", []Condition{hit, miss}, false},
		{"ALL", []Condition{hit}, true},
		{"ANY", []Condition{hit, miss}, true},
		{"ANY", []Condition{miss}, false},
	}
	for _, testCase := range cases {
		steps, got := ConditionsMet(RuleContent{ConditionMatch: testCase.match, Conditions: testCase.conditions}, data)
		if got != testCase.want || len(steps) != len(testCase.conditions) {
			t.Fatalf("%s %v = %v with %d steps", testCase.match, testCase.conditions, got, len(steps))
		}
	}
}
