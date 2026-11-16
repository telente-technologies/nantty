package constants

const (
	PlanSellerPro      = "seller_pro"
	PlanSellerBusiness = "seller_business"
	PlanGoldOnly       = "gold_only"
	PlanBlack          = "black"
	PlanBlueEssential  = "blue_essential"
	PlanBlue           = "blue"
	PlanPremium        = "premium"
	PlanGoldCombined   = "gold_combined"

	ProfilePersonal   = "personal"
	ProfileBusiness   = "business"
	ProfileBrand      = "brand"
	ProfileGovernment = "government"

	TrialRulesSettingKey       = "trial-rules"
	CheckmarkPricingSettingKey = "checkmark-pricing"
)

type PlanDefinition struct {
	Code                string
	ProfileTypes        []string
	Checkmark           string
	SellerPlan          string
	TrialAllowed        bool
	BundleEligible      bool
	SelfServe           bool
	GracePeriodEligible bool
	InAppAllowed        bool
	AnnualDisabled      bool
	DiscountsDisabled   bool
	Tier                string
}

var Plans = map[string]PlanDefinition{
	PlanSellerPro:      {Code: PlanSellerPro, ProfileTypes: []string{ProfileBusiness, ProfileBrand}, Checkmark: "gold", SellerPlan: "pro", TrialAllowed: true, BundleEligible: true, SelfServe: true, InAppAllowed: true, Tier: "PRO"},
	PlanSellerBusiness: {Code: PlanSellerBusiness, ProfileTypes: []string{ProfileBusiness, ProfileBrand}, Checkmark: "gold", SellerPlan: "business", TrialAllowed: true, BundleEligible: true, SelfServe: true, InAppAllowed: true, Tier: "BUSINESS"},
	PlanGoldOnly:       {Code: PlanGoldOnly, ProfileTypes: []string{ProfileBusiness, ProfileBrand}, Checkmark: "gold", TrialAllowed: true, BundleEligible: true, SelfServe: true, Tier: "GOLD"},
	PlanBlack:          {Code: PlanBlack, ProfileTypes: []string{ProfileGovernment}, Checkmark: "black", GracePeriodEligible: false, AnnualDisabled: true, DiscountsDisabled: true, Tier: "OFFICIAL"},
	PlanBlueEssential:  {Code: PlanBlueEssential, ProfileTypes: []string{ProfilePersonal}, SelfServe: true, InAppAllowed: true, Tier: "ESSENTIAL"},
	PlanBlue:           {Code: PlanBlue, ProfileTypes: []string{ProfilePersonal}, Checkmark: "blue", SelfServe: true, InAppAllowed: true, Tier: "VERIFIED"},
	PlanGoldCombined:   {Code: PlanGoldCombined, ProfileTypes: []string{ProfilePersonal}, Checkmark: "gold", SelfServe: true, Tier: "GOLD_COMBINED"},
	PlanPremium:        {Code: PlanPremium, ProfileTypes: []string{ProfilePersonal}, Checkmark: "blue", TrialAllowed: true, SelfServe: true, InAppAllowed: true, Tier: "PREMIUM"},
}

var LiveStatuses = []string{"trialing", "active", "past_due", "grace"}

func IsBlackPlan(planCode string) bool { return planCode == PlanBlack }
