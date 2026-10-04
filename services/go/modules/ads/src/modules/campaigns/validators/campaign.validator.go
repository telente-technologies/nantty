package validators

import (
	"fmt"
	"slices"
	"strings"
	"time"

	"zudomart/modules/ads/src/modules/campaigns/dtos"
	"zudomart/modules/ads/src/services"
	"zudomart/modules/ads/src/types"
	"zudomart/platform/httpserver"
	"zudomart/platform/regionpricing"
)

var (
	objectives   = []string{"awareness", "traffic", "engagement", "messages", "sales", "followers", "store_promotion"}
	budgetTypes  = []string{"daily", "lifetime"}
	bidTypes     = []string{"auto", "max_cpc", "max_cpm", "target_cost"}
	callsToAct   = []string{"shop_now", "learn_more", "visit_store", "send_message", "follow", "watch_more", "order_now", "sign_up", "install", "download", "book_now", "contact_us"}
	formats      = []string{"feed_post", "clip", "product", "store", "story", "live"}
	sourceTypes  = []string{"post", "clip", "product", "store", "live", "upload"}
	destinations = []string{"post", "profile", "store", "product", "messages", "url", "app_store"}
	genders      = []string{"", "all", "female", "male"}
)

type PricingFloors = regionpricing.AdRegionPricing

type Issues struct {
	prefix string
	items  []httpserver.ValidationIssue
}

func NewIssues(prefix string) *Issues { return &Issues{prefix: prefix} }

func (issues *Issues) Add(path, message string) {
	if issues.prefix != "" {
		path = issues.prefix + "." + path
	}
	issues.items = append(issues.items, httpserver.ValidationIssue{Path: path, Message: message})
}

func (issues *Issues) AddAt(prefix, path, message string) {
	issues.items = append(issues.items, httpserver.ValidationIssue{Path: prefix + "." + path, Message: message})
}

func (issues *Issues) Merge(other *Issues) { issues.items = append(issues.items, other.items...) }

func (issues *Issues) Error() error {
	if len(issues.items) == 0 {
		return nil
	}
	return httpserver.NewValidationFailedError(issues.items)
}

func ParseSchedule(schedule types.Schedule, issues *Issues, path string) (time.Time, *time.Time) {
	start, err := time.Parse(time.RFC3339, schedule.StartAt)
	if err != nil {
		issues.Add(path+".startAt", "Choose a start date.")
	}
	if schedule.EndAt == nil {
		return start, nil
	}
	end, err := time.Parse(time.RFC3339, *schedule.EndAt)
	if err != nil {
		issues.Add(path+".endAt", "Choose a valid end date.")
		return start, nil
	}
	if !end.After(start) {
		issues.Add(path+".endAt", "The end must be after the start.")
	}
	return start, &end
}

func validateMoney(money types.Money, currency, path string, issues *Issues) {
	if money.Currency != currency {
		issues.Add(path, fmt.Sprintf("Amounts must be in %s, the ad account currency.", currency))
	}
	if money.AmountMinor <= 0 {
		issues.Add(path, "Enter an amount above zero.")
	}
}

func ValidateBudget(budget *types.Budget, currency string, minimumDailyMinor int64, schedule types.Schedule, issues *Issues, path string) {
	if budget == nil {
		return
	}
	if !slices.Contains(budgetTypes, budget.Type) {
		issues.Add(path+".type", "Choose a daily or lifetime budget.")
		return
	}
	validateMoney(budget.Amount, currency, path+".amount", issues)
	if budget.Type == "daily" && budget.Amount.AmountMinor < minimumDailyMinor {
		issues.Add(path+".amount", fmt.Sprintf("The daily budget is below the minimum of %s for the regions you target.", formatMinor(minimumDailyMinor, currency)))
	}
	if budget.Type == "lifetime" && schedule.EndAt == nil {
		issues.Add(path+".type", "A lifetime budget needs an end date.")
	}
}

