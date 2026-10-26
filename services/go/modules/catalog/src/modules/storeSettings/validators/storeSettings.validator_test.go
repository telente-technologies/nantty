package validators

import (
	"strings"
	"testing"

	"nantty/modules/catalog/src/databases/schema"
	"nantty/modules/catalog/src/modules/storeSettings/dtos"
	"nantty/platform/httpserver"
)

func TestSettingsValidationRejectsBadTaxesContactsAndUnknownNotifications(t *testing.T) {
	text := func(value string) *string { return &value }
	cases := map[string]dtos.UpdateStoreSettingsRequest{
		"taxes":                     {Taxes: &[]schema.StoreTaxRate{{Id: "a", Name: "A", RateBasisPoints: 100}, {Id: "b", Name: "B", RateBasisPoints: 200}}},
		"taxes.0.rateBasisPoints":   {Taxes: &[]schema.StoreTaxRate{{Id: "a", Name: "A", RateBasisPoints: 10001, IsDefault: true}}},
		"taxes.1.id":                {Taxes: &[]schema.StoreTaxRate{{Id: "a", Name: "A", IsDefault: true}, {Id: "a", Name: "B", AppliesToCategoryIds: []string{"0192a4f0-0000-7000-8000-000000000000"}}}},
		"phone":                     {Phone: text("call me")},
		"email":                     {Email: text("not-an-email")},
		"notifications.smokeSignal": {Notifications: &map[string]bool{"smokeSignal": true}},
		"policies.returns":          {Policies: &schema.StorePolicies{Returns: strings.Repeat("x", 2001)}},
	}
	for path, request := range cases {
		err := ValidateUpdateStoreSettings(request)
		if err == nil || !strings.Contains(err.Error()+describe(err), path) {
			t.Errorf("%s: want an issue at that path, got %v", path, err)
		}
	}
	if err := ValidateUpdateStoreSettings(dtos.UpdateStoreSettingsRequest{Phone: text("+234 801 234 5678"), Email: text("shop@ada.ng")}); err != nil {
		t.Fatalf("valid contacts rejected: %v", err)
	}
}

func TestStorefrontValidationChecksHoursLinksAndFeaturedProducts(t *testing.T) {
	link := func(value string) *string { return &value }
	shortWeek := []schema.StoreOpeningHours{{Weekday: "monday", IsOpen: true, OpensAt: "09:00", ClosesAt: "17:00"}}
	if err := ValidateUpdateStorefront(dtos.UpdateStorefrontRequest{OpeningHours: &shortWeek}); err == nil {
		t.Fatal("a week needs seven days")
	}
	if err := ValidateUpdateStorefront(dtos.UpdateStorefrontRequest{SocialLinks: &map[string]*string{"website": link("http://ada.ng")}}); err == nil {
		t.Fatal("websites must be https")
	}
	if err := ValidateUpdateStorefront(dtos.UpdateStorefrontRequest{SocialLinks: &map[string]*string{"myspace": link("ada")}}); err == nil {
		t.Fatal("unknown networks are rejected")
	}
	repeated := []string{"0192a4f0-0000-7000-8000-000000000000", "0192a4f0-0000-7000-8000-000000000000"}
	if err := ValidateUpdateStorefront(dtos.UpdateStorefrontRequest{FeaturedProductIds: &repeated}); err == nil {
		t.Fatal("featured products must not repeat")
	}
	if err := ValidateUpdateStorefront(dtos.UpdateStorefrontRequest{LogoMediaId: dtos.NullableText{Present: true, Value: link("../etc")}}); err == nil {
		t.Fatal("media ids are restricted")
	}
}

func describe(err error) string {
	apiError, ok := err.(*httpserver.ApiError)
	if !ok {
		return ""
	}
	paths := []string{}
	for _, issue := range apiError.Issues {
		paths = append(paths, issue.Path)
	}
	return strings.Join(paths, ",")
}
