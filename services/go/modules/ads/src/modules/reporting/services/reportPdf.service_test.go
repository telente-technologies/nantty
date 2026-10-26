package services

import (
	"bytes"
	"strconv"
	"strings"
	"testing"

	"nantty/modules/ads/src/modules/reporting/dtos"
	"nantty/modules/ads/src/types"
)

func sampleReport(rows int) dtos.ReportResponse {
	response := dtos.ReportResponse{Currency: "NGN", Query: dtos.ReportQuery{From: "2026-09-01", To: "2026-09-30", Breakdown: "campaign"}, GeneratedAt: "2026-10-01T00:00:00Z"}
	response.Totals = dtos.ReportMetrics{Impressions: 1000, Spend: types.Money{AmountMinor: 250000, Currency: "NGN"}}
	for index := 0; index < rows; index++ {
		response.Rows = append(response.Rows, dtos.ReportRow{Key: strconv.Itoa(index), Label: "Campaign (promo) " + strconv.Itoa(index), Metrics: response.Totals})
	}
	return response
}

func TestPdfIsWellFormedEscapesTextAndPaginates(t *testing.T) {
	output := BuildReportPdf(sampleReport(60), []string{"spend", "impressions"}, "Ada's Store \\ (test)")
	if !bytes.HasPrefix(output, []byte("%PDF-1.4")) || !bytes.HasSuffix(output, []byte("%%EOF\n")) {
		t.Fatal("missing PDF header or trailer")
	}
	text := string(output)
	if strings.Count(text, "/Type /Page ") != 3 {
		t.Fatalf("61 rows at 26 per page should make 3 pages, got %d", strings.Count(text, "/Type /Page "))
	}
	if !strings.Contains(text, `Ada's Store \\ \(test\)`) || !strings.Contains(text, "Campaign \\(promo\\) 0") {
		t.Fatal("parentheses and backslashes must be escaped")
	}
	startXref := strings.LastIndex(text, "startxref\n")
	offset, _ := strconv.Atoi(strings.Fields(text[startXref+len("startxref\n"):])[0])
	if !strings.HasPrefix(text[offset:], "xref\n") {
		t.Fatal("startxref must point at the xref table")
	}
}

func TestPdfWithNoRowsStillHasOnePage(t *testing.T) {
	if !strings.Contains(string(BuildReportPdf(sampleReport(0), []string{"spend"}, "x")), "/Count 1") {
		t.Fatal("expected a single page")
	}
}
