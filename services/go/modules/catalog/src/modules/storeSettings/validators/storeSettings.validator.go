package validators

import (
	"regexp"
	"slices"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/databases/schema"
	"zudomart/modules/catalog/src/modules/storeSettings/dtos"
	"zudomart/modules/catalog/src/utils"
)

var (
	phonePattern     = regexp.MustCompile(`^\+?[0-9][0-9 ()-]{6,19}$`)
	emailPattern     = regexp.MustCompile(`^[^\s@]{1,64}@[^\s@]{1,255}\.[A-Za-z]{2,}$`)
	taxIdPattern     = regexp.MustCompile(`^[A-Za-z0-9_-]{1,40}$`)
	mediaIdPattern   = regexp.MustCompile(`^[A-Za-z0-9_-]{1,80}$`)
	clockTimePattern = regexp.MustCompile(`^([01][0-9]|2[0-3]):[0-5][0-9]$`)
)

func ValidateUpdateStoreSettings(body dtos.UpdateStoreSettingsRequest) error {
	var collected utils.Issues
	if body.Name != nil {
		collected.CheckLength("name", *body.Name, 2, 80)
	}
	if body.Description != nil && len(*body.Description) > 500 {
		collected.Add("description", "must be at most 500 characters")
	}
	if body.Phone != nil && *body.Phone != "" && !phonePattern.MatchString(strings.TrimSpace(*body.Phone)) {
		collected.Add("phone", "must be a phone number like +2348012345678")
	}
	if body.Email != nil && *body.Email != "" && (!emailPattern.MatchString(strings.TrimSpace(*body.Email)) || len(*body.Email) > 120) {
		collected.Add("email", "must be an email address")
	}
	if body.Address != nil && *body.Address != "" {
		collected.CheckLength("address", *body.Address, 5, 200)
	}
	if body.Taxes != nil {
		validateTaxRates(*body.Taxes, &collected)
	}
	if body.Policies != nil {
		validatePolicies(*body.Policies, &collected)
	}
	if body.Notifications != nil {
		for key := range *body.Notifications {
			if !slices.Contains(dtos.NotificationPreferenceKeys, key) {
				collected.Add("notifications."+key, "is not a notification setting")
			}
		}
	}
	return collected.AsError()
}

func validateTaxRates(taxes []schema.StoreTaxRate, collected *utils.Issues) {
	if len(taxes) > 20 {
		collected.Add("taxes", "must have at most 20 rates")
		return
	}
	seen := map[string]bool{}
	defaults := 0
	for index, tax := range taxes {
		path := "taxes." + strconv.Itoa(index)
		if !taxIdPattern.MatchString(tax.Id) {
			collected.Add(path+".id", "must be 1-40 letters, digits, - or _")
		} else if seen[tax.Id] {
			collected.Add(path+".id", "must be unique")
		}
		seen[tax.Id] = true
		collected.CheckLength(path+".name", tax.Name, 1, 40)
		collected.CheckRange(path+".rateBasisPoints", tax.RateBasisPoints, 0, 10000)
		if tax.IsDefault {
			defaults++
			if tax.AppliesToCategoryIds != nil {
				collected.Add(path+".appliesToCategoryIds", "must be null on the default rate")
			}
			continue
		}
		if tax.AppliesToCategoryIds != nil && len(tax.AppliesToCategoryIds) == 0 {
			collected.Add(path+".appliesToCategoryIds", "must be null or list at least one category")
		}
		for _, categoryId := range tax.AppliesToCategoryIds {
			if _, err := uuid.Parse(categoryId); err != nil {
				collected.Add(path+".appliesToCategoryIds", "must contain valid category ids")
				break
			}
		}
	}
	if len(taxes) > 0 && defaults != 1 {
		collected.Add("taxes", "must have exactly one default rate")
	}
}

func validatePolicies(policies schema.StorePolicies, collected *utils.Issues) {
	for path, text := range map[string]string{"policies.returns": policies.Returns, "policies.shipping": policies.Shipping, "policies.privacy": policies.Privacy} {
		if len(text) > 2000 {
			collected.Add(path, "must be at most 2000 characters")
		}
	}
}

func ValidateUpdateStorefront(body dtos.UpdateStorefrontRequest) error {
	var collected utils.Issues
	if body.Name != nil {
		collected.CheckLength("name", *body.Name, 2, 80)
	}
	if body.Tagline != nil && len(*body.Tagline) > 120 {
		collected.Add("tagline", "must be at most 120 characters")
	}
	if body.Description != nil && len(*body.Description) > 1000 {
		collected.Add("description", "must be at most 1000 characters")
	}
	for path, media := range map[string]dtos.NullableText{"logoMediaId": body.LogoMediaId, "coverMediaId": body.CoverMediaId} {
		if media.Value != nil && !mediaIdPattern.MatchString(*media.Value) {
			collected.Add(path, "must be an uploaded media id")
		}
	}
	if body.Policies != nil {
		validatePolicies(*body.Policies, &collected)
	}
	if body.OpeningHours != nil {
		validateOpeningHours(*body.OpeningHours, &collected)
	}
	if body.SocialLinks != nil {
		validateSocialLinks(*body.SocialLinks, &collected)
	}
	if body.FeaturedProductIds != nil {
		ids := *body.FeaturedProductIds
		if len(ids) > 12 {
			collected.Add("featuredProductIds", "must have at most 12 products")
		}
		parsed := utils.ParseIdentifiers("featuredProductIds", ids, &collected)
		if len(parsed) == len(ids) && len(uniqueStrings(ids)) != len(ids) {
			collected.Add("featuredProductIds", "must not repeat a product")
		}
	}
	return collected.AsError()
}

func validateOpeningHours(hours []schema.StoreOpeningHours, collected *utils.Issues) {
	if len(hours) != len(dtos.StorefrontWeekdays) {
		collected.Add("openingHours", "must list each weekday once")
		return
	}
	seen := map[string]bool{}
	for index, day := range hours {
		path := "openingHours." + strconv.Itoa(index)
		if !slices.Contains(dtos.StorefrontWeekdays, day.Weekday) || seen[day.Weekday] {
			collected.Add(path+".weekday", "must be a weekday listed once")
		}
		seen[day.Weekday] = true
		if !clockTimePattern.MatchString(day.OpensAt) || !clockTimePattern.MatchString(day.ClosesAt) {
			collected.Add(path, "times must be HH:MM")
			continue
		}
		if day.IsOpen && day.OpensAt >= day.ClosesAt {
			collected.Add(path+".closesAt", "must be after the opening time")
		}
	}
}

func validateSocialLinks(links map[string]*string, collected *utils.Issues) {
	for network, link := range links {
		path := "socialLinks." + network
		if !slices.Contains(dtos.StorefrontSocialNetworks, network) {
			collected.Add(path, "is not a supported link")
			continue
		}
		if link == nil || *link == "" {
			continue
		}
		if len(*link) > 300 || strings.ContainsAny(*link, " \t\n<>\"") {
			collected.Add(path, "must be a short link or handle")
		} else if network == "website" && !strings.HasPrefix(*link, "https://") {
			collected.Add(path, "must start with https://")
		}
	}
}

func uniqueStrings(values []string) map[string]bool {
	unique := map[string]bool{}
	for _, value := range values {
		unique[value] = true
	}
	return unique
}
