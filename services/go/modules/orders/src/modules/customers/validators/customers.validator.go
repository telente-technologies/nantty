package validators

import (
	"regexp"
	"strconv"
	"strings"

	"zudomart/modules/orders/src/modules/customers/dtos"
	"zudomart/modules/orders/src/utils"
)

var (
	phonePattern = regexp.MustCompile(`^\+?[0-9][0-9 ()-]{6,19}$`)
	emailPattern = regexp.MustCompile(`^[^\s@]{1,64}@[^\s@]{1,255}\.[A-Za-z]{2,}$`)
)

func validateProfile(input dtos.CustomerProfileInput, requireName bool) error {
	var collected utils.Issues
	if input.Name != nil || requireName {
		name := ""
		if input.Name != nil {
			name = *input.Name
		}
		collected.CheckLength("name", name, 2, 80)
	}
	if input.Phone != nil && *input.Phone != "" && !phonePattern.MatchString(strings.TrimSpace(*input.Phone)) {
		collected.Add("phone", "must be a phone number like +2348012345678")
	}
	if input.Email != nil && *input.Email != "" && (!emailPattern.MatchString(strings.TrimSpace(*input.Email)) || len(*input.Email) > 120) {
		collected.Add("email", "must be an email address")
	}
	if input.Tags != nil {
		if len(*input.Tags) > 10 {
			collected.Add("tags", "must have at most 10 tags")
		}
		for index, tag := range *input.Tags {
			if trimmed := strings.TrimSpace(tag); trimmed == "" || len(trimmed) > 24 {
				collected.Add("tags."+strconv.Itoa(index), "must be 1-24 characters")
			}
		}
	}
	return collected.AsError()
}

func ValidateNewCustomer(input dtos.CustomerProfileInput) error { return validateProfile(input, true) }

func ValidateCustomerChanges(input dtos.CustomerProfileInput) error {
	return validateProfile(input, false)
}
