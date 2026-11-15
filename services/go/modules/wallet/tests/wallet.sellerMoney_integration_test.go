package wallet_test

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	escrowent "nantty/modules/escrow/src/generated/ent"
	escrowschema "nantty/modules/escrow/src/generated/ent/escrow"
	escrowmigrations "nantty/modules/escrow/src/migrations"
	"nantty/modules/ledger/src/databases"
	moneytesting "nantty/modules/ledger/src/databases/moneyTesting"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
)

func sellerHeaders(storeId string) http.Header {
	return http.Header{"X-Internal-Token": {strings.Repeat("w", 32)}, "X-Seller-Store-Id": {storeId}, "X-Store-Currency": {"NGN"},
		"X-Store-Country": {"NG"}, "X-Store-Timezone": {"Africa/Lagos"}, "X-Store-Name": {"Ada Fabrics"}}
}

func steppedUp(headers http.Header) http.Header {
	copied := headers.Clone()
	copied.Set("X-Step-Up-Token-Digest", strings.ReplaceAll(uuid.NewString()+uuid.NewString(), "-", ""))
	return copied
}

func TestSellerWalletViewsPayoutAccountsAndPayoutsThroughTheInternalApi(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test: needs Postgres")
	}
	harness := startWalletHarness(t, true)
	seller, storeId := uuid.NewString(), uuid.NewString()
	prefix := "/api/v1/internal/sellers/" + seller
	headers := sellerHeaders(storeId)
	if denied := harness.Call(http.MethodGet, prefix+"/wallet/balances", "", "", nil, http.Header{"X-Internal-Token": {"wrong-token-wrong-token-wrong-token"}}); denied.Status != http.StatusUnauthorized {
		t.Fatalf("internal routes need the token: %d", denied.Status)
	}
	harness.OnboardConnectedAccount(seller, false)
	walletRef := harness.WalletRef(seller)
	harness.post(ledgermodels.JournalEntryRequest{Reference: "seed-seller-" + seller, Kind: "escrow.released", Description: "Escrow released for ZM-1001", Lines: []ledgermodels.JournalLineRequest{
		{Account: ledgermodels.ProviderWalletMirrorAccount("flutterwave", walletRef, "NGN"), Direction: ledgermodels.Debit, AmountMinor: 500_000},
		{Account: ledgermodels.WalletAvailableAccount(seller, "NGN"), Direction: ledgermodels.Credit, AmountMinor: 500_000},
	}})
	harness.Flutterwave.CreditWalletWithoutFee(walletRef, 500_000, "seed-seller-"+seller)
	balances := harness.Call(http.MethodGet, prefix+"/wallet/balances", "", "", nil, headers)
	if balances.Status != http.StatusOK || balances.Body["available"].(map[string]any)["amountMinor"].(float64) != 500_000 {
		t.Fatalf("balances: %d %s", balances.Status, balances.Raw)
	}
	transactions := harness.Call(http.MethodGet, prefix+"/wallet/transactions?kind=escrow_release", "", "", nil, headers)
	rows := transactions.Body["data"].([]any)
	if len(rows) != 1 || rows[0].(map[string]any)["direction"] != "credit" || rows[0].(map[string]any)["balanceBucket"] != "available" {
		t.Fatalf("transactions: %s", transactions.Raw)
	}
	if bad := harness.Call(http.MethodPost, prefix+"/wallet/payout-accounts/resolve", "", "", map[string]any{"bankCode": "058", "accountNumber": "12345"}, headers); bad.Status != http.StatusBadRequest {
		t.Fatalf("a short NUBAN must fail validation: %d", bad.Status)
	}
	resolved := harness.Call(http.MethodPost, prefix+"/wallet/payout-accounts/resolve", "", "", map[string]any{"bankCode": "058", "accountNumber": "0123454821"}, headers)
	if resolved.Status != http.StatusOK || resolved.Body["accountNumberMasked"] != "******4821" || strings.Contains(string(resolved.Raw), "0123454821") {
		t.Fatalf("resolve: %d %s", resolved.Status, resolved.Raw)
	}
	resolution := map[string]any{"resolutionId": resolved.Body["resolutionId"]}
	if unconfirmed := harness.Call(http.MethodPost, prefix+"/wallet/payout-accounts", "", "", resolution, headers); unconfirmed.Status != http.StatusForbidden || unconfirmed.Body["code"] != "STEP_UP_REQUIRED" {
		t.Fatalf("adding a payout account needs the relayed step-up: %d %s", unconfirmed.Status, unconfirmed.Raw)
	}
	confirmed := steppedUp(headers)
	added := harness.Call(http.MethodPost, prefix+"/wallet/payout-accounts", "", "", resolution, confirmed)
	if added.Status != http.StatusCreated || added.Body["isDefault"] != true {
		t.Fatalf("add: %d %s", added.Status, added.Raw)
	}
	if replayed := harness.Call(http.MethodPost, prefix+"/wallet/payout-accounts", "", "", resolution, confirmed); replayed.Status != http.StatusUnauthorized || replayed.Body["code"] != "STEP_UP_REUSED" {
		t.Fatalf("a relayed step-up is single use: %d %s", replayed.Status, replayed.Raw)
	}
	if reused := harness.Call(http.MethodPost, prefix+"/wallet/payout-accounts", "", "", resolution, steppedUp(headers)); reused.Status != http.StatusUnprocessableEntity || reused.Body["code"] != "RESOLUTION_EXPIRED" {
		t.Fatalf("a resolution is single use: %d %s", reused.Status, reused.Raw)
	}
	accountId := added.Body["id"].(string)
	if missingKey := harness.Call(http.MethodPost, prefix+"/wallet/payouts", "", "", map[string]any{"amountMinor": 100_000, "accountId": accountId}, steppedUp(headers)); missingKey.Status != http.StatusBadRequest {
		t.Fatalf("payouts need an idempotency key: %d", missingKey.Status)
	}
	payout := harness.Call(http.MethodPost, prefix+"/wallet/payouts", "", "payout-key-0001", map[string]any{"amountMinor": 100_000, "accountId": accountId}, steppedUp(headers))
	if payout.Status != http.StatusCreated || payout.Body["amount"].(map[string]any)["amountMinor"].(float64) != 100_000 || payout.Body["status"] != "processing" {
		t.Fatalf("payout: %d %s", payout.Status, payout.Raw)
	}
	replay := harness.Call(http.MethodPost, prefix+"/wallet/payouts", "", "payout-key-0001", map[string]any{"amountMinor": 100_000, "accountId": accountId}, steppedUp(headers))
	if replay.Body["id"] != payout.Body["id"] {
		t.Fatalf("a replay must return the same payout: %s", replay.Raw)
	}
	fee := int64(payout.Body["fee"].(map[string]any)["amountMinor"].(float64))
	if harness.balance(ledgermodels.WalletAvailableAccount(seller, "NGN")) != 500_000-100_000-fee {
		t.Fatal("the fee is charged on top of the payout amount")
	}
	if tooMuch := harness.Call(http.MethodPost, prefix+"/wallet/payouts", "", "payout-key-0002", map[string]any{"amountMinor": 900_000, "accountId": accountId}, steppedUp(headers)); tooMuch.Body["code"] != "INSUFFICIENT_AVAILABLE_BALANCE" {
		t.Fatalf("overdraw: %d %s", tooMuch.Status, tooMuch.Raw)
	}
	if busy := harness.Call(http.MethodDelete, prefix+"/wallet/payout-accounts/"+accountId, "", "", nil, steppedUp(headers)); busy.Body["code"] != "PAYOUT_IN_PROGRESS" {
		t.Fatalf("remove during payout: %d %s", busy.Status, busy.Raw)
	}
	schedule := harness.Call(http.MethodPut, prefix+"/wallet/payouts/schedule", "", "", map[string]any{"mode": "weekly", "weekday": 5, "dayOfMonth": 1, "keepMinimumBalanceMinor": 10_000, "accountId": accountId}, headers)
	if schedule.Status != http.StatusOK || schedule.Body["nextRunAt"] == nil {
		t.Fatalf("schedule: %d %s", schedule.Status, schedule.Raw)
	}
	settings := harness.Call(http.MethodGet, prefix+"/wallet/payout-settings", "", "", nil, headers)
	if settings.Body["schedule"] != "Every Friday at 09:00" {
		t.Fatalf("payout settings: %s", settings.Raw)
	}
	statement := harness.Call(http.MethodGet, prefix+"/finance/statements/"+time.Now().In(time.FixedZone("WAT", 3600)).Format("2006-01"), "", "", nil, headers)
	if statement.Status != http.StatusOK || statement.Body["summary"].(map[string]any)["credits"].(map[string]any)["amountMinor"].(float64) != 500_000 {
		t.Fatalf("statement: %d %s", statement.Status, statement.Raw)
	}
	harness.AssertLedgerHealthy()
}

