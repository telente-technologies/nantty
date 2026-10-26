package validators

import (
	"slices"
	"strconv"

	"nantty/modules/orders/src/databases/schema"
	"nantty/modules/orders/src/modules/customerSegments/dtos"
	"nantty/modules/orders/src/utils"
)

var numericFields = []string{"total_spent", "average_order_value", "purchases_count", "days_since_last_purchase", "days_since_first_purchase"}
var operators = []string{"at_least", "at_most", "equals"}

func ValidateSegmentInput(input dtos.CustomerSegmentInput) error {
	var collected utils.Issues
	collected.CheckLength("name", input.Name, 2, 60)
	if len(input.Description) > 200 {
		collected.Add("description", "must be at most 200 characters")
	}
	validateRules(input.Rules, &collected)
	return collected.AsError()
}

func ValidateSegmentChanges(changes dtos.CustomerSegmentChanges) error {
	var collected utils.Issues
	if changes.Name != nil {
		collected.CheckLength("name", *changes.Name, 2, 60)
	}
	if changes.Description != nil && len(*changes.Description) > 200 {
		collected.Add("description", "must be at most 200 characters")
	}
	if changes.Rules != nil {
		validateRules(*changes.Rules, &collected)
	}
	return collected.AsError()
}

func validateRules(rules []schema.CustomerSegmentRule, collected *utils.Issues) {
	if len(rules) < 1 || len(rules) > 8 {
		collected.Add("rules", "must have between 1 and 8 rules")
		return
	}
	for index, rule := range rules {
		path := "rules." + strconv.Itoa(index)
		if !slices.Contains(operators, rule.Operator) {
			collected.Add(path+".operator", "must be at_least, at_most or equals")
		}
		switch {
		case slices.Contains(numericFields, rule.Field):
			number, ok := rule.Value.(float64)
			if !ok || number < 0 || number != float64(int64(number)) {
				collected.Add(path+".value", "must be a whole number of at least 0")
			}
		case rule.Field == "tag" || rule.Field == "city":
			text, ok := rule.Value.(string)
			if !ok || len(text) < 1 || len(text) > 40 {
				collected.Add(path+".value", "must be 1-40 characters")
			}
		case rule.Field == "marketing_opt_in":
			if _, ok := rule.Value.(bool); !ok {
				collected.Add(path+".value", "must be true or false")
			}
		default:
			collected.Add(path+".field", "is not a segment field")
		}
	}
}
