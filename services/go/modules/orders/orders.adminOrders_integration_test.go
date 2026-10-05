package orders

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"

	"zudomart/modules/orders/src"
	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/databases/schema"
	"zudomart/modules/orders/src/generated/ent/outboxevent"
	"zudomart/modules/orders/src/generated/ent/refundrecord"
	"zudomart/modules/orders/src/services"
	"zudomart/platform/identityports/identitytest"
	"zudomart/platform/jwtauth"
	"zudomart/platform/staffauth"
)

type adminHarness struct {
	t      *testing.T
	module *src.Module
	mux    *http.ServeMux
	tokens *identitytest.FakeTokenService
}

func startAdminHarness(t *testing.T, escrowStatus string) *adminHarness {
	tokens := identitytest.NewFakeTokenService(t)
	verifier := func(audience string) *jwtauth.AccessTokenVerifier {
		return jwtauth.NewAccessTokenVerifierFromKeySetProvider(tokens.PublishedKeySet, identitytest.FakeIssuer, audience)
	}
	module := startAgainstFreshSchemaWith(t, src.Collaborators{Money: fakeEscrowMoney{status: escrowStatus}, Verifier: verifier(identitytest.FakeAccountAudience),
		Staff: container.StaffVerifiers{Access: verifier(staffauth.AccessAudience), StepUp: verifier(staffauth.StepUpAudience)}})
	mux := http.NewServeMux()
	module.MountRoutes(mux)
	return &adminHarness{t: t, module: module, mux: mux, tokens: tokens}
}

func (harness *adminHarness) seedOrder(reference, status string) uuid.UUID {
	group, err := harness.module.Container.Client.OrderGroup.Create().SetCheckoutID(uuid.New()).SetReference(reference).SetInvoiceNumber("INV-" + reference).SetStoreID(uuid.New()).
		SetSellerAccountID(uuid.New()).SetBuyerAccountID(uuid.New()).SetBuyerName("Ada").SetBuyerUsername("ada").SetCurrency("NGN").SetSubtotalMinor(300_000).SetShippingMinor(0).
		SetTotalMinor(300_000).SetStatus(status).SetPaymentStatus("paid").SetAddress(schema.AddressSnapshot{RecipientName: "Ada", Phone: "+2348000000000", Line1: "1 Marina", CountryCode: "NG", CityName: "Ikeja"}).
		Save(context.Background())
	if err != nil {
		harness.t.Fatal(err)
	}
	return group.ID
}

func (harness *adminHarness) call(method, path string, body any, headers map[string]string) (int, map[string]any, http.Header) {
	var payload bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&payload).Encode(body)
	}
	request := httptest.NewRequest(method, path, &payload)
	for name, value := range headers {
		request.Header.Set(name, value)
	}
	recorder := httptest.NewRecorder()
	harness.mux.ServeHTTP(recorder, request)
	decoded := map[string]any{}
	_ = json.Unmarshal(recorder.Body.Bytes(), &decoded)
	return recorder.Code, decoded, recorder.Header()
}

func bearer(token string, extra map[string]string) map[string]string {
	headers := map[string]string{"Authorization": "Bearer " + token}
	for name, value := range extra {
		headers[name] = value
	}
	return headers
}

