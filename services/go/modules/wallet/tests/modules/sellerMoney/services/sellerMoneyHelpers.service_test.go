package services_test

import (
	"strings"
	"testing"
	"time"

	"nantty/modules/wallet/src/modules/sellerMoney/dtos"
	"nantty/modules/wallet/src/modules/sellerMoney/services"
	"nantty/platform/money"
)

func TestNextScheduledRunPicksNineAmStoreTimeOnTheNextMatchingDay(t *testing.T) {
	lagos, _ := time.LoadLocation("Africa/Lagos")
	thursdayAfterNine := time.Date(2026, 10, 1, 10, 0, 0, 0, lagos)
	if services.NextScheduledRun("manual", 1, 1, lagos, thursdayAfterNine) != nil {
		t.Fatal("manual payouts have no next run")
	}
	daily := services.NextScheduledRun("daily", 1, 1, lagos, thursdayAfterNine).In(lagos)
	if daily.Day() != 2 || daily.Hour() != 9 {
		t.Fatalf("daily: %v", daily)
	}
	weekly := services.NextScheduledRun("weekly", 1, 1, lagos, thursdayAfterNine).In(lagos)
	if weekly.Weekday() != time.Monday || weekly.Day() != 5 {
		t.Fatalf("weekly: %v", weekly)
	}
	monthly := services.NextScheduledRun("monthly", 1, 1, lagos, thursdayAfterNine).In(lagos)
	if monthly.Month() != time.November || monthly.Day() != 1 {
		t.Fatalf("monthly: %v", monthly)
	}
}

func TestLedgerEntryKindsMapToDashboardTransactionKinds(t *testing.T) {
	expected := map[string]string{
		"withdrawal.requested": "payout", "withdrawal.reversed": "payout", "escrowFee.returnedForRefund": "refund", "payment.feeCharged": "fee",
		"adBalance.spent": "ads_charge", "subscription.periodBilled": "subscription_charge", "escrow.released": "escrow_release", "sellerCredit.locked": "escrow_release",
		"escrow.held": "escrow_hold", "manual.correction": "adjustment",
	}
	for entryKind, want := range expected {
		if got := services.SellerTransactionKindOf(entryKind); got != want {
			t.Errorf("%s: got %s, want %s", entryKind, got, want)
		}
	}
}

func TestStatementCsvNeutralisesFormulasAndUsesMajorUnits(t *testing.T) {
	detail := dtos.StatementDetailView{Lines: []dtos.StatementLineView{{WalletTransactionView: dtos.WalletTransactionView{
		Description: "=HYPERLINK(\"x\")", Reference: "+ref", Kind: "payout", BalanceBucket: "available", Direction: "debit",
		Amount: money.Money{AmountMinor: 123456, Currency: "NGN"}, CreatedAt: "2026-10-01T09:00:00Z",
	}}}}
	csvText := string(services.StatementCsv(detail, "NGN", 2))
	if !strings.Contains(csvText, "'=HYPERLINK") || !strings.Contains(csvText, "'+ref") || !strings.Contains(csvText, "-1234.56") || !strings.Contains(csvText, "Amount (NGN)") {
		t.Fatalf("csv: %s", csvText)
	}
}

func TestAccountDetailsAreAlwaysMasked(t *testing.T) {
	if services.MaskAccountNumber("4471") != "******4471" || strings.Contains(services.MaskAccountName("IFE LIFESTYLE LTD"), "LIFESTYLE") {
		t.Fatal("masking leaks account details")
	}
}

func TestWeekStartIsMondayInStoreTime(t *testing.T) {
	lagos, _ := time.LoadLocation("Africa/Lagos")
	sundayNight := time.Date(2026, 10, 4, 23, 30, 0, 0, lagos)
	if start := services.WeekStartOf(sundayNight, lagos); start.Weekday() != time.Monday || start.Day() != 28 {
		t.Fatalf("week start: %v", start)
	}
	if services.SettlementIdFor(services.WeekStartOf(sundayNight, lagos)) != "stl_20260928" {
		t.Fatal("settlement ids follow the week start")
	}
}
