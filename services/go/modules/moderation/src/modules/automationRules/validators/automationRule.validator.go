package validators

import (
	"bytes"
	"encoding/json"
	"fmt"
	"regexp"
	"slices"
	"strconv"
	"strings"

	"zudomart/modules/moderation/src/modules/automationRules/services"
	"zudomart/platform/httpserver"
)

var RuleIdPattern = regexp.MustCompile(`^rule_[a-z0-9_]{3,58}$`)

const (
	maximumWindowSeconds   = 7 * 86_400
	maximumCooldownSeconds = 30 * 86_400
)

type rawContent struct {
	Name                 string               `json:"name"`
	Description          string               `json:"description"`
	IsEnabled            *bool                `json:"isEnabled"`
	Event                string               `json:"event"`
	ConditionMatch       string               `json:"conditionMatch"`
	Conditions           []services.Condition `json:"conditions"`
	Actions              []services.Action    `json:"actions"`
	Threshold            json.RawMessage      `json:"threshold"`
	CooldownSeconds      json.RawMessage      `json:"cooldownSeconds"`
	MaxExecutionsPerHour *int                 `json:"maxExecutionsPerHour"`
}

type issues []httpserver.ValidationIssue

func (list *issues) add(path, message string) {
	*list = append(*list, httpserver.ValidationIssue{Path: path, Message: message})
}

func ValidateRuleContent(raw json.RawMessage, previous *services.RuleContent) (services.RuleContent, error) {
	var input rawContent
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if len(raw) == 0 || decoder.Decode(&input) != nil {
		return services.RuleContent{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "content", Message: "must be an automation rule object"}})
	}
	var found issues
	content := services.RuleContent{Name: strings.TrimSpace(input.Name), Description: strings.TrimSpace(input.Description), Event: input.Event, ConditionMatch: input.ConditionMatch, Conditions: []services.Condition{}, Actions: []services.Action{}}
	if length := len([]rune(content.Name)); length < 3 || length > 120 {
		found.add("content.name", "must be 3 to 120 characters")
	}
	if len([]rune(content.Description)) > 1000 {
		found.add("content.description", "must be at most 1000 characters")
	}
	if input.IsEnabled == nil {
		found.add("content.isEnabled", "is required")
	} else {
		content.IsEnabled = *input.IsEnabled
	}
	if content.ConditionMatch != "ALL" && content.ConditionMatch != "ANY" {
		found.add("content.conditionMatch", "must be ALL or ANY")
	}
	event, known := services.FindCatalogEvent(input.Event)
	if !known {
		found.add("content.event", "is not an event in the catalog")
	}
	content.Conditions = validateConditions(input.Conditions, event, known, &found)
	content.Actions = validateActions(input.Actions, event, known, &found)
	applyLimits(&content, input, previous, &found)
	if len(found) > 0 {
		return services.RuleContent{}, httpserver.NewValidationFailedError(found)
	}
	return content, nil
}

func validateConditions(conditions []services.Condition, event services.CatalogEvent, eventKnown bool, found *issues) []services.Condition {
	if len(conditions) > services.MaximumConditions {
		found.add("content.conditions", fmt.Sprintf("must have at most %d conditions", services.MaximumConditions))
		return nil
	}
	accepted := make([]services.Condition, 0, len(conditions))
	for index, condition := range conditions {
		path := fmt.Sprintf("content.conditions.%d", index)
		if !services.FieldPathPattern.MatchString(condition.Field) || eventKnown && !slices.ContainsFunc(event.Fields, func(field services.CatalogField) bool { return field.Key == condition.Field }) {
			found.add(path+".field", "is not a field of this event")
		}
		if !slices.Contains(services.Operators, condition.Operator) {
			found.add(path+".operator", "is not a known operator")
		}
		if value := strings.TrimSpace(condition.Value); value == "" || len(value) > 200 {
			found.add(path+".value", "must be 1 to 200 characters")
		}
		accepted = append(accepted, services.Condition{Field: condition.Field, Operator: condition.Operator, Value: strings.TrimSpace(condition.Value)})
	}
	return accepted
}

