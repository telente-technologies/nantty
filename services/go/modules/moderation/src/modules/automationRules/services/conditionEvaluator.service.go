package services

import (
	"regexp"
	"strconv"
	"strings"
)

var FieldPathPattern = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_]{0,63}$`)

var Operators = []string{"EQUALS", "NOT_EQUALS", "GREATER_THAN", "LESS_THAN", "CONTAINS", "IN"}

func ReadEventField(data map[string]any, field string) (string, bool) {
	if !FieldPathPattern.MatchString(field) {
		return "", false
	}
	raw, found := data[field]
	if !found || raw == nil {
		return "", false
	}
	switch value := raw.(type) {
	case string:
		return value, true
	case bool:
		return strconv.FormatBool(value), true
	case float64:
		return strconv.FormatFloat(value, 'f', -1, 64), true
	case int:
		return strconv.Itoa(value), true
	case int64:
		return strconv.FormatInt(value, 10), true
	}
	return "", false
}

func parseNumber(text string) (float64, bool) {
	if text == "" {
		return 0, false
	}
	number, err := strconv.ParseFloat(text, 64)
	return number, err == nil
}

func EvaluateCondition(condition Condition, data map[string]any) (string, bool) {
	actual, found := ReadEventField(data, condition.Field)
	if !found {
		return "", false
	}
	expected := strings.TrimSpace(condition.Value)
	actualNumber, actualIsNumber := parseNumber(actual)
	expectedNumber, expectedIsNumber := parseNumber(expected)
	bothNumbers := actualIsNumber && expectedIsNumber
	switch condition.Operator {
	case "EQUALS":
		return actual, (bothNumbers && actualNumber == expectedNumber) || (!bothNumbers && strings.EqualFold(actual, expected))
	case "NOT_EQUALS":
		return actual, (bothNumbers && actualNumber != expectedNumber) || (!bothNumbers && !strings.EqualFold(actual, expected))
	case "GREATER_THAN":
		return actual, bothNumbers && actualNumber > expectedNumber
	case "LESS_THAN":
		return actual, bothNumbers && actualNumber < expectedNumber
	case "CONTAINS":
		return actual, strings.Contains(strings.ToLower(actual), strings.ToLower(expected))
	case "IN":
		for _, option := range strings.Split(expected, ",") {
			if strings.EqualFold(strings.TrimSpace(option), actual) {
				return actual, true
			}
		}
	}
	return actual, false
}

func ConditionsMet(content RuleContent, data map[string]any) ([]Step, bool) {
	steps := make([]Step, 0, len(content.Conditions))
	metCount := 0
	for _, condition := range content.Conditions {
		actual, met := EvaluateCondition(condition, data)
		outcome := "failed"
		if met {
			outcome, metCount = "passed", metCount+1
		}
		steps = append(steps, Step{Kind: "condition", Name: condition.Field + " " + condition.Operator + " " + condition.Value, Outcome: outcome, Detail: "actual: " + actual})
	}
	if len(content.Conditions) == 0 {
		return steps, true
	}
	if content.ConditionMatch == "ANY" {
		return steps, metCount > 0
	}
	return steps, metCount == len(content.Conditions)
}
