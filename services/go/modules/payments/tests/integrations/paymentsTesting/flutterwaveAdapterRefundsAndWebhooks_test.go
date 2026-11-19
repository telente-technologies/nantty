package paymentstesting_test

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"nantty/modules/payments/src/integrations"
	"nantty/modules/payments/src/integrations/paymentsTesting"
	"nantty/modules/payments/src/interfaces"
)

func TestFlutterwavePayoutSubaccountRefundsUseTheDocumentedEnvelopeAndReferences(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	wallet, err := adapter.CreateWallet(context.Background(), interfaces.WalletOwner{AccountName: "A B", AliasEmail: "u+a@wallets.nantty.com"})
	if err != nil {
		t.Fatal(err)
	}
	fake.FundWallet(wallet.AccountRef, "NGN", 12_550, "PSA_FUNDING-501")
	request, err := adapter.ReverseFunding(context.Background(), "PSA_FUNDING-501", "NGN")
	if err != nil || request.Outcome != interfaces.OutcomePending || !strings.HasPrefix(request.ProviderRefundId, "REV-") {
		t.Fatalf("initial NEW response must remain pending and return the provider reversal reference: %v %+v", err, request)
	}

	fake.Reversals = []map[string]any{
		{"id": 501, "reference": "RVSL-501", "narration": "Refund for: FUNDING-501", "status": "SUCCESSFUL", "amount": 125.50, "currency": "NGN", "account_number": "8000000001"},
		{"id": 503, "reference": "RVSL-503", "narration": "Refund for: FUNDING-503", "status": "SUCCESSFUL", "amount": 50, "currency": "NGN", "account_number": "8000000003"},
		{"id": 502, "reference": "RVSL-502", "narration": "Refund for: FUNDING-502", "status": "PENDING", "amount": 88, "currency": "NGN", "account_number": "8000000002"},
		{"id": 504, "reference": "RVSL-504", "narration": "Refund for: FUNDING-504", "status": "FAILED", "amount": 25, "currency": "NGN", "account_number": "8000000004"},
	}

	reversals, err := adapter.ListFundingReversals(context.Background(), time.Now().Add(-24*time.Hour), time.Now())
	if err != nil || len(reversals) != 4 {
		t.Fatalf("documented data.transfers response across pages: %v %+v", err, reversals)
	}
	if reversals[0].FundingReference != "FUNDING-501" || reversals[0].ProviderReversalReference != "RVSL-501" || reversals[0].AmountMinor != 12_550 || reversals[0].Outcome != interfaces.OutcomeSucceeded {
		t.Fatalf("first reversal must separate the original funding ref from the provider reversal ref: %+v", reversals[0])
	}
	if reversals[1].FundingReference != "FUNDING-503" || reversals[1].ProviderReversalReference != "RVSL-503" {
		t.Fatalf("second success-page reversal: %+v", reversals[1])
	}
	if reversals[2].FundingReference != "FUNDING-502" || reversals[2].ProviderReversalReference != "RVSL-502" || reversals[2].Outcome != interfaces.OutcomePending {
		t.Fatalf("pending reversal must remain pending and preserve both references: %+v", reversals[2])
	}
	if reversals[3].FundingReference != "FUNDING-504" || reversals[3].ProviderReversalReference != "RVSL-504" || reversals[3].Outcome != interfaces.OutcomeFailed {
		t.Fatalf("failed reversal must be returned for hold recovery: %+v", reversals[3])
	}
	listCalls := 0
	for _, request := range fake.RequestLog() {
		if request == "GET /v3/payout-subaccounts/refunds" {
			listCalls++
		}
	}
	if listCalls != 4 {
		t.Fatalf("all three documented statuses and the second success page require four list reads, got %d", listCalls)
	}
}

func TestFlutterwavePayoutSubaccountRefundListingFailsClosedOnInvalidPagination(t *testing.T) {
	for _, test := range []struct {
		name  string
		setup func(*paymentstesting.FakeFlutterwave)
	}{
		{name: "missing page metadata", setup: func(fake *paymentstesting.FakeFlutterwave) { fake.OmitReversalPageInfo = true }},
		{name: "provider ignores page query", setup: func(fake *paymentstesting.FakeFlutterwave) { fake.IgnoreReversalPage = true }},
	} {
		t.Run(test.name, func(t *testing.T) {
			fake, adapter := newFakeFlutterwaveAdapter(t)
			fake.Reversals = []map[string]any{
				{"id": 601, "reference": "RVSL-601", "narration": "Refund for: FUNDING-601", "status": "SUCCESSFUL", "amount": 1, "currency": "NGN"},
				{"id": 602, "reference": "RVSL-602", "narration": "Refund for: FUNDING-602", "status": "SUCCESSFUL", "amount": 2, "currency": "NGN"},
			}
			test.setup(fake)
			if reversals, err := adapter.ListFundingReversals(context.Background(), time.Now().Add(-24*time.Hour), time.Now()); err == nil || reversals != nil {
				t.Fatalf("invalid or ignored pagination must not look like complete history: %v %+v", err, reversals)
			}
		})
	}
}

