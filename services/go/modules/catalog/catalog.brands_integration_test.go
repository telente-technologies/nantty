package catalog

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/databases/schema"
	"nantty/modules/catalog/src/generated/ent"
)

type fakeSigner struct{}

func (fakeSigner) SignedUrl(_ context.Context, mediaId, _, _ string) (string, time.Time, error) {
	return "https://private.nantty.test/" + mediaId, time.Now().Add(10 * time.Minute), nil
}

func TestBrandsCanBeCreatedFollowedAndShopped(t *testing.T) {
	harness := startHttpHarness(t)
	ownerId, owner := harness.account("brandowner")
	_, fan := harness.account("brandfan")
	categoryId := uuid.NewString()
	body := map[string]any{"name": "Kente Co", "handle": "@KenteCo", "logoUrl": nil, "coverUrl": nil, "categoryId": categoryId, "description": "Woven in Accra", "website": "https://kente.example.com"}
	harness.expect("POST", "/api/v1/brands", owner, body, 400)
	created := harness.expect("POST", "/api/v1/brands", owner, body, 201, "Idempotency-Key", "brand-000000001")
	if created["handle"] != "kenteco" || created["ownerUserId"] != ownerId.String() || created["followers"] != float64(0) || created["officialStore"] != nil {
		t.Fatalf("created: %v", created)
	}
	harness.expect("POST", "/api/v1/brands", owner, body, 409, "Idempotency-Key", "brand-000000002")
	brandId := created["id"].(string)
	path := "/api/v1/brands/" + brandId
	harness.expect("POST", path+"/follow", owner, nil, 409)
	harness.expect("POST", path+"/follow", fan, nil, 204)
	detail := harness.expect("GET", path, fan, nil, 200)
	if detail["followers"] != float64(1) || detail["isFollowing"] != true {
		t.Fatalf("detail: %v", detail)
	}
	if listed := items(harness.expect("GET", "/api/v1/brands?q=kente", "", nil, 200), "data"); len(listed) != 1 || listed[0].(map[string]any)["handle"] != "kenteco" {
		t.Fatalf("brand list: %v", listed)
	}

	official := harness.store(ownerId, "Kente Official")
	reseller := harness.store(uuid.New(), "Kente Reseller")
	ctx := context.Background()
	brand := harness.parseId(brandId)
	if err := harness.client().Store.UpdateOne(official).SetBrandID(brand).SetVerified(true).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	for _, shop := range []*ent.Store{official, reseller} {
		product := harness.product(shop, "Kente "+shop.Name, 2000, true)
		if err := harness.client().Product.UpdateOne(product).SetBrandID(brand).Exec(ctx); err != nil {
			t.Fatal(err)
		}
	}
	shelf := harness.expect("GET", path+"/products", "", nil, 200)
	if len(items(shelf, "officialStoreProducts")) != 0 || len(items(shelf, "otherSellersProducts")) != 2 {
		t.Fatalf("before approval every seller is an other seller: %v", shelf)
	}

	request, err := harness.client().BrandOfficialRequest.Create().SetBrandID(brand).SetSubmittedByAccountID(ownerId).SetCacCompanyName("Kente Co Limited").
		SetContactEmail("legal@kente.example.com").SetTrademark(schema.BrandTrademark{RegistrationNumber: "TM/2021/1234", RegisteredOwner: "Kente Co Ltd", ExpiresOn: time.Now().AddDate(2, 0, 0).Format("2006-01-02")}).
		SetDocuments([]schema.BrandRequestDocument{{Id: "doc-1", Kind: "TRADEMARK_CERTIFICATE", Label: "Certificate", MediaId: uuid.NewString(), UploadedAt: time.Now()}}).Save(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err := harness.client().Brand.UpdateOneID(brand).SetOfficialStatus("PENDING").Exec(ctx); err != nil {
		t.Fatal(err)
	}
	reviewer, _ := harness.staff("brands:review")
	revoker, stepUp := harness.staff("brands:revoke")
	queue := items(harness.expect("GET", "/api/v1/admin/brands?official=PENDING", reviewer, nil, 200), "data")
	if len(queue) != 1 || queue[0].(map[string]any)["officialRequestSubmittedAt"] == nil {
		t.Fatalf("admin queue: %v", queue)
	}
	adminDetail := harness.expect("GET", "/api/v1/admin/brands/"+brandId, reviewer, nil, 200)
	checks := items(adminDetail["officialRequest"].(map[string]any), "checks")
	if len(checks) != 5 || len(items(adminDetail, "allowedOfficialActions")) != 3 {
		t.Fatalf("admin detail: %v", adminDetail)
	}
	harness.module.Container.PrivateMedia = fakeSigner{}
	document := harness.expect("GET", "/api/v1/admin/brands/"+brandId+"/documents/doc-1", reviewer, nil, 200)
	if document["url"] == "" || document["watermarkText"] == "" || !harness.audit.has("brand.document_viewed") {
		t.Fatalf("document: %v", document)
	}
	harness.expect("POST", "/api/v1/admin/brands/"+brandId+"/official-status/revoke", revoker, map[string]any{"reason": "Not official yet"}, 409, stepUp...)
	approved := harness.expect("POST", "/api/v1/admin/brands/"+brandId+"/official-status/approve", reviewer, map[string]any{"reason": "Trademark verified"}, 200)
	if approved["officialStatus"] != "OFFICIAL" || len(items(approved, "linkedStores")) != 1 || !items(approved, "linkedStores")[0].(map[string]any)["hasOfficialBadge"].(bool) {
		t.Fatalf("approved: %v", approved)
	}
	harness.expect("POST", "/api/v1/admin/brands/"+brandId+"/official-status/approve", reviewer, map[string]any{"reason": "Again please"}, 409)
	if public := harness.expect("GET", path, "", nil, 200); public["officialStoreId"] != official.ID.String() {
		t.Fatalf("public official store: %v", public)
	}
	if shelf := harness.expect("GET", path+"/products", "", nil, 200); len(items(shelf, "officialStoreProducts")) != 1 || len(items(shelf, "otherSellersProducts")) != 1 {
		t.Fatalf("approved shelf: %v", shelf)
	}
	harness.expect("POST", "/api/v1/admin/brands/"+brandId+"/official-status/revoke", revoker, map[string]any{"reason": "Licence withdrawn"}, 403)
	revoked := harness.expect("POST", "/api/v1/admin/brands/"+brandId+"/official-status/revoke", revoker, map[string]any{"reason": "Licence withdrawn"}, 200, stepUp...)
	if revoked["officialStatus"] != "REVOKED" || items(revoked, "linkedStores")[0].(map[string]any)["hasOfficialBadge"] != false {
		t.Fatalf("revoked: %v", revoked)
	}
	if request.ID == uuid.Nil {
		t.Fatal("request id")
	}
	shelf = harness.expect("GET", path+"/products", "", nil, 200)
	if len(items(shelf, "officialStoreProducts")) != 0 {
		t.Fatalf("revoked brands have no official shelf: %v", shelf)
	}
}
