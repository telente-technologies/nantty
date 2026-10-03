package services

import (
	"strings"
	"testing"

	"zudomart/modules/ads/src/modules/reporting/dtos"
	"zudomart/modules/ads/src/types"
)

func TestCsvExportPrefixesFormulaCellsAndShowsCurrencyInMoneyHeaders(t *testing.T) {
	response := dtos.ReportResponse{Currency: "NGN", Query: dtos.ReportQuery{Breakdown: "campaign"}, Rows: []dtos.ReportRow{{
		Key: "1", Label: "=HYPERLINK(\"http://evil\")", Metrics: dtos.ReportMetrics{Impressions: 10, Spend: types.Money{AmountMinor: 123_456, Currency: "NGN"}},
	}}}
	output, err := BuildReportCsv(response, []string{"spend", "impressions"})
	if err != nil {
		t.Fatal(err)
	}
	text := string(output)
	if !strings.HasPrefix(text, "\ufeff") || !strings.Contains(text, "spend (NGN)") || !strings.Contains(text, "1234.56") {
		t.Fatalf("unexpected csv %q", text)
	}
	if !strings.Contains(text, "\"'=HYPERLINK") {
		t.Fatalf("formula cells must be neutralised: %q", text)
	}
}
