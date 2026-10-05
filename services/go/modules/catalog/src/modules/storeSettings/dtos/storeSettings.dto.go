package dtos

import (
	"encoding/json"

	"zudomart/modules/catalog/src/databases/schema"
	"zudomart/platform/money"
)

var NotificationPreferenceKeys = []string{
	"newOrderEmail", "newOrderSms", "lowStockEmail", "lowStockSms", "payoutEmail", "disputeEmail",
	"reviewEmail", "messageDigestEmail", "dailySummaryEmail", "weeklyPerformanceEmail",
}

var AutomatedAlertKeys = []string{"lowStockEmail", "lowStockSms", "dailySummaryEmail", "weeklyPerformanceEmail"}

type StoreRewardsRulesView struct {
	Enabled                bool        `json:"enabled"`
	PercentBackBasisPoints int         `json:"percentBackBasisPoints"`
	MinimumOrder           money.Money `json:"minimumOrder"`
	MaxPerOrder            money.Money `json:"maxPerOrder"`
	ExpiryDays             int         `json:"expiryDays"`
}

type StoreSettingsView struct {
	StoreId          string                `json:"storeId"`
	Name             string                `json:"name"`
	Handle           string                `json:"handle"`
	LogoUrl          *string               `json:"logoUrl"`
	Description      string                `json:"description"`
	Country          string                `json:"country"`
	Currency         string                `json:"currency"`
	Timezone         string                `json:"timezone"`
	Locale           string                `json:"locale"`
	Phone            string                `json:"phone"`
	Email            string                `json:"email"`
	Address          string                `json:"address"`
	Taxes            []schema.StoreTaxRate `json:"taxes"`
	PricesIncludeTax bool                  `json:"pricesIncludeTax"`
	Policies         schema.StorePolicies  `json:"policies"`
	StoreRewards     StoreRewardsRulesView `json:"storeRewards"`
	Notifications    map[string]bool       `json:"notifications"`
}

type UpdateStoreSettingsRequest struct {
	Name             *string                `json:"name"`
	Description      *string                `json:"description"`
	Phone            *string                `json:"phone"`
	Email            *string                `json:"email"`
	Address          *string                `json:"address"`
	Taxes            *[]schema.StoreTaxRate `json:"taxes"`
	PricesIncludeTax *bool                  `json:"pricesIncludeTax"`
	Policies         *schema.StorePolicies  `json:"policies"`
	Notifications    *map[string]bool       `json:"notifications"`
}

type StorefrontFeaturedProductView struct {
	ProductId   string      `json:"productId"`
	Name        string      `json:"name"`
	ImageUrl    *string     `json:"imageUrl"`
	Price       money.Money `json:"price"`
	IsAvailable bool        `json:"isAvailable"`
}

type StorefrontView struct {
	StoreId          string                          `json:"storeId"`
	Name             string                          `json:"name"`
	Handle           string                          `json:"handle"`
	PublicUrl        string                          `json:"publicUrl"`
	LogoUrl          *string                         `json:"logoUrl"`
	CoverUrl         *string                         `json:"coverUrl"`
	Tagline          string                          `json:"tagline"`
	Description      string                          `json:"description"`
	Policies         schema.StorePolicies            `json:"policies"`
	OpeningHours     []schema.StoreOpeningHours      `json:"openingHours"`
	SocialLinks      map[string]*string              `json:"socialLinks"`
	FeaturedProducts []StorefrontFeaturedProductView `json:"featuredProducts"`
	DeliveryAreas    []string                        `json:"deliveryAreas"`
	FollowerCount    int                             `json:"followerCount"`
	AverageRating    *float64                        `json:"averageRating"`
	UpdatedAt        string                          `json:"updatedAt"`
}

type UpdateStorefrontRequest struct {
	Name               *string                     `json:"name"`
	Tagline            *string                     `json:"tagline"`
	Description        *string                     `json:"description"`
	LogoMediaId        NullableText                `json:"logoMediaId"`
	CoverMediaId       NullableText                `json:"coverMediaId"`
	Policies           *schema.StorePolicies       `json:"policies"`
	OpeningHours       *[]schema.StoreOpeningHours `json:"openingHours"`
	SocialLinks        *map[string]*string         `json:"socialLinks"`
	FeaturedProductIds *[]string                   `json:"featuredProductIds"`
}

var StorefrontWeekdays = []string{"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"}
var StorefrontSocialNetworks = []string{"instagram", "tiktok", "x", "whatsapp", "facebook", "website"}

type NullableText struct {
	Present bool
	Value   *string
}

func (text *NullableText) UnmarshalJSON(raw []byte) error {
	text.Present = true
	if string(raw) == "null" {
		text.Value = nil
		return nil
	}
	var value string
	if err := json.Unmarshal(raw, &value); err != nil {
		return err
	}
	text.Value = &value
	return nil
}