func TestAdminOrdersListAndDetailNeedAnOrdersPermission(t *testing.T) {
	harness := startAdminHarness(t, "held")
	orderId := harness.seedOrder("ZM-ADM-0001", "processing")
	harness.seedOrder("ZM-ADM-0002", "completed")
	reader, _, _ := harness.tokens.SignStaffTokensForTest(t, "admin", []string{"support:tickets"})
	outsider, _, _ := harness.tokens.SignStaffTokensForTest(t, "admin", []string{"ads:review"})
	if status, _, _ := harness.call("GET", "/api/v1/admin/orders", nil, nil); status != http.StatusUnauthorized {
		t.Fatalf("anonymous: %d", status)
	}
	if status, _, _ := harness.call("GET", "/api/v1/admin/orders", nil, bearer(outsider, nil)); status != http.StatusForbidden {
		t.Fatalf("staff without an orders permission: %d", status)
	}
	status, page, _ := harness.call("GET", "/api/v1/admin/orders?limit=1", nil, bearer(reader, nil))
	if status != http.StatusOK || len(page["data"].([]any)) != 1 || page["nextCursor"] == nil {
		t.Fatalf("first page: %d %v", status, page)
	}
	status, page, _ = harness.call("GET", "/api/v1/admin/orders?search=zm-adm-0001", nil, bearer(reader, nil))
	if status != http.StatusOK || len(page["data"].([]any)) != 1 || page["data"].([]any)[0].(map[string]any)["escrowStatus"] != "held" {
		t.Fatalf("search by order number: %d %v", status, page)
	}
	if status, _, _ := harness.call("GET", "/api/v1/admin/orders?status=bogus", nil, bearer(reader, nil)); status != http.StatusBadRequest {
		t.Fatalf("unknown status filter: %d", status)
	}
	for _, key := range []string{orderId.String(), "ZM-ADM-0001"} {
		status, detail, _ := harness.call("GET", "/api/v1/admin/orders/"+key, nil, bearer(reader, nil))
		if status != http.StatusOK || detail["id"] != orderId.String() || detail["refundable"].(map[string]any)["amountMinor"].(float64) != 300_000 {
			t.Fatalf("detail by %s: %d %v", key, status, detail)
		}
	}
	if status, body, _ := harness.call("GET", "/api/v1/admin/orders/ZM-NOPE", nil, bearer(reader, nil)); status != http.StatusNotFound || body["code"] != "ORDER_NOT_FOUND" {
		t.Fatalf("missing order: %d %v", status, body)
	}
}

func TestAdminRefundIsSteppedUpIdempotentAndSettledByTheEscrowEvent(t *testing.T) {
	harness := startAdminHarness(t, "held")
	orderId := harness.seedOrder("ZM-ADM-0010", "shipped")
	access, stepUp, _ := harness.tokens.SignStaffTokensForTest(t, "admin", []string{"refunds:issue"})
	body := map[string]any{"orderId": orderId.String(), "amount": map[string]any{"amountMinor": 100_000, "currency": "NGN"}, "reason": "One item arrived damaged"}
	keyed := map[string]string{"Idempotency-Key": "refund-key-0001"}
	if status, response, _ := harness.call("POST", "/api/v1/admin/refunds", body, bearer(access, map[string]string{staffauth.StepUpHeader: stepUp})); status != http.StatusBadRequest || response["code"] != "IDEMPOTENCY_KEY_REQUIRED" {
		t.Fatalf("missing key: %d %v", status, response)
	}
	if status, response, _ := harness.call("POST", "/api/v1/admin/refunds", body, bearer(access, keyed)); status != http.StatusForbidden || response["code"] != "STEP_UP_REQUIRED" {
		t.Fatalf("missing step-up: %d %v", status, response)
	}
	steppedUp := map[string]string{"Idempotency-Key": "refund-key-0001", staffauth.StepUpHeader: stepUp}
	wrongCurrency := map[string]any{"orderId": orderId.String(), "amount": map[string]any{"amountMinor": 100_000, "currency": "USD"}, "reason": "One item arrived damaged"}
	if status, _, _ := harness.call("POST", "/api/v1/admin/refunds", wrongCurrency, bearer(access, map[string]string{"Idempotency-Key": "refund-key-0000", staffauth.StepUpHeader: stepUp})); status != http.StatusBadRequest {
		t.Fatalf("currency must match the order: %d", status)
	}
	status, created, _ := harness.call("POST", "/api/v1/admin/refunds", body, bearer(access, steppedUp))
	if status != http.StatusCreated || created["source"] != "manual" || created["status"] != "processing" {
		t.Fatalf("issue: %d %v", status, created)
	}
	status, replayed, headers := harness.call("POST", "/api/v1/admin/refunds", body, bearer(access, steppedUp))
	if status != http.StatusCreated || replayed["id"] != created["id"] || headers.Get("Idempotent-Replayed") != "true" {
		t.Fatalf("replay: %d %v %v", status, replayed, headers)
	}
	changed := map[string]any{"orderId": orderId.String(), "amount": map[string]any{"amountMinor": 50_000, "currency": "NGN"}, "reason": "One item arrived damaged"}
	if status, response, _ := harness.call("POST", "/api/v1/admin/refunds", changed, bearer(access, steppedUp)); status != http.StatusUnprocessableEntity || response["code"] != "IDEMPOTENCY_KEY_REUSED" {
		t.Fatalf("reused key: %d %v", status, response)
	}
	other := map[string]string{"Idempotency-Key": "refund-key-0002", staffauth.StepUpHeader: stepUp}
	if status, response, _ := harness.call("POST", "/api/v1/admin/refunds", changed, bearer(access, other)); status != http.StatusConflict || response["code"] != "REFUND_IN_PROGRESS" {
		t.Fatalf("second refund while the first is on its way: %d %v", status, response)
	}
	ctx := context.Background()
	requested, _ := harness.module.Container.Client.OutboxEvent.Query().Where(outboxevent.EventType("orderGroup.refundRequested")).Count(ctx)
	if requested != 1 {
		t.Fatalf("refund requests sent to escrow: %d", requested)
	}
	if err := services.RecordOrderRefund(ctx, harness.module.Container, orderId, 100_000, ""); err != nil {
		t.Fatal(err)
	}
	record := harness.module.Container.Client.RefundRecord.Query().Where(refundrecord.OrderGroupID(orderId)).OnlyX(ctx)
	if record.Status != "completed" || record.CompletedAt == nil {
		t.Fatalf("record after the escrow event: %+v", record)
	}
	status, page, _ := harness.call("GET", "/api/v1/admin/refunds?source=manual", nil, bearer(access, nil))
	if status != http.StatusOK || len(page["data"].([]any)) != 1 {
		t.Fatalf("refund list: %d %v", status, page)
	}
}