func ValidateCampaignInput(input dtos.CampaignInput, currency string, floors PricingFloors, issues *Issues, path string) {
	if name := strings.TrimSpace(input.Name); name == "" || len(name) > 120 {
		issues.Add(path+".name", "Name the campaign (up to 120 characters).")
	}
	if !slices.Contains(objectives, input.Objective) {
		issues.Add(path+".objective", "Choose an objective.")
	}
	if input.BudgetLevel != "campaign" && input.BudgetLevel != "ad_set" {
		issues.Add(path+".budgetLevel", "Choose where the budget is set.")
	}
	ParseSchedule(input.Schedule, issues, path+".schedule")
	ValidateBudget(input.Budget, currency, floors.MinimumDailyBudgetMinor, input.Schedule, issues, path+".budget")
	if input.BudgetLevel == "campaign" && input.Budget == nil {
		issues.Add(path+".budget", "Set a campaign budget.")
	}
	if input.BudgetLevel == "ad_set" && input.Budget != nil {
		issues.Add(path+".budget", "Remove the campaign budget when budgets are set per ad set.")
	}
	if input.SpendCap != nil {
		validateMoney(*input.SpendCap, currency, path+".spendCap", issues)
	}
}

func ValidateAdSetInput(input dtos.AdSetInput, budgetLevel, currency string, floors PricingFloors, issues *Issues, path string) {
	if name := strings.TrimSpace(input.Name); name == "" || len(name) > 120 {
		issues.Add(path+".name", "Name the ad set (up to 120 characters).")
	}
	ParseSchedule(input.Schedule, issues, path+".schedule")
	ValidateBudget(input.Budget, currency, floors.MinimumDailyBudgetMinor, input.Schedule, issues, path+".budget")
	if budgetLevel == "ad_set" && input.Budget == nil {
		issues.Add(path+".budget", "Set an ad set budget.")
	}
	if budgetLevel == "campaign" && input.Budget != nil {
		issues.Add(path+".budget", "Remove the ad set budget when the campaign has one.")
	}
	validateBid(input.BidStrategy, currency, floors, issues, path+".bidStrategy")
	if cap := input.FrequencyCap; cap != nil && (cap.Impressions < 1 || cap.Impressions > 20 || cap.PerDays < 1 || cap.PerDays > 30) {
		issues.Add(path+".frequencyCap", "Use 1-20 impressions per 1-30 days.")
	}
	validateAudience(input.Audience, issues, path+".audience")
	validatePlacements(input, issues, path)
}

func validateBid(bid types.BidStrategy, currency string, floors PricingFloors, issues *Issues, path string) {
	if !slices.Contains(bidTypes, bid.Type) {
		issues.Add(path+".type", "Choose a bid strategy.")
		return
	}
	if bid.Type != "auto" {
		if bid.Amount == nil {
			issues.Add(path+".amount", "Enter a bid amount.")
			return
		}
		validateMoney(*bid.Amount, currency, path+".amount", issues)
		switch {
		case bid.Type == "max_cpm" && bid.Amount.AmountMinor < floors.CpmFloorMinor:
			issues.Add(path+".amount", fmt.Sprintf("Bid at least %s per 1,000 impressions for the regions you target.", formatMinor(floors.CpmFloorMinor, currency)))
		case (bid.Type == "max_cpc" || bid.Type == "target_cost") && bid.Amount.AmountMinor < floors.CpcFloorMinor:
			issues.Add(path+".amount", fmt.Sprintf("Bid at least %s per click for the regions you target.", formatMinor(floors.CpcFloorMinor, currency)))
		}
	}
}

func formatMinor(amountMinor int64, currency string) string {
	return fmt.Sprintf("%s %d.%02d", currency, amountMinor/100, amountMinor%100)
}

