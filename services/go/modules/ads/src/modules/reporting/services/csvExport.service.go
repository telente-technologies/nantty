package services

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"strconv"
	"strings"

	"zudomart/modules/ads/src/modules/reporting/dtos"
	"zudomart/modules/ads/src/types"
)

var DefaultExportColumns = []string{"spend", "impressions", "reach", "clicks", "ctr", "cpc", "cpm", "conversions", "conversionValue", "roas"}

var moneyColumns = map[string]bool{"cpc": true, "cpm": true, "spend": true, "conversionValue": true}

func IsKnownMetricKey(key string) bool {
	switch key {
	case "impressions", "reach", "frequency", "clicks", "ctr", "cpc", "cpm", "spend", "conversions", "conversionValue", "roas", "videoViews", "averageWatchPercent", "followersGained":
		return true
	}
	return false
}

func SanitizeCsvCell(value string) string {
	if value != "" && strings.ContainsRune("=+-@", rune(value[0])) {
		return "'" + value
	}
	return value
}

func formatMajor(money *types.Money) string {
	if money == nil {
		return ""
	}
	return fmt.Sprintf("%.2f", float64(money.AmountMinor)/100)
}

func metricCell(metrics dtos.ReportMetrics, column string) string {
	switch column {
	case "impressions":
		return strconv.FormatInt(metrics.Impressions, 10)
	case "reach":
		return strconv.FormatInt(metrics.Reach, 10)
	case "frequency":
		return fmt.Sprintf("%.2f", metrics.Frequency)
	case "clicks":
		return strconv.FormatInt(metrics.Clicks, 10)
	case "ctr":
		return fmt.Sprintf("%.4f", metrics.Ctr)
	case "cpc":
		return formatMajor(metrics.Cpc)
	case "cpm":
		return formatMajor(metrics.Cpm)
	case "spend":
		return formatMajor(&metrics.Spend)
	case "conversions":
		return strconv.FormatInt(metrics.Conversions, 10)
	case "conversionValue":
		return formatMajor(&metrics.ConversionValue)
	case "roas":
		if metrics.Roas == nil {
			return ""
		}
		return fmt.Sprintf("%.2f", *metrics.Roas)
	case "videoViews":
		return strconv.FormatInt(metrics.VideoViews, 10)
	case "averageWatchPercent":
		if metrics.AverageWatchPercent == nil {
			return ""
		}
		return fmt.Sprintf("%.2f", *metrics.AverageWatchPercent)
	}
	return strconv.FormatInt(metrics.FollowersGained, 10)
}

func BuildReportCsv(response dtos.ReportResponse, columns []string) ([]byte, error) {
	var buffer bytes.Buffer
	buffer.WriteString("\ufeff")
	writer := csv.NewWriter(&buffer)
	header := []string{response.Query.Breakdown}
	for _, column := range columns {
		name := column
		if moneyColumns[column] {
			name = fmt.Sprintf("%s (%s)", column, response.Currency)
		}
		header = append(header, name)
	}
	if err := writer.Write(header); err != nil {
		return nil, err
	}
	for _, row := range response.Rows {
		cells := []string{SanitizeCsvCell(row.Label)}
		for _, column := range columns {
			cells = append(cells, SanitizeCsvCell(metricCell(row.Metrics, column)))
		}
		if err := writer.Write(cells); err != nil {
			return nil, err
		}
	}
	writer.Flush()
	return buffer.Bytes(), writer.Error()
}
