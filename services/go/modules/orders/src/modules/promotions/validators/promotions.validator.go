package validators

import (
	"regexp"
	"slices"
	"strings"

	"nantty/modules/orders/src/modules/promotions/dtos"
	"nantty/modules/orders/src/utils"
)

var codePattern = regexp.MustCompile(`^[A-Z0-9_-]{3,24}$`)

func validatePromotion(body dtos.PromotionRequest, creating bool) error {
	var collected utils.Issues
	if creating && (body.Name == nil || body.Kind == nil || body.Discount == nil || body.Scope == nil || body.StartsAt == nil) {
		collected.Add("name", "name, kind, discount, scope and startsAt are required")
	}
	if body.Name != nil {
		collected.CheckLength("name", *body.Name, 3, 80)
	}
	if body.Kind != nil && !slices.Contains([]string{"coupon", "automatic", "scheduled_sale"}, *body.Kind) {
		collected.Add("kind", "must be coupon, automatic or scheduled_sale")
	}
	if body.Kind != nil && *body.Kind == "coupon" && (body.Code == nil || !codePattern.MatchString(strings.ToUpper(*body.Code))) {
		collected.Add("code", "must be 3-24 letters, digits, _ or -")
	}
	if body.Discount != nil {
		switch body.Discount.Kind {
		case "percent":
			if body.Discount.Value < 1 || body.Discount.Value > 10_000 {
				collected.Add("discount.value", "must be 1-10000 basis points")
			}
		case "amount":
			if body.Discount.Value <= 0 {
				collected.Add("discount.value", "must be above zero")
			}
		default:
			collected.Add("discount.kind", "must be percent or amount")
		}
	}
	if body.Scope != nil {
		if !slices.Contains([]string{"all", "products", "categories"}, body.Scope.Kind) {
			collected.Add("scope.kind", "must be all, products or categories")
		}
		if body.Scope.Kind != "all" && (len(body.Scope.Ids) < 1 || len(body.Scope.Ids) > 200) {
			collected.Add("scope.ids", "must contain 1 to 200 ids")
		}
		utils.ParseIdentifiers("scope.ids", body.Scope.Ids, &collected)
	}
	if body.MinimumSpendMinor != nil && *body.MinimumSpendMinor != nil && **body.MinimumSpendMinor < 0 {
		collected.Add("minimumSpendMinor", "must be zero or more")
	}
	for path, limit := range map[string]**int{"usageLimit": body.UsageLimit, "usageLimitPerCustomer": body.UsageLimitPerCustomer} {
		if limit != nil && *limit != nil && (**limit < 1 || **limit > 10_000_000) {
			collected.Add(path, "must be between 1 and 10000000")
		}
	}
	if body.EndsAt != nil && *body.EndsAt != nil && body.StartsAt != nil && !(*body.EndsAt).After(*body.StartsAt) {
		collected.Add("endsAt", "must be after startsAt")
	}
	if body.Kind != nil && *body.Kind == "scheduled_sale" && (body.EndsAt == nil || *body.EndsAt == nil) {
		collected.Add("endsAt", "is required for a scheduled sale")
	}
	if body.Status != nil && *body.Status != "disabled" && *body.Status != "active" {
		collected.Add("status", "must be disabled or active")
	}
	return collected.AsError()
}

func ValidateCreatePromotion(body dtos.PromotionRequest) error { return validatePromotion(body, true) }
func ValidateUpdatePromotion(body dtos.PromotionRequest) error { return validatePromotion(body, false) }

func ValidateCodeCheck(body dtos.ValidateCodeRequest) error {
	var collected utils.Issues
	collected.CheckLength("code", body.Code, 3, 24)
	if body.SubtotalMinor < 0 {
		collected.Add("subtotalMinor", "must be zero or more")
	}
	return collected.AsError()
}
