package services

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/databases/schema"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/modules/storeSettings/dtos"
	"nantty/platform/commerceports"
	"nantty/platform/money"
)

func NotificationPreferencesWithDefaults(saved map[string]bool) map[string]bool {
	preferences := map[string]bool{}
	for _, key := range dtos.NotificationPreferenceKeys {
		preferences[key] = key == "newOrderEmail" || key == "payoutEmail" || key == "disputeEmail"
	}
	for key, value := range saved {
		if _, known := preferences[key]; known {
			preferences[key] = value
		}
	}
	return preferences
}

func TaxRatesOrEmpty(rates []schema.StoreTaxRate) []schema.StoreTaxRate {
	if rates == nil {
		return []schema.StoreTaxRate{}
	}
	return rates
}

func PresentStoreSettings(ctx context.Context, row *ent.Store) (dtos.StoreSettingsView, error) {
	currency := money.CurrencyCode(row.Currency)
	rewards := dtos.StoreRewardsRulesView{MinimumOrder: money.Money{Currency: currency}, MaxPerOrder: money.Money{Currency: currency}, ExpiryDays: 180}
	if reader, err := commerceports.Default.StoreRewardRulesReader(); err == nil {
		rules, readError := reader.RewardRulesForStore(ctx, row.ID)
		if readError != nil {
			return dtos.StoreSettingsView{}, readError
		}
		rewards = dtos.StoreRewardsRulesView{Enabled: rules.Enabled, PercentBackBasisPoints: rules.PercentBackBasisPoints, ExpiryDays: rules.ExpiryDays,
			MinimumOrder: money.Money{AmountMinor: rules.MinimumOrderMinor, Currency: currency}, MaxPerOrder: money.Money{AmountMinor: rules.MaxPerOrderMinor, Currency: currency}}
	}
	return dtos.StoreSettingsView{
		StoreId: row.ID.String(), Name: row.Name, Handle: row.Slug, LogoUrl: row.LogoURL, Description: row.Description, Country: row.CountryCode,
		Currency: row.Currency, Timezone: row.Timezone, Locale: row.Locale, Phone: row.ContactPhone, Email: row.ContactEmail, Address: row.ContactAddress,
		Taxes: TaxRatesOrEmpty(row.TaxRates), PricesIncludeTax: row.PricesIncludeTax, Policies: row.Policies, StoreRewards: rewards,
		Notifications: NotificationPreferencesWithDefaults(row.NotificationPreferences),
	}, nil
}

func DefaultOpeningHours() []schema.StoreOpeningHours {
	hours := make([]schema.StoreOpeningHours, 0, len(dtos.StorefrontWeekdays))
	for _, weekday := range dtos.StorefrontWeekdays {
		hours = append(hours, schema.StoreOpeningHours{Weekday: weekday, IsOpen: weekday != "sunday", OpensAt: "09:00", ClosesAt: "18:00"})
	}
	return hours
}

func PresentStorefront(row *ent.Store, featured []dtos.StorefrontFeaturedProductView, deliveryAreas []string, publicBaseUrl string) dtos.StorefrontView {
	links := map[string]*string{}
	for _, network := range dtos.StorefrontSocialNetworks {
		if value, found := row.SocialLinks[network]; found && value != "" {
			copied := value
			links[network] = &copied
		} else {
			links[network] = nil
		}
	}
	hours := row.OpeningHours
	if len(hours) == 0 {
		hours = DefaultOpeningHours()
	}
	var rating *float64
	if row.RatingCount > 0 {
		average := float64(row.RatingSum) / float64(row.RatingCount)
		rating = &average
	}
	if deliveryAreas == nil {
		deliveryAreas = []string{}
	}
	return dtos.StorefrontView{
		StoreId: row.ID.String(), Name: row.Name, Handle: row.Slug, PublicUrl: strings.TrimRight(publicBaseUrl, "/") + "/store/" + row.ID.String(),
		LogoUrl: row.LogoURL, CoverUrl: row.BannerURL, Tagline: row.Tagline, Description: row.Description, Policies: row.Policies,
		OpeningHours: hours, SocialLinks: links, FeaturedProducts: featured, DeliveryAreas: deliveryAreas, AverageRating: rating,
		UpdatedAt: row.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

func MediaUrlFor(deployed *container.Container, mediaId string) string {
	return strings.TrimRight(deployed.Settings.MediaPublicBaseUrl, "/") + "/m/" + mediaId + "/display.jpg"
}

func ParseIdentifierList(values []string) []uuid.UUID {
	parsed := make([]uuid.UUID, 0, len(values))
	for _, value := range values {
		if identifier, err := uuid.Parse(value); err == nil {
			parsed = append(parsed, identifier)
		}
	}
	return parsed
}
