package services_test

import (
	"encoding/json"
	"nantty/modules/subscriptions/src/modules/billing/services"
	"testing"
)

func TestVerificationPlanViewPreservesStoreCheckoutDetails(t *testing.T) {
	productID := "com.nantty.app.seller_business.monthly"
	view := services.BuildVerificationPlanView(services.PlanView{
		Id: "seller_business_monthly", PlanCode: "seller_business", Tier: "BUSINESS", Interval: "month",
		Channel: "ios", StoreProductId: &productID, DisplayName: "Gold Premium", Price: map[string]any{"amountMinor": int64(3_900_000), "currency": "NGN"},
	})
	encoded, err := json.Marshal(view)
	if err != nil {
		t.Fatal(err)
	}
	var result map[string]any
	if err := json.Unmarshal(encoded, &result); err != nil {
		t.Fatal(err)
	}
	if result["channel"] != "ios" || result["storeProductId"] != productID || result["planCode"] != "seller_business" {
		t.Fatalf("verification plan omitted native store purchase metadata: %s", encoded)
	}
}
