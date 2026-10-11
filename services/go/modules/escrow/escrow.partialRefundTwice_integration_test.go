package escrow

import (
	"net/http"
	"strings"
	"testing"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"

	"github.com/google/uuid"
)

func refundRowsForOrder(t *testing.T, harness *escrowHarness, reference string) (int, int64) {
	t.Helper()
	var count int
	var total int64
	schema := harness.Payments.Application.Container.Settings.Money.DatabaseSchema
	err := harness.Database.QueryRow(`SELECT count(*), coalesce(sum(r.amount_minor),0) FROM "`+schema+`".payment_refunds r JOIN "`+schema+`".payment_intents i ON i.id = r.payment_intent_id WHERE i.reference = $1`, reference).Scan(&count, &total)
	if err != nil {
		t.Fatal(err)
	}
	return count, total
}

func TestSecondDistinctPartialRefundIsRejectedAndMovesNoMoney(t *testing.T) {
	harness := startEscrowHarness(t)
	buyer, orderId := uuid.NewString(), uuid.NewString()
	harness.registerCheckout(buyer, map[string]int64{orderId: 300_000})
	reference := harness.payAndSettle(buyer, orderId)
	internal := http.Header{"X-Internal-Token": {strings.Repeat("e", 32)}}
	call := func(amount int64, reason string) int {
		request := map[string]any{"orderGroupId": orderId, "storeId": "store-1", "buyerAccountId": buyer, "amountMinor": amount, "currency": "NGN", "reason": reason}
		return harness.Call(http.MethodPost, "/api/v1/internal/order-groups/"+orderId+"/refunds", "", "", request, internal).Status
	}
	if status := call(100_000, "first item damaged"); status != http.StatusOK {
		t.Fatalf("first partial refund: %d", status)
	}
	request := map[string]any{"orderGroupId": orderId, "storeId": "store-1", "buyerAccountId": buyer, "amountMinor": 50_000, "currency": "NGN", "reason": "second item damaged"}
	second := harness.Call(http.MethodPost, "/api/v1/internal/order-groups/"+orderId+"/refunds", "", "", request, internal)
	if second.Status != http.StatusConflict || second.Body["code"] != "ESCROW_ALREADY_PARTIALLY_REFUNDED" {
		t.Fatalf("a second distinct partial refund must be refused: %d %s", second.Status, second.Raw)
	}
	if status := call(100_000, "replay of the first amount"); status != http.StatusOK {
		t.Fatalf("a replay of the same partial amount stays idempotent: %d", status)
	}
	if count, _ := refundRowsForOrder(t, harness, reference); count != 0 || harness.balance(ledgermodels.WalletAvailableAccount(buyer, "NGN")) != 100_000 {
		t.Fatalf("money must move once, inside the buyer's wallet: %d card refunds, balances %v", count, harness.NonZeroBalances())
	}
	harness.AssertLedgerHealthy()
}
