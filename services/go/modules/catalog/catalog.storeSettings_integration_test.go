package catalog

import (
	"context"
	"strings"
	"testing"

	"zudomart/modules/catalog/src/databases/schema"
	updatestoresettings "zudomart/modules/catalog/src/modules/storeSettings/commands/updateStoreSettings"
	updatestorefront "zudomart/modules/catalog/src/modules/storeSettings/commands/updateStorefront"
	"zudomart/modules/catalog/src/modules/storeSettings/dtos"
	getstoresettings "zudomart/modules/catalog/src/modules/storeSettings/queries/getStoreSettings"
	settingsservices "zudomart/modules/catalog/src/modules/storeSettings/services"
	listauditlog "zudomart/modules/catalog/src/modules/storeTeam/queries/listAuditLog"
	"zudomart/modules/catalog/src/services"
	"zudomart/platform/httpserver"
)

func TestStoreSettingsAndStorefrontSaveMergeAndAudit(t *testing.T) {
	fixture := startTeamFixture(t)
	ctx := context.Background()
	deployed := fixture.module.Container
	owner := services.StoreActor{AccountId: fixture.ownerId, Name: "Adaowner", Role: "owner", IpAddress: "203.0.113.9"}

	initial, err := getstoresettings.Handler{Container: deployed}.Execute(ctx, getstoresettings.Query{Store: fixture.ownerAccess()})
	if err != nil || initial.Currency != "NGN" || len(initial.Notifications) != len(dtos.NotificationPreferenceKeys) || !initial.Notifications["newOrderEmail"] || initial.Taxes == nil {
		t.Fatalf("defaults: %+v %v", initial, err)
	}
	unknownCategory := []schema.StoreTaxRate{{Id: "vat", Name: "VAT", RateBasisPoints: 750, IsDefault: true}, {Id: "food", Name: "Food", RateBasisPoints: 0, AppliesToCategoryIds: []string{"0192a4f0-0000-7000-8000-000000000000"}}}
	_, err = updatestoresettings.Handler{Container: deployed}.Execute(ctx, updatestoresettings.Command{Store: fixture.ownerAccess(), Actor: owner, Request: dtos.UpdateStoreSettingsRequest{Taxes: &unknownCategory}})
	var apiError *httpserver.ApiError
	if !asApiError(err, &apiError) || apiError.Code != "VALIDATION_FAILED" {
		t.Fatalf("unknown tax category must fail validation, got %v", err)
	}
	taxes := unknownCategory[:1]
	saved, err := updatestoresettings.Handler{Container: deployed}.Execute(ctx, updatestoresettings.Command{Store: fixture.ownerAccess(), Actor: owner, Request: dtos.UpdateStoreSettingsRequest{
		Phone: pointer("+2348012345678"), Taxes: &taxes, Notifications: &map[string]bool{"reviewEmail": true},
		Policies: &schema.StorePolicies{Returns: "Returns within 7 days."},
	}})
	if err != nil || saved.Phone != "+2348012345678" || len(saved.Taxes) != 1 || !saved.Notifications["reviewEmail"] || !saved.Notifications["newOrderEmail"] || saved.Policies.Returns == "" {
		t.Fatalf("saved: %+v %v", saved, err)
	}

	hours := settingsservices.DefaultOpeningHours()
	front, err := updatestorefront.Handler{Container: deployed}.Execute(ctx, updatestorefront.Command{Store: fixture.ownerAccess(), Actor: owner, Request: dtos.UpdateStorefrontRequest{
		Tagline: pointer("Hand-dyed adire"), LogoMediaId: dtos.NullableText{Present: true, Value: pointer("media123")}, OpeningHours: &hours,
		SocialLinks: &map[string]*string{"instagram": pointer("@adafabrics"), "website": nil}, FeaturedProductIds: &[]string{},
	}})
	if err != nil || front.Tagline != "Hand-dyed adire" || front.LogoUrl == nil || !strings.HasSuffix(*front.LogoUrl, "/m/media123/display.jpg") || *front.SocialLinks["instagram"] != "@adafabrics" || front.SocialLinks["website"] != nil {
		t.Fatalf("storefront: %+v %v", front, err)
	}
	if len(front.OpeningHours) != 7 || !strings.Contains(front.PublicUrl, fixture.store.ID.String()) {
		t.Fatalf("storefront shape: %+v", front)
	}

	log, _ := listauditlog.Handler{Container: deployed}.Execute(ctx, listauditlog.Query{Store: fixture.ownerAccess(), Limit: 10})
	if len(log.Data) != 2 || log.Data[0].Action != "storefront.updated" || log.Data[1].Action != "settings.updated" || *log.Data[1].IpAddress != "203.0.113.9" {
		t.Fatalf("audit: %+v", log.Data)
	}
}

func asApiError(err error, target **httpserver.ApiError) bool {
	apiError, ok := err.(*httpserver.ApiError)
	if ok {
		*target = apiError
	}
	return ok
}
