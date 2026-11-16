package tests

import (
	"testing"

	exportfinancereport "nantty/modules/admin/src/modules/financeReports/commands/exportFinanceReport"
	"nantty/modules/admin/src/modules/financeReports/services"
)

func TestFinanceHelpers(t *testing.T) {
	if got := services.ClampLimit(0, 50); got != 50 {
		t.Fatalf("expected default 50, got %d", got)
	}
	if got := services.ClampLimit(500, 50); got != 100 {
		t.Fatalf("expected clamped max 100, got %d", got)
	}
	if got := services.NormalizeCurrency(" ngn "); got != "NGN" {
		t.Fatalf("expected NGN, got %q", got)
	}
	if got := services.NormalizeCurrency("invalid"); got != "" {
		t.Fatalf("expected empty currency, got %q", got)
	}
	if got := exportfinancereport.NeutralizeCsvCell("=SUM(A1:A2)"); got != "'=SUM(A1:A2)" {
		t.Fatalf("expected formula prefix, got %q", got)
	}
	if got := exportfinancereport.NeutralizeCsvCell("NGN"); got != "NGN" {
		t.Fatalf("expected unchanged safe cell, got %q", got)
	}
}
