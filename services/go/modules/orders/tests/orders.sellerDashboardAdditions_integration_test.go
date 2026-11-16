package orders_test

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/databases/schema"
	ordererrors "nantty/modules/orders/src/errors"
	savecustomersegment "nantty/modules/orders/src/modules/customerSegments/commands/saveCustomerSegment"
	segmentdtos "nantty/modules/orders/src/modules/customerSegments/dtos"
	listcustomersegments "nantty/modules/orders/src/modules/customerSegments/queries/listCustomerSegments"
	savecustomerprofile "nantty/modules/orders/src/modules/customers/commands/saveCustomerProfile"
	customerdtos "nantty/modules/orders/src/modules/customers/dtos"
	deletedeliveryarea "nantty/modules/orders/src/modules/deliveryAreas/commands/deleteDeliveryArea"
	savedeliveryarea "nantty/modules/orders/src/modules/deliveryAreas/commands/saveDeliveryArea"
	areadtos "nantty/modules/orders/src/modules/deliveryAreas/dtos"
	deliveryareaservices "nantty/modules/orders/src/modules/deliveryAreas/services"
	getmarketingoverview "nantty/modules/orders/src/modules/marketingOverview/queries/getMarketingOverview"
	getanalyticsoverview "nantty/modules/orders/src/modules/sellerInsights/queries/getAnalyticsOverview"
	getsellerdashboard "nantty/modules/orders/src/modules/sellerInsights/queries/getSellerDashboard"
	insightservices "nantty/modules/orders/src/modules/sellerInsights/services"
	"nantty/modules/orders/src/services"
	"nantty/platform/commerceports"
)

func pointerTo[Value any](value Value) *Value { return &value }

func TestEveryOrdersRouteRegistersWithoutConflicts(t *testing.T) {
	module := startAgainstFreshSchema(t)
	module.MountRoutes(http.NewServeMux())
}

func TestDeliveryAreasMergeValidateAndStayInTheirStore(t *testing.T) {
	module := startAgainstFreshSchema(t)
	ctx := context.Background()
	store := commerceports.StoreAccess{StoreId: uuid.New(), Currency: "NGN", Role: "owner"}
	save := savedeliveryarea.Handler{Container: module.Container}
	input := areadtos.DeliveryAreaInput{Name: pointerTo("Lekki"), State: pointerTo("Lagos"), Cities: &[]string{"Lekki", " Ajah "}, FeeMinor: pointerTo(int64(150_000)),
		EstimatedDaysMin: pointerTo(1), EstimatedDaysMax: pointerTo(2), Active: pointerTo(true)}
	area, err := save.Execute(ctx, savedeliveryarea.Command{Store: store, Input: input})
	if err != nil || area.Fee.AmountMinor != 150_000 || area.Fee.Currency != "NGN" || area.Cities[1] != "Ajah" {
		t.Fatalf("create: %+v %v", area, err)
	}
	areaId := uuid.MustParse(area.Id)
	if _, err := save.Execute(ctx, savedeliveryarea.Command{Store: store, AreaId: &areaId, Input: areadtos.DeliveryAreaInput{EstimatedDaysMin: pointerTo(5)}}); err == nil {
		t.Fatal("a merged area whose minimum is above its maximum must fail")
	}
	updated, err := save.Execute(ctx, savedeliveryarea.Command{Store: store, AreaId: &areaId, Input: areadtos.DeliveryAreaInput{EstimatedDaysMax: pointerTo(4), Active: pointerTo(false)}})
	if err != nil || updated.EstimatedDaysMax != 4 || updated.Name != "Lekki" || updated.Active {
		t.Fatalf("patch: %+v %v", updated, err)
	}
	other := commerceports.StoreAccess{StoreId: uuid.New(), Currency: "NGN"}
	if err := (deletedeliveryarea.Handler{Container: module.Container}).Execute(ctx, deletedeliveryarea.Command{Store: other, AreaId: areaId}); !errors.Is(err, ordererrors.DeliveryAreaNotFound) {
		t.Fatalf("another store must not delete it: %v", err)
	}
	names, _ := deliveryareaservices.DeliveryAreaNames{Container: module.Container}.DeliveryAreaNamesForStore(ctx, store.StoreId)
	if len(names) != 0 {
		t.Fatalf("inactive areas are not shown on the storefront: %v", names)
	}
}

