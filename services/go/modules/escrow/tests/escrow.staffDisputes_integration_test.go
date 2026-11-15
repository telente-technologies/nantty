package escrow_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestOnlyTheBuyerAndSellerCanSeeAnEscrowOrTalkInItsDispute(t *testing.T) {
	harness := startEscrowHarness(t)
	buyer, orderId, otherOrder := uuid.NewString(), uuid.NewString(), uuid.NewString()
	harness.registerCheckout(buyer, map[string]int64{orderId: 400_000})
	harness.payAndSettle(buyer, orderId)
	stranger := harness.Tokens.UserAccessToken(uuid.NewString())
	buyerToken := harness.Tokens.UserAccessToken(buyer)
	if own := harness.Call(http.MethodGet, "/api/v1/orders/"+orderId+"/escrow", buyerToken, "", nil); own.Status != http.StatusOK {
		t.Fatalf("buyer escrow view: %d", own.Status)
	}
	if other := harness.Call(http.MethodGet, "/api/v1/orders/"+orderId+"/escrow", stranger, "", nil); other.Status != http.StatusNotFound {
		t.Fatalf("another buyer saw the escrow: %d", other.Status)
	}
	if opened := harness.Call(http.MethodPost, "/api/v1/orders/"+orderId+"/disputes", stranger, "stranger-dispute-1", map[string]any{"reason": "damaged", "description": "", "evidenceUrls": []string{}}); opened.Status != http.StatusNotFound {
		t.Fatalf("another buyer opened a dispute: %d", opened.Status)
	}
	opened := harness.Call(http.MethodPost, "/api/v1/orders/"+orderId+"/disputes", buyerToken, "owner-dispute-1", map[string]any{"reason": "not_received", "description": "Nothing came", "evidenceUrls": []string{}})
	if opened.Status != http.StatusCreated {
		t.Fatalf("open: %d %s", opened.Status, opened.Raw)
	}
	disputeId := opened.Body["id"].(string)
	otherSeller := harness.Tokens.UserAccessToken(sellerForOrder(otherOrder))
	for name, token := range map[string]string{"stranger": stranger, "other seller": otherSeller} {
		if view := harness.Call(http.MethodGet, "/api/v1/disputes/"+disputeId, token, "", nil); view.Status != http.StatusNotFound {
			t.Fatalf("%s read the dispute: %d", name, view.Status)
		}
		if posted := harness.Call(http.MethodPost, "/api/v1/disputes/"+disputeId+"/messages", token, "intruder-"+name[:5]+"-1", map[string]any{"text": "hello", "attachmentUrls": []string{}}); posted.Status != http.StatusNotFound {
			t.Fatalf("%s posted in the dispute: %d", name, posted.Status)
		}
		if closed := harness.Call(http.MethodPost, "/api/v1/disputes/"+disputeId+"/close", token, "", nil); closed.Status != http.StatusNotFound {
			t.Fatalf("%s closed the dispute: %d", name, closed.Status)
		}
	}
	if listed := harness.Call(http.MethodGet, "/api/v1/disputes", stranger, "", nil); len(listed.Body["data"].([]any)) != 0 {
		t.Fatalf("a stranger listed the dispute: %s", listed.Raw)
	}
	seller := harness.Tokens.UserAccessToken(sellerForOrder(orderId))
	if reply := harness.Call(http.MethodPost, "/api/v1/disputes/"+disputeId+"/messages", seller, "seller-reply-ok-1", map[string]any{"text": "Shipped on Monday", "attachmentUrls": []string{}}); reply.Status != http.StatusCreated {
		t.Fatalf("seller reply: %d %s", reply.Status, reply.Raw)
	}
}