func TestFlutterwavePayoutSubaccountOperationsRejectUnsupportedCurrencies(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	ctx := context.Background()
	if _, err := adapter.ListFundingAccounts(ctx, "PSA-1", "GHS"); !errors.Is(err, interfaces.ErrCurrencyNotSupported) {
		t.Fatalf("non-NGN payout subaccount virtual account should be rejected: %v", err)
	}
	if _, err := adapter.ReadWalletBalance(ctx, "PSA-1", "GHS"); !errors.Is(err, interfaces.ErrCurrencyNotSupported) {
		t.Fatalf("non-NGN payout subaccount balance should be rejected: %v", err)
	}
	if _, err := adapter.ReverseFunding(ctx, "PSA_FUNDING-1", "GHS"); !errors.Is(err, interfaces.ErrCurrencyNotSupported) {
		t.Fatalf("non-NGN payout subaccount reversal should be rejected: %v", err)
	}
	if calls := len(fake.RequestLog()); calls != 0 {
		t.Fatalf("unsupported currency requests must fail before provider I/O, got %d requests", calls)
	}
}

func TestFlutterwaveReadsRetry429AndParseGroupedAmounts(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	ctx := context.Background()
	wallet, _ := adapter.CreateWallet(ctx, interfaces.WalletOwner{AccountName: "A B", AliasEmail: "u+a@wallets.nantty.com"})
	fake.FundWallet(wallet.AccountRef, "NGN", 123_456_789, "PSA_GROUPED")
	fake.SetRateLimitedRequests(2)
	lines, err := adapter.ListWalletTransactions(ctx, wallet.AccountRef, time.Now().Add(-time.Hour), time.Now())
	if err != nil || len(lines) != 2 || lines[0].AmountMinor != 123_456_789 || lines[1].Direction != "debit" {
		t.Fatalf("grouped amounts after 429s: %v %+v", err, lines)
	}
	balance, err := adapter.ReadWalletBalance(ctx, wallet.AccountRef, "NGN")
	if err != nil || balance.AvailableMinor != 123_456_789-5_000 {
		t.Fatalf("balance: %v %+v", err, balance)
	}
}

