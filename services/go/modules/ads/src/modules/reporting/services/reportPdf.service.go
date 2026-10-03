package services

import (
	"fmt"
	"strings"

	"zudomart/modules/ads/src/modules/reporting/dtos"
)

const (
	pdfMargin      = 40.0
	pdfRowsPerPage = 26
	pdfLabelWidth  = 170.0
)

var metricTitles = map[string]string{
	"impressions": "Impressions", "reach": "Reach", "frequency": "Frequency", "clicks": "Clicks", "ctr": "CTR", "cpc": "CPC", "cpm": "CPM", "spend": "Spend",
	"conversions": "Conversions", "conversionValue": "Conv. value", "roas": "ROAS", "videoViews": "Video views", "averageWatchPercent": "Avg watch", "followersGained": "Followers",
}

func truncate(text string, limit int) string {
	if len(text) <= limit {
		return text
	}
	return text[:limit-1] + "~"
}

// BuildReportPdf renders the report as a paginated landscape table: a totals row first, then one row per breakdown item.
func BuildReportPdf(response dtos.ReportResponse, columns []string, accountName string) []byte {
	document := &pdfDocument{}
	columnWidth := (pdfPageWidth - 2*pdfMargin - pdfLabelWidth) / float64(max(len(columns), 1))
	rows := append([]dtos.ReportRow{{Label: "Total", Metrics: response.Totals}}, response.Rows...)
	for start := 0; start < len(rows) || start == 0; start += pdfRowsPerPage {
		page := document.newPage()
		y := float64(pdfPageHeight) - pdfMargin
		if start == 0 {
			page.text(pdfMargin, y, 16, true, "Ads report - "+accountName)
			page.text(pdfMargin, y-18, 9, false, fmt.Sprintf("%s to %s, by %s, amounts in %s. Generated %s.", response.Query.From, response.Query.To, response.Query.Breakdown, response.Currency, response.GeneratedAt))
			y -= 50
		} else {
			y -= 10
		}
		page.text(pdfMargin, y, 8, true, strings.ToUpper(response.Query.Breakdown))
		for index, column := range columns {
			page.text(pdfMargin+pdfLabelWidth+float64(index)*columnWidth, y, 8, true, metricTitles[column])
		}
		page.line(pdfMargin, y-4, pdfPageWidth-pdfMargin)
		y -= 18
		for _, row := range rows[start:min(start+pdfRowsPerPage, len(rows))] {
			page.text(pdfMargin, y, 8, row.Label == "Total", truncate(row.Label, 34))
			for index, column := range columns {
				page.text(pdfMargin+pdfLabelWidth+float64(index)*columnWidth, y, 8, row.Label == "Total", truncate(metricCell(row.Metrics, column), int(columnWidth/4.2)))
			}
			y -= 16
		}
		if start+pdfRowsPerPage >= len(rows) {
			break
		}
	}
	return document.bytes()
}
