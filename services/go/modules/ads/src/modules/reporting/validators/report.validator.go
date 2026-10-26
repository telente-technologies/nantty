package validators

import (
	"net/url"
	"slices"
	"strconv"
	"strings"
	"time"

	"nantty/modules/ads/src/modules/reporting/dtos"
	"nantty/modules/ads/src/modules/reporting/services"
	"nantty/platform/httpserver"
)

const maximumReportDays = 400

func ParseReportQuery(values url.Values) (dtos.ReportQuery, []string, error) {
	var issues []httpserver.ValidationIssue
	query := dtos.ReportQuery{From: values.Get("from"), To: values.Get("to"), Breakdown: values.Get("breakdown"), ClickWindowDays: 7, ViewWindowDays: 1, CampaignIds: []string{}}
	if query.Breakdown == "" {
		query.Breakdown = "campaign"
	}
	if !services.IsKnownBreakdown(query.Breakdown) {
		issues = append(issues, httpserver.ValidationIssue{Path: "breakdown", Message: "Unknown breakdown."})
	}
	from, to := parseDate(query.From, "from", &issues), parseDate(query.To, "to", &issues)
	if !from.IsZero() && !to.IsZero() && (to.Before(from) || to.Sub(from) > maximumReportDays*24*time.Hour) {
		issues = append(issues, httpserver.ValidationIssue{Path: "to", Message: "Choose a range of at most 400 days."})
	}
	if compareFrom, compareTo := values.Get("compareFrom"), values.Get("compareTo"); compareFrom != "" && compareTo != "" {
		parseDate(compareFrom, "compareFrom", &issues)
		parseDate(compareTo, "compareTo", &issues)
		query.CompareFrom, query.CompareTo = &compareFrom, &compareTo
	}
	if ids := values.Get("campaignIds"); ids != "" {
		query.CampaignIds = strings.Split(ids, ",")
	}
	query.ClickWindowDays = readWindow(values.Get("clickWindowDays"), []int{1, 7, 28}, 7, "clickWindowDays", &issues)
	query.ViewWindowDays = readWindow(values.Get("viewWindowDays"), []int{0, 1}, 1, "viewWindowDays", &issues)
	columns := []string{}
	for _, column := range strings.Split(values.Get("columns"), ",") {
		if column == "" {
			continue
		}
		if !services.IsKnownMetricKey(column) {
			issues = append(issues, httpserver.ValidationIssue{Path: "columns", Message: "Unknown column " + column + "."})
		}
		columns = append(columns, column)
	}
	if len(issues) > 0 {
		return query, nil, httpserver.NewValidationFailedError(issues)
	}
	return query, columns, nil
}

func parseDate(value, path string, issues *[]httpserver.ValidationIssue) time.Time {
	parsed, err := time.Parse("2006-01-02", value)
	if err != nil {
		*issues = append(*issues, httpserver.ValidationIssue{Path: path, Message: "must be YYYY-MM-DD"})
	}
	return parsed
}

func readWindow(raw string, allowed []int, fallback int, path string, issues *[]httpserver.ValidationIssue) int {
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil || !slices.Contains(allowed, value) {
		*issues = append(*issues, httpserver.ValidationIssue{Path: path, Message: "is not an allowed window"})
		return fallback
	}
	return value
}