func TestManualCustomersMergeWithAppBuyersAndFeedSegments(t *testing.T) {
	module := startAgainstFreshSchema(t)
	ctx := context.Background()
	store := commerceports.StoreAccess{StoreId: uuid.New(), Currency: "NGN", Role: "owner"}
	buyer := uuid.New()
	for index := 0; index < 2; index++ {
		_, err := module.Container.Client.OrderGroup.Create().SetCheckoutID(uuid.New()).SetReference("ZM-CUS-000" + string(rune('1'+index))).SetInvoiceNumber("INV-CUS-000" + string(rune('1'+index))).
			SetStoreID(store.StoreId).SetSellerAccountID(uuid.New()).SetBuyerAccountID(buyer).SetBuyerName("Kemi").SetBuyerUsername("kemi").SetPaymentStatus("paid").SetStatus("completed").
			SetCurrency("NGN").SetSubtotalMinor(200_000).SetShippingMinor(0).SetTotalMinor(200_000).
			SetAddress(schema.AddressSnapshot{RecipientName: "Kemi", Phone: "+2348011111111", Line1: "1 Marina", CountryCode: "NG", CityName: "Ikeja"}).Save(ctx)
		if err != nil {
			t.Fatal(err)
		}
	}
	save := savecustomerprofile.Handler{Container: module.Container}
	manual, err := save.Execute(ctx, savecustomerprofile.Command{Store: store, Input: customerdtos.CustomerProfileInput{Name: pointerTo("Bayo Walk-in"), Phone: pointerTo("08022222222"), Tags: &[]string{"Wholesale", "wholesale"}}})
	if err != nil || manual.PurchasesCount != 0 || len(manual.Tags) != 1 || manual.Tags[0] != "wholesale" {
		t.Fatalf("manual customer: %+v %v", manual, err)
	}
	var exists savecustomerprofile.CustomerExistsError
	if _, err := save.Execute(ctx, savecustomerprofile.Command{Store: store, Input: customerdtos.CustomerProfileInput{Name: pointerTo("Kemi again"), Phone: pointerTo("08011111111")}}); !errors.As(err, &exists) || exists.Customer.Id != buyer.String() {
		t.Fatalf("a phone that matches an app buyer is a duplicate: %v", err)
	}
	updated, err := save.Execute(ctx, savecustomerprofile.Command{Store: store, CustomerId: &buyer, Input: customerdtos.CustomerProfileInput{Tags: &[]string{"vip"}, MarketingOptIn: pointerTo(true)}})
	if err != nil || updated.PurchasesCount != 2 || updated.Name != "Kemi" || !updated.MarketingOptIn {
		t.Fatalf("buyer overlay: %+v %v", updated, err)
	}
	segment, err := savecustomersegment.Handler{Container: module.Container}.Execute(ctx, savecustomersegment.Command{Store: store, Changes: segmentdtos.CustomerSegmentChanges{
		Name: pointerTo("Opted-in VIPs"), Description: pointerTo(""), Rules: &[]schema.CustomerSegmentRule{{Field: "tag", Operator: "equals", Value: "vip"}, {Field: "purchases_count", Operator: "at_least", Value: float64(2)}},
	}})
	if err != nil || segment.CustomerCount != 1 {
		t.Fatalf("segment: %+v %v", segment, err)
	}
	all, _ := listcustomersegments.Handler{Container: module.Container}.Execute(ctx, listcustomersegments.Query{Store: store})
	if len(all.Data) != 5 || all.Data[0].Id != "seg_new" || all.Data[1].CustomerCount != 1 {
		t.Fatalf("segments: %+v", all.Data)
	}
	customers, _ := services.LoadStoreCustomers(ctx, module.Container, store.StoreId, store.Currency)
	if len(customers) != 2 {
		t.Fatalf("customers: %+v", customers)
	}
}

func TestDashboardAndAnalyticsLoadFromAFreshStore(t *testing.T) {
	module := startAgainstFreshSchema(t)
	ctx := context.Background()
	store := commerceports.StoreAccess{StoreId: uuid.New(), OwnerAccountId: uuid.New(), Currency: "NGN", Role: "inventory", Timezone: "Africa/Lagos"}
	dashboard, err := getsellerdashboard.Handler{Container: module.Container}.Execute(ctx, getsellerdashboard.Query{Store: store, ActorId: uuid.New()})
	if err != nil || len(dashboard.DailyRevenue) != 30 || len(dashboard.OrdersByStatus) != 10 || string(dashboard.Balances) != "null" || len(dashboard.Alerts) != 0 {
		t.Fatalf("dashboard: %+v %v", dashboard, err)
	}
	now := module.Container.Now()
	window := insightservices.AnalyticsRange{From: now.AddDate(0, 0, -6), Until: now.AddDate(0, 0, 1), RequestedFrom: now.AddDate(0, 0, -6)}
	overview, err := getanalyticsoverview.Handler{Container: module.Container}.Execute(ctx, getanalyticsoverview.Query{Store: store, Window: window})
	if err != nil || overview.Bucket != "day" || len(overview.Series) == 0 {
		t.Fatalf("overview: %+v %v", overview, err)
	}
}

func TestMarketingOverviewCountsCodeRedemptions(t *testing.T) {
	module := startAgainstFreshSchema(t)
	ctx := context.Background()
	store := commerceports.StoreAccess{StoreId: uuid.New(), Currency: "NGN"}
	code := "WELCOME10"
	promotionRow, err := module.Container.Client.Promotion.Create().SetStoreID(store.StoreId).SetName("Welcome").SetKind("code").SetCode(code).SetDiscountKind("percent").
		SetDiscountValue(1000).SetStartsAt(module.Container.Now().Add(-time.Hour)).Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err := module.Container.Client.PromotionRedemption.Create().SetPromotionID(promotionRow.ID).SetOrderGroupID(uuid.New()).SetBuyerAccountID(uuid.New()).SetDiscountMinor(5_000).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	overview, err := getmarketingoverview.Handler{Container: module.Container}.Execute(ctx, getmarketingoverview.Query{Store: store})
	if err != nil || overview.ActiveCampaigns != 1 || overview.RedemptionsLast30Days != 1 || overview.DiscountGivenLast30Days.AmountMinor != 5_000 || overview.Campaigns[0].Kind != "discount_code" {
		t.Fatalf("overview: %+v %v", overview, err)
	}
}