func TestSellerFinanceGroupsReleasedEscrowIntoWeeklySettlements(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test: needs Postgres")
	}
	harness := startWalletHarness(t, true)
	escrowSchema := moneytesting.CreateFreshSchemaWithMigrations(t, harness.Database, "escrow", escrowmigrations.Files)
	harness.wallet.Payouts.Container.Settings.EscrowSchema = escrowSchema
	harness.wallet.Sellers.Finance.Escrows.Container.Settings.EscrowSchema = escrowSchema
	seller, storeId := uuid.NewString(), uuid.NewString()
	client := escrowent.NewClient(escrowent.Driver(databases.EntDriverForExecutor(harness.Database)), escrowent.AlternateSchema(escrowent.SchemaConfig{Escrow: escrowSchema}))
	released := time.Now().Add(-10 * 24 * time.Hour)
	for index, status := range []string{"released", "held", "refunded"} {
		create := client.Escrow.Create().SetOrderID(uuid.NewString()).SetOrderReference("ZM-200" + string(rune('1'+index))).SetCheckoutID(uuid.NewString()).
			SetPaymentIntentID(uuid.New()).SetPaymentReference("ref-" + uuid.NewString()[:8]).SetProvider("flutterwave").SetBuyerUserID(uuid.NewString()).
			SetStoreID(storeId).SetSellerUserID(seller).SetAmountMinor(100_000).SetCurrency("NGN").SetCommissionBps(150).SetCommissionMinor(1_500).
			SetSellerAmountMinor(97_000).SetProcessingFeeMinor(1_500).SetStatus(escrowStatus(status))
		switch status {
		case "released":
			create.SetReleasedAt(released).SetReleasedToSellerMinor(97_000)
		case "held":
			create.SetAutoReleaseAt(time.Now().Add(48 * time.Hour))
		case "refunded":
			create.SetRefundedMinor(100_000).SetRefundedAt(time.Now())
		}
		if err := create.Exec(context.Background()); err != nil {
			t.Fatal(err)
		}
	}
	prefix := "/api/v1/internal/sellers/" + seller
	headers := sellerHeaders(storeId)
	escrow := harness.Call(http.MethodGet, prefix+"/finance/escrow?status=held", "", "", nil, headers)
	if escrow.Status != http.StatusOK || len(escrow.Body["data"].([]any)) != 1 || escrow.Body["countsByStatus"].(map[string]any)["released"].(float64) != 1 {
		t.Fatalf("escrow: %d %s", escrow.Status, escrow.Raw)
	}
	settlements := harness.Call(http.MethodGet, prefix+"/finance/settlements", "", "", nil, headers)
	list := settlements.Body["data"].([]any)
	if len(list) != 1 || list[0].(map[string]any)["status"] != "settled" || list[0].(map[string]any)["net"].(map[string]any)["amountMinor"].(float64) != 97_000 {
		t.Fatalf("settlements: %s", settlements.Raw)
	}
	detail := harness.Call(http.MethodGet, prefix+"/finance/settlements/"+list[0].(map[string]any)["id"].(string), "", "", nil, headers)
	if len(detail.Body["orders"].([]any)) != 1 {
		t.Fatalf("settlement detail: %s", detail.Raw)
	}
	fees := harness.Call(http.MethodGet, prefix+"/finance/fees?from="+released.AddDate(0, 0, -1).Format("2006-01-02"), "", "", nil, headers)
	if len(fees.Body["lines"].([]any)) != 5 || fees.Body["lines"].([]any)[0].(map[string]any)["amount"].(map[string]any)["amountMinor"].(float64) != 3_000 {
		t.Fatalf("fees: %s", fees.Raw)
	}
	refunds := harness.Call(http.MethodGet, prefix+"/finance/refunds", "", "", nil, headers)
	if len(refunds.Body["data"].([]any)) != 1 || refunds.Body["data"].([]any)[0].(map[string]any)["kind"] != "cancelled_before_shipping" {
		t.Fatalf("refunds: %s", refunds.Raw)
	}
	summary := harness.Call(http.MethodGet, prefix+"/finance/summary", "", "", nil, headers)
	if summary.Status != http.StatusOK || len(summary.Body["upcomingReleases"].([]any)) != 1 || summary.Body["refunds"].(map[string]any)["amountMinor"].(float64) != 100_000 {
		t.Fatalf("summary: %d %s", summary.Status, summary.Raw)
	}
	if other := harness.Call(http.MethodGet, prefix+"/finance/escrow", "", "", nil, sellerHeaders(uuid.NewString())); len(other.Body["data"].([]any)) != 0 {
		t.Fatal("finance views are scoped to the store")
	}
}

func escrowStatus(status string) escrowschema.Status {
	return escrowschema.Status(status)
}
