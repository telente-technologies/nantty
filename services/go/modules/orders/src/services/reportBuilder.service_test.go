package services

import (
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/enums"
	"nantty/modules/orders/src/generated/ent"
)

func reportFixture() ReportData {
	first, second := uuid.New(), uuid.New()
	day := time.Date(2026, 10, 1, 10, 0, 0, 0, time.UTC)
	groups := []*ent.OrderGroup{
		{ID: first, Status: enums.StatusCompleted, PaymentStatus: "paid", SubtotalMinor: 30_000, CreatedAt: day, BuyerAccountID: uuid.New(), BuyerName: "=Ada"},
		{ID: second, Status: enums.StatusCancelled, PaymentStatus: "paid", SubtotalMinor: 99_000, CreatedAt: day},
	}
	items := map[uuid.UUID][]*ent.OrderItem{
		first:  {{ProductID: uuid.New(), ProductName: "Shirt", Quantity: 2, LineTotalMinor: 30_000, CategoryName: "Fashion"}},
		second: {{ProductID: uuid.New(), ProductName: "Hat", Quantity: 1, LineTotalMinor: 99_000}},
	}
	return ReportData{Currency: "NGN", From: day.Truncate(24*time.Hour).AddDate(0, 0, -1), To: day.Truncate(24*time.Hour).AddDate(0, 0, 1), Groups: groups, Items: items, Now: day}
}

func TestSalesByDayZeroFillsAndExcludesCancelledOrders(t *testing.T) {
	result, found := BuildReport("sales-by-day", reportFixture())
	if !found || len(result.Rows) != 3 {
		t.Fatalf("expected three zero-filled days, got %d rows", len(result.Rows))
	}
	if result.Rows[1]["orders"] != 1 || result.Rows[1]["items"] != 2 {
		t.Fatalf("cancelled order leaked into sales: %+v", result.Rows[1])
	}
	if result.Rows[0]["orders"] != 0 || result.Rows[2]["orders"] != 0 {
		t.Fatal("empty days must be zero filled")
	}
}

func TestCsvNeutralisesFormulasAndPutsCurrencyInHeaders(t *testing.T) {
	data := reportFixture()
	result, _ := BuildReport("top-customers", data)
	content, err := RenderReportCsv(result, data.Currency)
	if err != nil {
		t.Fatal(err)
	}
	text := string(content)
	if !strings.Contains(text, "'=Ada") {
		t.Fatalf("formula was not neutralised: %s", text)
	}
	if !strings.Contains(text, "Spent (NGN)") || !strings.Contains(text, "300.00") {
		t.Fatalf("money columns must be major units with the currency in the header: %s", text)
	}
}

func TestUnknownReportKindIsNotBuilt(t *testing.T) {
	if _, found := BuildReport("inventory-valuation", reportFixture()); found {
		t.Fatal("inventory valuation is not built from orders data")
	}
}