func TestAdminRefundWaitsForAnOpenDispute(t *testing.T) {
	harness := startAdminHarness(t, "disputed")
	orderId := harness.seedOrder("ZM-ADM-0020", "disputed")
	access, stepUp, _ := harness.tokens.SignStaffTokensForTest(t, "admin", []string{"refunds:issue"})
	body := map[string]any{"orderId": orderId.String(), "amount": map[string]any{"amountMinor": 300_000, "currency": "NGN"}, "reason": "Buyer never got it"}
	status, response, _ := harness.call("POST", "/api/v1/admin/refunds", body, bearer(access, map[string]string{"Idempotency-Key": "refund-key-0100", staffauth.StepUpHeader: stepUp}))
	if status != http.StatusConflict || response["code"] != "DISPUTE_OPEN" {
		t.Fatalf("disputed order: %d %v", status, response)
	}
}

func TestDisputeEscrowRefundIsRecordedAsADisputeRefund(t *testing.T) {
	harness := startAdminHarness(t, "held")
	orderId := harness.seedOrder("ZM-ADM-0030", "delivered")
	ctx := context.Background()
	if err := services.RecordOrderRefund(ctx, harness.module.Container, orderId, 300_000, uuid.NewString()); err != nil {
		t.Fatal(err)
	}
	record := harness.module.Container.Client.RefundRecord.Query().Where(refundrecord.OrderGroupID(orderId)).OnlyX(ctx)
	if record.Source != "dispute" || record.AmountMinor != 300_000 || record.Status != "completed" {
		t.Fatalf("dispute refund record: %+v", record)
	}
}

func TestSellerDisputeReplyWithoutIdempotencyKeyIsABadRequest(t *testing.T) {
	harness := startAdminHarness(t, "held")
	token := harness.tokens.SignAccountAccessToken(t, uuid.NewString())
	status, response, _ := harness.call("POST", "/api/v1/seller/disputes/"+uuid.NewString()+"/responses", map[string]any{"body": "We shipped it"}, bearer(token, nil))
	if status != http.StatusBadRequest || response["code"] != "IDEMPOTENCY_KEY_REQUIRED" {
		t.Fatalf("reply without a key: %d %v", status, response)
	}
}
