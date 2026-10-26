package catalog

import (
	"context"
	"testing"

	"nantty/modules/catalog/src/generated/ent/category"
)

func applicationBody(categoryId string) map[string]any {
	return map[string]any{
		"storeName": "Ada Fabrics", "categoryId": categoryId, "description": "Handmade ankara", "phone": "+234 801 234 5678",
		"addressLine": "12 Allen Avenue", "city": "Ikeja", "state": "Lagos",
		"identityDocument": map[string]any{"documentType": "nin_slip", "documentNumber": "12345678901", "documentPhotoUrl": "https://media.zudomart.com/kyc/nin.jpg"},
		"payoutAccount":    map[string]any{"bankCode": "058", "accountNumber": "0123456789"},
	}
}

func TestSellerApplicationsAreSubmittedOnceAndReviewedByStaff(t *testing.T) {
	harness := startHttpHarness(t)
	_, applicant := harness.account("wouldbeseller")
	fashion, err := harness.client().Category.Query().Where(category.StoreIDIsNil(), category.Slug("fashion")).Only(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	reviewer, _ := harness.staff("applications:sellers")
	outsider, _ := harness.staff("catalog:manage")
	key := []string{"Idempotency-Key", "apply-0000000001"}

	if mine := harness.expect("GET", "/api/v1/seller/applications/me", applicant, nil, 200); len(mine) != 0 {
		t.Fatalf("no application yet should be null: %v", mine)
	}
	harness.expect("POST", "/api/v1/seller/applications", applicant, applicationBody(fashion.ID.String()), 400)
	invalid := applicationBody(fashion.ID.String())
	invalid["payoutAccount"] = map[string]any{"bankCode": "058", "accountNumber": "12"}
	harness.expect("POST", "/api/v1/seller/applications", applicant, invalid, 400, key...)
	submitted := harness.expect("POST", "/api/v1/seller/applications", applicant, applicationBody(fashion.ID.String()), 201, key...)
	if submitted["status"] != "pending" || submitted["payoutAccountNumberMasked"] != "******6789" || submitted["identityDocumentNumberMasked"] != "******8901" || submitted["categoryName"] != "Fashion" {
		t.Fatalf("submitted: %v", submitted)
	}
	replayed := harness.expect("POST", "/api/v1/seller/applications", applicant, applicationBody(fashion.ID.String()), 201, key...)
	if replayed["id"] != submitted["id"] {
		t.Fatal("the same Idempotency-Key replays the application")
	}
	harness.expect("POST", "/api/v1/seller/applications", applicant, applicationBody(fashion.ID.String()), 409, "Idempotency-Key", "apply-0000000002")

	harness.expect("GET", "/api/v1/admin/applications/sellers", outsider, nil, 403)
	queue := items(harness.expect("GET", "/api/v1/admin/applications/sellers?status=PENDING", reviewer, nil, 200), "data")
	if len(queue) != 1 {
		t.Fatalf("queue: %v", queue)
	}
	entry := queue[0].(map[string]any)
	if entry["kind"] != "sellers" || entry["status"] != "PENDING" || entry["isEligible"] != true || len(items(entry, "eligibility")) != 4 {
		t.Fatalf("program application: %v", entry)
	}
	path := "/api/v1/admin/applications/sellers/" + submitted["id"].(string)
	harness.expect("POST", path+"/approve", reviewer, map[string]any{"reason": "ok"}, 400)
	approved := harness.expect("POST", path+"/approve", reviewer, map[string]any{"reason": "Documents look good"}, 200)
	if approved["status"] != "APPROVED" || approved["decisionReason"] != "Documents look good" || len(items(approved, "history")) != 1 {
		t.Fatalf("approved: %v", approved)
	}
	harness.expect("POST", path+"/reject", reviewer, map[string]any{"reason": "Changed my mind"}, 409)
	harness.expect("POST", "/api/v1/seller/applications", applicant, applicationBody(fashion.ID.String()), 409, "Idempotency-Key", "apply-0000000003")
	mine := harness.expect("GET", "/api/v1/seller/applications/me", applicant, nil, 200)
	if mine["status"] != "approved" || mine["reviewedAt"] == nil {
		t.Fatalf("mine after approval: %v", mine)
	}
	events := harness.outboxTypes()
	if !contains(events, "sellerApplication.submitted") || !contains(events, "sellerApplication.reviewed") || !harness.audit.has("seller_application.approved") {
		t.Fatalf("events: %v", events)
	}
	stored, _ := harness.client().SellerApplication.Get(context.Background(), harness.parseId(submitted["id"]))
	if string(stored.PayoutAccountNumberSealed) == "0123456789" || len(stored.PayoutAccountNumberSealed) < 20 {
		t.Fatal("the account number must be sealed at rest")
	}
}
