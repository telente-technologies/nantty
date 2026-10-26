package validators

import (
	"net/mail"
	"regexp"
	"strings"

	"nantty/modules/inventory/src/modules/suppliers/dtos"
	"nantty/modules/inventory/src/utils"
)

var phonePattern = regexp.MustCompile(`^\+?[0-9 ]{7,20}$`)

func ValidateSupplier(body dtos.SupplierRequest) error {
	var collected utils.Issues
	collected.CheckLength("name", body.Name, 2, 80)
	if len(body.ContactName) > 80 {
		collected.Add("contactName", "must be at most 80 characters")
	}
	if !phonePattern.MatchString(body.Phone) {
		collected.Add("phone", "must be a valid phone number")
	}
	if body.Email != nil {
		if _, err := mail.ParseAddress(strings.TrimSpace(*body.Email)); err != nil || len(*body.Email) > 160 {
			collected.Add("email", "must be a valid email address")
		}
	}
	if len(body.Address) > 200 {
		collected.Add("address", "must be at most 200 characters")
	}
	collected.CheckRange("leadTimeDays", body.LeadTimeDays, 0, 180)
	if len(body.PaymentTerms) > 80 {
		collected.Add("paymentTerms", "must be at most 80 characters")
	}
	if body.Notes != nil && len(*body.Notes) > 500 {
		collected.Add("notes", "must be at most 500 characters")
	}
	return collected.AsError()
}
