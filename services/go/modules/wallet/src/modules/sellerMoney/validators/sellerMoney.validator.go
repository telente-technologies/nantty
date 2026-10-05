package validators

import (
	"regexp"
	"slices"

	"github.com/google/uuid"

	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
	"zudomart/platform/httpserver"
)

var accountNumberPatternByCountry = map[string]*regexp.Regexp{
	"NG": regexp.MustCompile(`^[0-9]{10}$`),
	"GH": regexp.MustCompile(`^[0-9]{10,16}$`),
	"KE": regexp.MustCompile(`^[0-9]{8,16}$`),
	"ZA": regexp.MustCompile(`^[0-9]{9,12}$`),
}

var fallbackAccountNumberPattern = regexp.MustCompile(`^[A-Za-z0-9]{6,34}$`)
var bankCodePattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,20}$`)

type issues []httpserver.ValidationIssue

func (collected *issues) add(path, message string) {
	*collected = append(*collected, httpserver.ValidationIssue{Path: path, Message: message})
}

func (collected issues) result() error {
	if len(collected) == 0 {
		return nil
	}
	return httpserver.NewValidationFailedError(collected)
}

func isIdentifier(value string) bool {
	_, err := uuid.Parse(value)
	return err == nil
}

func ValidateRequestPayout(body dtos.RequestPayoutBody) error {
	var collected issues
	if body.AmountMinor <= 0 {
		collected.add("amountMinor", "must be more than zero")
	}
	if !isIdentifier(body.AccountId) {
		collected.add("accountId", "must be one of your payout accounts")
	}
	return collected.result()
}

func ValidateResolvePayoutAccount(countryCode string) func(dtos.ResolvePayoutAccountBody) error {
	return func(body dtos.ResolvePayoutAccountBody) error {
		var collected issues
		if !bankCodePattern.MatchString(body.BankCode) {
			collected.add("bankCode", "must be a bank from the list")
		}
		pattern, known := accountNumberPatternByCountry[countryCode]
		if !known {
			pattern = fallbackAccountNumberPattern
		}
		if !pattern.MatchString(body.AccountNumber) {
			collected.add("accountNumber", "is not a valid account number for this country")
		}
		return collected.result()
	}
}

func ValidateAddPayoutAccount(body dtos.AddPayoutAccountBody) error {
	var collected issues
	if !isIdentifier(body.ResolutionId) {
		collected.add("resolutionId", "must come from an account lookup")
	}
	return collected.result()
}

func ValidateUpdatePayoutAccount(body dtos.UpdatePayoutAccountBody) error {
	var collected issues
	if !body.IsDefault {
		collected.add("isDefault", "can only be set to true")
	}
	return collected.result()
}

func ValidateSavePayoutSchedule(body dtos.SavePayoutScheduleBody) error {
	var collected issues
	if !slices.Contains([]string{"manual", "daily", "weekly", "monthly"}, body.Mode) {
		collected.add("mode", "must be manual, daily, weekly or monthly")
	}
	if body.Weekday < 0 || body.Weekday > 6 {
		collected.add("weekday", "must be between 0 and 6")
	}
	if body.DayOfMonth < 1 || body.DayOfMonth > 28 {
		collected.add("dayOfMonth", "must be between 1 and 28")
	}
	if body.KeepMinimumBalanceMinor < 0 {
		collected.add("keepMinimumBalanceMinor", "must be zero or more")
	}
	if body.AccountId == nil && body.Mode != "manual" {
		collected.add("accountId", "is required for automatic payouts")
	}
	if body.AccountId != nil && !isIdentifier(*body.AccountId) {
		collected.add("accountId", "must be one of your payout accounts")
	}
	return collected.result()
}
