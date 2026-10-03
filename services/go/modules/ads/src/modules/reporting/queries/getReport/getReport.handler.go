package getreport

import (
	"context"
	"sort"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/modules/reporting/dtos"
	"zudomart/modules/ads/src/modules/reporting/services"
	adsservices "zudomart/modules/ads/src/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.ReportResponse, error) {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, query.AccountId, query.UserId, adsservices.PermissionReportsView)
	if err != nil {
		return dtos.ReportResponse{}, err
	}
	campaignIds := parseIds(query.Report.CampaignIds)
	primary := services.Window{AccountId: account.ID, From: query.Report.From, To: query.Report.To, CampaignIds: campaignIds}
	current, err := services.LoadByBreakdown(ctx, deployed.Client, primary, query.Report.Breakdown)
	if err != nil {
		return dtos.ReportResponse{}, err
	}
	totals, series, err := handler.totalsAndSeries(ctx, account, primary)
	if err != nil {
		return dtos.ReportResponse{}, err
	}
	response := dtos.ReportResponse{Currency: account.Currency, Query: query.Report, Totals: totals, Series: series, ComparisonSeries: []dtos.ReportSeriesPoint{}, GeneratedAt: deployed.Now().UTC().Format(time.RFC3339)}
	var comparisonRows map[string]services.RawMetrics
	if query.Report.CompareFrom != nil && query.Report.CompareTo != nil {
		comparison := services.Window{AccountId: account.ID, From: *query.Report.CompareFrom, To: *query.Report.CompareTo, CampaignIds: campaignIds}
		comparisonTotals, comparisonSeries, err := handler.totalsAndSeries(ctx, account, comparison)
		if err != nil {
			return dtos.ReportResponse{}, err
		}
		response.ComparisonTotals, response.ComparisonSeries = &comparisonTotals, comparisonSeries
		if comparisonRows, err = services.LoadByBreakdown(ctx, deployed.Client, comparison, query.Report.Breakdown); err != nil {
			return dtos.ReportResponse{}, err
		}
	}
	response.Rows, err = handler.rows(ctx, account, query.Report.Breakdown, current, comparisonRows)
	return response, err
}

func parseIds(raw []string) []uuid.UUID {
	ids := make([]uuid.UUID, 0, len(raw))
	for _, value := range raw {
		if parsed, err := uuid.Parse(value); err == nil {
			ids = append(ids, parsed)
		}
	}
	return ids
}

func (handler Handler) totalsAndSeries(ctx context.Context, account *ent.AdAccount, window services.Window) (dtos.ReportMetrics, []dtos.ReportSeriesPoint, error) {
	byDay, err := services.LoadByBreakdown(ctx, handler.Container.Client, window, "day")
	if err != nil {
		return dtos.ReportMetrics{}, nil, err
	}
	var total services.RawMetrics
	days := make([]string, 0, len(byDay))
	for day, raw := range byDay {
		total.Add(raw)
		days = append(days, day)
	}
	sort.Strings(days)
	series := make([]dtos.ReportSeriesPoint, 0, len(days))
	for _, day := range days {
		series = append(series, dtos.ReportSeriesPoint{Date: day, Metrics: services.ComputeMetrics(byDay[day], account.Currency)})
	}
	return services.ComputeMetrics(total, account.Currency), series, nil
}

func (handler Handler) rows(ctx context.Context, account *ent.AdAccount, breakdown string, current, comparison map[string]services.RawMetrics) ([]dtos.ReportRow, error) {
	if services.IsDemographicBreakdown(breakdown) {
		current, comparison = services.MergeSmallDemographicRows(current), services.MergeSmallDemographicRows(comparison)
	}
	keys := make([]string, 0, len(current))
	for key := range current {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(left, right int) bool {
		return current[keys[left]].SpendMicros > current[keys[right]].SpendMicros || (current[keys[left]].SpendMicros == current[keys[right]].SpendMicros && keys[left] < keys[right])
	})
	labels, err := services.LabelsFor(ctx, handler.Container.Client, account.ID, breakdown, keys)
	if err != nil {
		return nil, err
	}
	rows := make([]dtos.ReportRow, 0, len(keys))
	for _, key := range keys {
		row := dtos.ReportRow{Key: key, Label: labelFor(labels, key), Metrics: services.ComputeMetrics(current[key], account.Currency)}
		if previous, found := comparison[key]; found {
			metrics := services.ComputeMetrics(previous, account.Currency)
			row.Comparison = &metrics
		}
		rows = append(rows, row)
	}
	return rows, nil
}

func labelFor(labels map[string]string, key string) string {
	if label, found := labels[key]; found {
		return label
	}
	if key == "" {
		return "Unknown"
	}
	return key
}
