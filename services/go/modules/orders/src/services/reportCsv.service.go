package services

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"math"
	"strconv"
	"strings"

	"zudomart/platform/money"
)

func neutraliseFormula(cell string) string {
	if cell != "" && strings.ContainsRune("=+-@", rune(cell[0])) {
		return "'" + cell
	}
	return cell
}

func majorUnits(value money.Money) string {
	exponent := money.MinorUnitExponentForCurrency(value.Currency)
	return fmt.Sprintf("%.*f", exponent, float64(value.AmountMinor)/math.Pow10(exponent))
}

func csvCell(column ReportColumn, value any) string {
	switch typed := value.(type) {
	case nil:
		return ""
	case money.Money:
		return majorUnits(typed)
	case int:
		return strconv.Itoa(typed)
	case int64:
		if column.Kind == "percent" {
			return fmt.Sprintf("%.2f", float64(typed)/100)
		}
		return strconv.FormatInt(typed, 10)
	case string:
		return neutraliseFormula(typed)
	}
	return neutraliseFormula(fmt.Sprint(value))
}

func csvHeader(column ReportColumn, currency money.CurrencyCode) string {
	switch column.Kind {
	case "money":
		return column.Label + " (" + string(currency) + ")"
	case "percent":
		return column.Label + " (%)"
	}
	return column.Label
}

func RenderReportCsv(result ReportResult, currency money.CurrencyCode) ([]byte, error) {
	var buffer bytes.Buffer
	writer := csv.NewWriter(&buffer)
	header := make([]string, 0, len(result.Columns))
	for _, column := range result.Columns {
		header = append(header, csvHeader(column, currency))
	}
	if err := writer.Write(header); err != nil {
		return nil, err
	}
	rows := append([]map[string]any{}, result.Rows...)
	if result.Totals != nil {
		rows = append(rows, result.Totals)
	}
	for _, row := range rows {
		record := make([]string, 0, len(result.Columns))
		for _, column := range result.Columns {
			record = append(record, csvCell(column, row[column.Key]))
		}
		if err := writer.Write(record); err != nil {
			return nil, err
		}
	}
	writer.Flush()
	return buffer.Bytes(), writer.Error()
}