func TestFlutterwaveListsEveryWalletStatementPage(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	wallet, err := adapter.CreateWallet(context.Background(), interfaces.WalletOwner{AccountName: "A B", AliasEmail: "u+pages@wallets.nantty.com"})
	if err != nil {
		t.Fatal(err)
	}
	fake.FundingFeeMinor = 0
	for index := 0; index < 21; index++ {
		fake.FundWallet(wallet.AccountRef, "NGN", 1_000, fmt.Sprintf("PSA_PAGE_%02d", index))
	}

	lines, err := adapter.ListWalletTransactions(context.Background(), wallet.AccountRef, time.Now().Add(-time.Hour), time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if len(lines) != 21 {
		t.Fatalf("all statement rows must be read across three provider pages: got %d", len(lines))
	}
	for index, line := range lines {
		if line.Reference != fmt.Sprintf("PSA_PAGE_%02d", index) {
			t.Fatalf("statement row %d was missing or reordered: %+v", index, line)
		}
	}
}

func TestFlutterwaveListsEverySettlementAndChargebackPage(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	for index := 0; index < 21; index++ {
		fake.Settlements = append(fake.Settlements, map[string]any{
			"id": index + 1, "status": "completed", "currency": "NGN", "net_amount": 100,
			"settlement_date": "2026-11-19T12:00:00Z",
		})
	}
	settlements, err := adapter.ListSettlements(context.Background(), "", time.Now().Add(-time.Hour), time.Now())
	if err != nil || len(settlements) != 21 {
		t.Fatalf("settlements across provider pages: %v count=%d", err, len(settlements))
	}

	for index := 0; index < 41; index++ {
		fake.Chargebacks = append(fake.Chargebacks, map[string]any{
			"id": index + 1, "amount": 100, "currency": "NGN", "tx_ref": fmt.Sprintf("TX-%d", index),
			"transaction_id": index + 1, "status": "initiated",
		})
	}
	disputes, err := adapter.ListOpenDisputes(context.Background())
	if err != nil || len(disputes) != 41 {
		t.Fatalf("chargebacks across provider pages: %v count=%d", err, len(disputes))
	}
}

func TestFlutterwaveWebhookHashIsOnlyATrigger(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	body, headers := paymentstesting.SignedFlutterwaveWebhook("charge.completed", map[string]any{"id": 9, "tx_ref": "chk-1", "amount": 10, "currency": "NGN", "status": "successful"})
	notification, err := adapter.VerifyWebhookSignatureAndParse(body, headers)
	if err != nil || notification.Kind != interfaces.WebhookKindCharge || notification.Reference != "chk-1" || notification.ProviderChargeId != "9" {
		t.Fatalf("charge webhook: %v %+v", err, notification)
	}
	forged := http.Header{integrations.FlutterwaveSignatureHeader: {paymentstesting.FakeFlutterwaveWebhookHash + "x"}}
	if _, err := adapter.VerifyWebhookSignatureAndParse(body, forged); !errors.Is(err, interfaces.ErrInvalidWebhookSignature) {
		t.Fatalf("a wrong hash must be rejected: %v", err)
	}
	wallet, _ := adapter.CreateWallet(context.Background(), interfaces.WalletOwner{AccountName: "A B", AliasEmail: "u+w@wallets.nantty.com"})
	fundingBody, fundingHeaders := fake.FundWalletAndSignWebhook(wallet.AccountRef, 50_000, "PSA_X1", 0)
	funding, err := adapter.VerifyWebhookSignatureAndParse(fundingBody, fundingHeaders)
	if err != nil || funding.Kind != interfaces.WebhookKindWalletFunding || funding.Reference != "PSA_X1" || funding.AccountNumber == "" {
		t.Fatalf("funding webhook: %v %+v", err, funding)
	}
	refund, err := adapter.VerifyWebhookSignatureAndParse([]byte(`{"id":77,"AmountRefunded":10,"status":"completed","FlwRef":"F","TransactionId":9}`), headers)
	if err != nil || refund.Kind != interfaces.WebhookKindRefund || refund.ProviderObjectId != "77" || refund.Status != "pending" || refund.EventType != "refund.pending" {
		t.Fatalf("refund webhook: %v %+v", err, refund)
	}
	for _, testCase := range []struct {
		status string
		want   string
	}{
		{"completed", "pending"},
		{"completed-bank-transfer", "processed"},
		{"completed-momo", "processed"},
		{"completed-mpgs", "processed"},
		{"completed-offline", "processed"},
		{"completed-preauth", "processed"},
		{"pending-momo", "pending"},
		{"pending-bank-transfer", "pending"},
		{"pending-mpgs", "pending"},
		{"processing", "pending"},
		{"failed", "failed"},
	} {
		body := []byte(`{"id":77,"AmountRefunded":10,"status":"` + testCase.status + `","FlwRef":"F","TransactionId":9}`)
		notification, err := adapter.VerifyWebhookSignatureAndParse(body, headers)
		if err != nil || notification.Status != testCase.want {
			t.Errorf("refund status %q mapped to %q (%v), want %q", testCase.status, notification.Status, err, testCase.want)
		}
	}
}

func TestFlutterwaveChargebackWebhookRequiresValidAmount(t *testing.T) {
	_, adapter := newFakeFlutterwaveAdapter(t)
	for _, payload := range []string{
		`{"event":"chargeback.opened","data":{"id":9,"tx_ref":"chk-1","amount":"not-money","currency":"NGN"}}`,
		`{"event":"chargeback.opened","data":{"id":9,"tx_ref":"chk-1","amount":0,"currency":"NGN"}}`,
		`{"event":"chargeback.opened","data":{"id":9,"tx_ref":"chk-1","currency":"NGN"}}`,
		`{"event":"chargeback.opened","data":{"id":9,"tx_ref":"chk-1","amount":10}}`,
	} {
		if _, err := adapter.ParseVerifiedWebhookPayload([]byte(payload)); !errors.Is(err, interfaces.ErrMalformedWebhookPayload) {
			t.Errorf("invalid chargeback amount must be rejected: %s (err=%v)", payload, err)
		}
	}
	valid := `{"event":"chargeback.opened","data":{"id":9,"tx_ref":"chk-1","transaction_id":8,"amount":10,"currency":"NGN"}}`
	notification, err := adapter.ParseVerifiedWebhookPayload([]byte(valid))
	if err != nil || notification.Dispute == nil || notification.Dispute.AmountMinor != 1000 {
		t.Fatalf("valid chargeback amount must be parsed exactly: notification=%+v err=%v", notification, err)
	}
}

func TestFlutterwaveRefundLookupUsesDocumentedSingularCommentField(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	const refundReference = "verification-refund:case-lost"
	fake.Refunds = []map[string]any{{"id": 701, "transaction_id": 7001, "flw_ref": "FLW-REFUND-701", "comment": interfaces.RefundReferenceNote("checkmark refund", refundReference), "status": "completed-mpgs"}}
	fake.Refunds = append(fake.Refunds, map[string]any{"id": 702, "transaction_id": 7002, "comment": interfaces.RefundReferenceNote("unrelated refund", refundReference), "status": "completed-mpgs"})
	result, found, err := adapter.FindRefundByReference(context.Background(), interfaces.RefundLookup{ProviderChargeId: "7001", RefundReference: refundReference, SubmittedAfter: time.Now().Add(-time.Hour)})
	if err != nil || !found || result.ProviderRefundId != "701" || result.Outcome != interfaces.OutcomeSucceeded {
		t.Fatalf("a refund listed with the documented singular comment must be matched: found=%v result=%+v err=%v", found, result, err)
	}
	requests := fake.RequestLog()
	queries := fake.QueryLog()
	if len(requests) != 1 || requests[0] != "GET /v3/refunds" || len(queries) != 1 || queries[0] != "id=7001" {
		t.Fatalf("refund recovery must use the documented charge-id filter, not scan account-wide history: %v", requests)
	}
}

func TestFlutterwaveRefundLookupResolvesChargeReferenceToDocumentedTransactionFilter(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	ctx := context.Background()
	if _, err := adapter.InitializeCharge(ctx, interfaces.ChargeRequest{Reference: "refund-lookup-charge", AmountMinor: 25_000, Currency: "NGN", CustomerEmail: "buyer@nantty.test", SuccessUrl: "https://nantty.test/return"}); err != nil {
		t.Fatal(err)
	}
	transaction := fake.TransactionByReference("refund-lookup-charge")
	transaction.Status = "successful"
	fake.Refunds = []map[string]any{{"id": 711, "transaction_id": transaction.Id, "comment": interfaces.RefundReferenceNote("recovered", "refund-from-reference"), "status": "completed-mpgs"}}
	result, found, err := adapter.FindRefundByReference(ctx, interfaces.RefundLookup{ChargeReference: "refund-lookup-charge", RefundReference: "refund-from-reference"})
	if err != nil || !found || result.ProviderRefundId != "711" {
		t.Fatalf("refund lookup by charge reference should verify and constrain to transaction id: found=%v result=%+v err=%v", found, result, err)
	}
	requests := fake.RequestLog()
	queries := fake.QueryLog()
	if len(requests) != 3 || requests[1] != "GET /v3/transactions/verify_by_reference" || requests[2] != "GET /v3/refunds" || len(queries) != 3 || queries[1] != "tx_ref=refund-lookup-charge" || queries[2] != fmt.Sprintf("id=%d", transaction.Id) {
		t.Fatalf("charge-reference lookup must verify the exact charge then query its refunds: %v", requests)
	}
}

func TestFlutterwaveRefundLookupFailsClosedWhenACompleteNegativeResultCannotBeProven(t *testing.T) {
	for _, test := range []struct {
		name  string
		setup func(*paymentstesting.FakeFlutterwave)
	}{
		{name: "missing metadata", setup: func(fake *paymentstesting.FakeFlutterwave) { fake.OmitRefundListMeta = true }},
		{name: "more than one page with undocumented page query", setup: func(fake *paymentstesting.FakeFlutterwave) { fake.RefundListTotalPages = 2 }},
	} {
		t.Run(test.name, func(t *testing.T) {
			fake, adapter := newFakeFlutterwaveAdapter(t)
			test.setup(fake)
			result, found, err := adapter.FindRefundByReference(context.Background(), interfaces.RefundLookup{ProviderChargeId: "7001", RefundReference: "refund-not-on-first-page", SubmittedAfter: time.Now().Add(-time.Hour)})
			if err == nil || found || result.ProviderRefundId != "" {
				t.Fatalf("incomplete refund history must not authorize a resend: found=%v result=%+v err=%v", found, result, err)
			}
		})
	}
	_, adapter := newFakeFlutterwaveAdapter(t)
	if _, found, err := adapter.FindRefundByReference(context.Background(), interfaces.RefundLookup{ProviderChargeId: "7001", RefundReference: "absent", SubmittedAfter: time.Now().Add(-time.Hour)}); err != nil || found {
		t.Fatalf("an empty, explicitly complete one-page history can prove absence: found=%v err=%v", found, err)
	}
}