func validateActions(actions []services.Action, event services.CatalogEvent, eventKnown bool, found *issues) []services.Action {
	if len(actions) < 1 || len(actions) > services.MaximumActions {
		found.add("content.actions", fmt.Sprintf("must have 1 to %d actions", services.MaximumActions))
		return nil
	}
	accepted := make([]services.Action, 0, len(actions))
	for index, action := range actions {
		path := fmt.Sprintf("content.actions.%d", index)
		if _, known := services.FindCatalogAction(action.Type); !known {
			found.add(path+".type", "is not an action in the catalog")
			continue
		}
		if eventKnown && action.Type != services.ActionFlagUser && !event.HasTarget {
			found.add(path+".type", "this event has no content to hide or queue")
		}
		parameters := map[string]string{}
		for key, value := range action.Parameters {
			value = strings.TrimSpace(value)
			switch {
			case key == "priority":
				if priority, err := strconv.Atoi(value); err != nil || priority < 0 || priority > 100 {
					found.add(path+".parameters.priority", "must be a whole number from 0 to 100")
				}
			case key == "userField" && action.Type == services.ActionFlagUser:
				if !services.FieldPathPattern.MatchString(value) {
					found.add(path+".parameters.userField", "must be a field name")
				}
			default:
				found.add(path+".parameters."+key, "is not a parameter of this action")
			}
			parameters[key] = value
		}
		accepted = append(accepted, services.Action{Type: action.Type, Parameters: parameters})
	}
	return accepted
}

func applyLimits(content *services.RuleContent, input rawContent, previous *services.RuleContent, found *issues) {
	content.MaxExecutionsPerHour = services.DefaultMaxExecutionsPerHour
	if previous != nil {
		content.Threshold, content.CooldownSeconds, content.MaxExecutionsPerHour = previous.Threshold, previous.CooldownSeconds, previous.MaxExecutionsPerHour
	}
	if input.Threshold != nil {
		content.Threshold = nil
		if string(input.Threshold) != "null" {
			var threshold services.Threshold
			strict := json.NewDecoder(bytes.NewReader(input.Threshold))
			strict.DisallowUnknownFields()
			if strict.Decode(&threshold) != nil || threshold.Count < 1 || threshold.Count > 1000 || threshold.WithinSeconds < 1 || threshold.WithinSeconds > maximumWindowSeconds {
				found.add("content.threshold", "count must be 1 to 1000 within 1 second to 7 days")
			}
			content.Threshold = &threshold
		}
	}
	if input.CooldownSeconds != nil {
		content.CooldownSeconds = nil
		if string(input.CooldownSeconds) != "null" {
			var seconds int
			if json.Unmarshal(input.CooldownSeconds, &seconds) != nil || seconds < 0 || seconds > maximumCooldownSeconds {
				found.add("content.cooldownSeconds", "must be null or 0 to 30 days in seconds")
			}
			content.CooldownSeconds = &seconds
		}
	}
	if input.MaxExecutionsPerHour != nil {
		if *input.MaxExecutionsPerHour < 1 || *input.MaxExecutionsPerHour > 10_000 {
			found.add("content.maxExecutionsPerHour", "must be 1 to 10000")
		}
		content.MaxExecutionsPerHour = *input.MaxExecutionsPerHour
	}
}

func ValidateReason(reason string) (string, error) {
	trimmed := strings.TrimSpace(reason)
	if length := len([]rune(trimmed)); length < 5 || length > 1000 {
		return "", httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "reason", Message: "must be 5 to 1000 characters"}})
	}
	return trimmed, nil
}

func ValidateExpectedVersion(expected *int) (int, error) {
	if expected == nil || *expected < 0 {
		return 0, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "expectedVersion", Message: "expectedVersion must be the version you edited."}})
	}
	return *expected, nil
}