func TestStaffDisputeViewHasPartiesEscrowSlaAndAcceptsTheConsoleResolveBody(t *testing.T) {
	harness := startEscrowHarness(t)
	harness.escrow.Application.Container.Settings.StaffReviewWindow = 48 * time.Hour
	buyer, orderId := uuid.NewString(), uuid.NewString()
	harness.registerCheckout(buyer, map[string]int64{orderId: 1_000_000})
	harness.payAndSettle(buyer, orderId)
	opened := harness.Call(http.MethodPost, "/api/v1/orders/"+orderId+"/disputes", harness.Tokens.UserAccessToken(buyer), "staff-view-dispute-1", map[string]any{"reason": "damaged", "description": "Torn", "evidenceUrls": []string{"https://cdn.nantty.test/a.jpg"}})
	disputeId, orderReference := opened.Body["id"].(string), opened.Body["orderReference"].(string)
	seller := harness.Tokens.UserAccessToken(sellerForOrder(orderId))
	harness.Call(http.MethodPost, "/api/v1/disputes/"+disputeId+"/messages", seller, "staff-view-reply-1", map[string]any{"text": "It left intact", "attachmentUrls": []string{}})
	staff := harness.Tokens.StaffTokens(uuid.NewString(), "money.disputes.resolve")
	if bad := harness.Call(http.MethodGet, "/api/v1/admin/disputes?status=bogus", staff.AccessToken, "", nil); bad.Status != http.StatusBadRequest {
		t.Fatalf("unknown status filter: %d", bad.Status)
	}
	list := harness.Call(http.MethodGet, "/api/v1/admin/disputes?status=open&search="+orderReference, staff.AccessToken, "", nil)
	rows := list.Body["data"].([]any)
	if list.Status != http.StatusOK || len(rows) != 1 || list.Body["counts"].(map[string]any)["under_review"].(float64) != 1 {
		t.Fatalf("staff list: %d %s", list.Status, list.Raw)
	}
	row := rows[0].(map[string]any)
	if row["orderNumber"] != orderReference || row["buyer"].(map[string]any)["id"] != buyer || row["slaDueAt"] == nil || row["priority"] != "normal" || row["escrowAmount"].(map[string]any)["amountMinor"].(float64) != 1_000_000 {
		t.Fatalf("staff row: %v", row)
	}
	if byBuyer := harness.Call(http.MethodGet, "/api/v1/admin/disputes?search="+buyer, staff.AccessToken, "", nil); len(byBuyer.Body["data"].([]any)) != 1 {
		t.Fatalf("search by buyer: %s", byBuyer.Raw)
	}
	detail := harness.Call(http.MethodGet, "/api/v1/admin/disputes/"+disputeId, staff.AccessToken, "", nil)
	escrowView := detail.Body["escrow"].(map[string]any)
	if detail.Status != http.StatusOK || detail.Body["sellerResponse"] != "It left intact" || detail.Body["commissionBasisPoints"].(float64) != 150 ||
		escrowView["heldAmount"].(map[string]any)["amountMinor"].(float64) != 1_000_000 || detail.Body["resolution"] != nil || len(detail.Body["history"].([]any)) < 2 {
		t.Fatalf("staff detail: %d %s", detail.Status, detail.Raw)
	}
	stepUp := staff.StepUp
	resolveUrl := "/api/v1/admin/disputes/" + disputeId + "/resolve"
	if wrongCurrency := harness.Call(http.MethodPost, resolveUrl, staff.AccessToken, "console-resolve-1", map[string]any{"outcome": "REFUND_PARTIAL", "refundAmount": map[string]any{"amountMinor": 250_000, "currency": "USD"}, "reason": "Partial refund for the tear"}, stepUp()); wrongCurrency.Status != http.StatusBadRequest {
		t.Fatalf("refund in the wrong currency: %d %s", wrongCurrency.Status, wrongCurrency.Raw)
	}
	if mixed := harness.Call(http.MethodPost, resolveUrl, staff.AccessToken, "console-resolve-2", map[string]any{"outcome": "REFUND_PARTIAL", "refundAmount": map[string]any{"amountMinor": 250_000, "currency": "NGN"}, "refundAmountMinor": 250_000, "reason": "Partial"}, stepUp()); mixed.Status != http.StatusBadRequest {
		t.Fatalf("both amount fields accepted: %d", mixed.Status)
	}
	resolved := harness.Call(http.MethodPost, resolveUrl, staff.AccessToken, "console-resolve-3", map[string]any{"outcome": "REFUND_PARTIAL", "refundAmount": map[string]any{"amountMinor": 250_000, "currency": "NGN"}, "reason": "Partial refund for the tear"}, stepUp())
	resolution, _ := resolved.Body["resolution"].(map[string]any)
	if resolved.Status != http.StatusOK || resolved.Body["status"] != "resolved_refunded" || resolution == nil || resolution["outcome"] != "partial" ||
		resolution["buyerRefund"].(map[string]any)["amountMinor"].(float64) != 250_000 || resolved.Body["escrow"].(map[string]any)["heldAmount"].(map[string]any)["amountMinor"].(float64) != 0 {
		t.Fatalf("console resolve: %d %s", resolved.Status, resolved.Raw)
	}
	payout, commission := resolution["sellerPayout"].(map[string]any)["amountMinor"].(float64), resolution["commission"].(map[string]any)["amountMinor"].(float64)
	if payout+commission+250_000+float64(processingFeeFor(1_000_000)) != 1_000_000 {
		t.Fatalf("resolution split does not add up: payout %v commission %v", payout, commission)
	}
	harness.AssertLedgerHealthy()
}

func TestOpenDisputesAreListedOldestFirstWithTheirWaitingAge(t *testing.T) {
	harness := startEscrowHarness(t)
	staff := harness.Tokens.StaffTokens(uuid.NewString(), "money.disputes.resolve")
	opened := []string{}
	for index := range 3 {
		buyer, orderId := uuid.NewString(), uuid.NewString()
		harness.registerCheckout(buyer, map[string]int64{orderId: 300_000})
		harness.payAndSettle(buyer, orderId)
		response := harness.Call(http.MethodPost, "/api/v1/orders/"+orderId+"/disputes", harness.Tokens.UserAccessToken(buyer), "queue-dispute-"+string(rune('a'+index)), map[string]any{"reason": "not_received", "description": "Nothing came", "evidenceUrls": []string{}})
		if response.Status != http.StatusCreated {
			t.Fatalf("open dispute: %d %s", response.Status, response.Raw)
		}
		opened = append(opened, response.Body["id"].(string))
	}
	queue := harness.Call(http.MethodGet, "/api/v1/admin/disputes?status=open&limit=2", staff.AccessToken, "", nil)
	rows := queue.Body["data"].([]any)
	if len(rows) != 2 || rows[0].(map[string]any)["id"] != opened[0] || rows[1].(map[string]any)["id"] != opened[1] {
		t.Fatalf("open disputes come oldest first: %s", queue.Raw)
	}
	if _, hasAge := rows[0].(map[string]any)["ageHours"].(float64); !hasAge {
		t.Fatalf("rows carry their waiting age: %v", rows[0])
	}
	next := harness.Call(http.MethodGet, "/api/v1/admin/disputes?status=open&limit=2&cursor="+queue.Body["nextCursor"].(string), staff.AccessToken, "", nil)
	if later := next.Body["data"].([]any); len(later) != 1 || later[0].(map[string]any)["id"] != opened[2] {
		t.Fatalf("the next page continues forward in time: %s", next.Raw)
	}
}
