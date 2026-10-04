package constants

const (
	PlanSellerPro      = "seller_pro"
	PlanSellerBusiness = "seller_business"
	PlanGoldOnly       = "gold_only"
	PlanBlack          = "black"
	PlanBlueEssential  = "blue_essential"
	PlanBlue           = "blue"
	PlanPremium        = "premium"

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
	Tier                string
}

var Plans = map[string]PlanDefinition{
	PlanSellerPro:      {Code: PlanSellerPro, ProfileTypes: []string{ProfileBusiness, ProfileBrand}, Checkmark: "gold", SellerPlan: "pro", TrialAllowed: true, BundleEligible: true, SelfServe: true, Tier: "PRO"},
	PlanSellerBusiness: {Code: PlanSellerBusiness, ProfileTypes: []string{ProfileBusiness, ProfileBrand}, Checkmark: "gold", SellerPlan: "business", TrialAllowed: true, BundleEligible: true, SelfServe: true, Tier: "BUSINESS"},
	PlanGoldOnly:       {Code: PlanGoldOnly, ProfileTypes: []string{ProfileBusiness, ProfileBrand}, Checkmark: "gold", TrialAllowed: true, BundleEligible: true, SelfServe: true, Tier: "GOLD"},
	PlanBlack:          {Code: PlanBlack, ProfileTypes: []string{ProfileGovernment}, Checkmark: "black", GracePeriodEligible: true, Tier: "OFFICIAL"},
	PlanBlueEssential:  {Code: PlanBlueEssential, ProfileTypes: []string{ProfilePersonal}, SelfServe: true, InAppAllowed: true, Tier: "ESSENTIAL"},
	PlanBlue:           {Code: PlanBlue, ProfileTypes: []string{ProfilePersonal}, Checkmark: "blue", SelfServe: true, InAppAllowed: true, Tier: "VERIFIED"},
	PlanPremium:        {Code: PlanPremium, ProfileTypes: []string{ProfilePersonal}, Checkmark: "blue", TrialAllowed: true, SelfServe: true, InAppAllowed: true, Tier: "PREMIUM"},
}

var LiveStatuses = []string{"trialing", "active", "past_due", "grace"}