func validateAudience(audience types.AudienceSpec, issues *Issues, path string) {
	if len(audience.Locations) == 0 {
		issues.Add(path+".locations", "Choose at least one location.")
	}
	if audience.AgeMin < 18 || audience.AgeMax > 65 || audience.AgeMin > audience.AgeMax {
		issues.Add(path+".ageMin", "Ages must be between 18 and 65.")
	}
	if !slices.Contains(genders, audience.Gender) {
		issues.Add(path+".gender", "Choose all, female or male.")
	}
	if len(audience.CustomAudienceIds)+len(audience.ExcludedCustomAudienceIds) > 0 {
		issues.Add(path+".customAudienceIds", "Custom audiences are not available yet.")
	}
}

func validatePlacements(input dtos.AdSetInput, issues *Issues, path string) {
	if input.PlacementMode != "automatic" && input.PlacementMode != "manual" {
		issues.Add(path+".placementMode", "Choose automatic or manual placements.")
	}
	if input.PlacementMode == "manual" && len(input.Placements) == 0 {
		issues.Add(path+".placements", "Choose at least one placement.")
	}
	for _, placement := range input.Placements {
		if !slices.Contains(services.AllAdvertiserPlacements, placement) {
			issues.Add(path+".placements", "Unknown placement "+placement+".")
		}
	}
}

func ValidateCreativeInput(input types.CreativeInput, adSetPlacements []string, issues *Issues, path string) {
	if !slices.Contains(formats, input.Format) {
		issues.Add(path+".format", "Choose a creative format.")
	}
	if !slices.Contains(sourceTypes, input.Source.Type) || (input.Source.Id == "" && input.Source.Type != "upload") {
		issues.Add(path+".source", "Choose the content to promote.")
	}
	if headline := strings.TrimSpace(input.Headline); headline == "" || len(headline) > 60 {
		issues.Add(path+".headline", "Write a headline up to 60 characters.")
	}
	if len(input.PrimaryText) > 500 {
		issues.Add(path+".primaryText", "Primary text can be at most 500 characters.")
	}
	if !slices.Contains(callsToAct, input.CallToAction) {
		issues.Add(path+".callToAction", "Choose a button.")
	}
	validateCreativeType(input, issues, path)
	if slices.Contains(formats, input.Format) && !CreativeFitsAnyPlacement(input.Format, adSetPlacements) {
		issues.Add(path+".placements", "This creative cannot run in any of the selected placements.")
	}
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

var placementsByCreativeFormat = map[string][]string{
	"feed_post": {"feed"}, "clip": {"clips", "feed"}, "product": {"mart", "search", "feed"}, "store": {"feed", "mart"}, "story": {"stories"}, "live": {"live", "feed", "clips"},
}

func CreativeFitsAnyPlacement(format string, adSetPlacements []string) bool {
	if len(adSetPlacements) == 0 {
		return true
	}
	return slices.ContainsFunc(placementsByCreativeFormat[format], func(placement string) bool { return slices.Contains(adSetPlacements, placement) })
}

func ValidateBundle(submission dtos.CampaignDraftSubmission, currency string, floors PricingFloors) error {
	issues := NewIssues("")
	ValidateCampaignInput(submission.Campaign, currency, floors, issues, "campaign")
	ValidateAdSetInput(submission.AdSet, submission.Campaign.BudgetLevel, currency, floors, issues, "adSet")
	if len(submission.Ads) < 1 || len(submission.Ads) > 6 {
		issues.Add("ads", "Add 1-6 ads.")
	}
	placements := effectivePlacements(submission.AdSet)
	for index, ad := range submission.Ads {
		path := fmt.Sprintf("ads.%d", index)
		if name := strings.TrimSpace(ad.Name); name == "" || len(name) > 120 {
			issues.Add(path+".name", "Name the ad (up to 120 characters).")
		}
		ValidateCreativeInput(ad.Creative, placements, issues, path+".creative")
	}
	return issues.Error()
}

func effectivePlacements(input dtos.AdSetInput) []string {
	if input.PlacementMode == "manual" {
		return input.Placements
	}
	return nil
}

func EffectivePlacementsForAdSet(mode string, placements []string) []string {
	if mode == "manual" {
		return placements
	}
	return nil
}
