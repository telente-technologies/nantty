package controllers

import (
	"net/mail"
	"slices"
	"strings"
	"time"
	"unicode"

	ledgerutils "nantty/modules/ledger/src/utils"
	"nantty/modules/subscriptions/src/constants"
	"nantty/modules/subscriptions/src/models"
	"nantty/modules/subscriptions/src/modules/billing/dtos"
	"nantty/platform/regionpricing"
)

const (
	maximumOfferRecipients   = 20
	maximumOfferNoteLength   = 500
	maximumOfferClaims       = 100_000
	maximumOfferCycles       = 36
	maximumOfferAmountMinor  = 100_000_000_000
	maximumOfferLabelLength  = 120
	maximumOfferReasonLength = 300
)

func isOfferPlanCode(planCode string) bool {
	definition, known := constants.Plans[planCode]
	return known && definition.SelfServe
}

func isPricingCurrency(currency string) bool {
	return slices.ContainsFunc(regionpricing.SupportedRegions(), func(region regionpricing.Region) bool { return region.Currency == currency })
}

func validateCreateOfferLink(body dtos.CreateOfferLinkRequestDto, now time.Time) error {
	collector := &ledgerutils.IssueCollector{}
	collector.RequireLength("label", body.Label, 0, maximumOfferLabelLength)
	collector.RequireLength("reason", body.Reason, 0, maximumOfferReasonLength)
	if len(body.PlanCodes) == 0 || len(body.PlanCodes) > len(constants.Plans) {
		collector.Add("planCodes", "choose at least one plan")
	}
	for index, code := range body.PlanCodes {
		if !isOfferPlanCode(code) || slices.Index(body.PlanCodes, code) != index {
			collector.Add("planCodes", "must be distinct purchasable plan codes")
			break
		}
	}
	switch body.DiscountKind {
	case models.OfferPercentage:
		collector.RequireRange("percentOff", body.PercentOff, 1, 100)
		if body.AmountOff != nil {
			collector.Add("amountOff", "must be empty for a percentage discount")
		}
	case models.OfferFixedAmount:
		if body.PercentOff != 0 {
			collector.Add("percentOff", "must be empty for a fixed amount discount")
		}
		if body.AmountOff == nil {
			collector.Add("amountOff", "is required for a fixed amount discount")
			break
		}
		collector.RequireRange("amountOff.amountMinor", body.AmountOff.AmountMinor, 1, maximumOfferAmountMinor)
		if !isPricingCurrency(body.AmountOff.Currency) {
			collector.Add("amountOff.currency", "must be a currency we charge plans in")
		}
	default:
		collector.Add("discountKind", "must be percentage or fixed_amount")
	}
	if !body.SingleUse {
		collector.RequireRange("maxClaims", int64(body.MaxClaims), 1, maximumOfferClaims)
	}
	collector.RequireRange("durationCycles", int64(body.DurationCycles), 1, maximumOfferCycles)
	if body.ExpiresAt != nil && !body.ExpiresAt.After(now) {
		collector.Add("expiresAt", "must be in the future")
	}
	return collector.Result()
}

func normalizedOfferRecipients(emails []string) []string {
	normalized := make([]string, 0, len(emails))
	for _, email := range emails {
		lowered := strings.ToLower(strings.TrimSpace(email))
		if !slices.Contains(normalized, lowered) {
			normalized = append(normalized, lowered)
		}
	}
	return normalized
}

func isPlainEmailAddress(email string) bool {
	parsed, err := mail.ParseAddress(email)
	return err == nil && parsed.Address == email && parsed.Name == "" && len(email) <= 254 && strings.Contains(email[strings.LastIndex(email, "@")+1:], ".")
}

func hasDisallowedControlCharacters(text string) bool {
	return strings.ContainsFunc(text, func(character rune) bool { return unicode.IsControl(character) && character != '\n' })
}

func validateSendOfferLink(body dtos.SendOfferLinkRequestDto) error {
	collector := &ledgerutils.IssueCollector{}
	recipients := normalizedOfferRecipients(body.RecipientEmails)
	if len(recipients) == 0 || len(recipients) > maximumOfferRecipients {
		collector.Add("recipientEmails", "add between 1 and 20 email addresses")
	}
	for _, email := range recipients {
		if !isPlainEmailAddress(email) {
			collector.Add("recipientEmails", "contains an invalid email address")
			break
		}
	}
	if len([]rune(body.Note)) > maximumOfferNoteLength || hasDisallowedControlCharacters(body.Note) {
		collector.Add("note", "must be plain text of at most 500 characters")
	}
	collector.RequireLength("reason", body.Reason, 0, maximumOfferReasonLength)
	return collector.Result()
}
