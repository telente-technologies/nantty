package regionpricing

import (
	"errors"
	"fmt"
	"slices"
)

type EstimateRequest struct {
	Countries       []string
	BillingCurrency string
	BudgetType      string
	BudgetMinor     int64
	Days            int
	Objective       string
	RegionWeights   map[string]int64
}

type Range struct {
	Low  int64 `json:"low"`
	High int64 `json:"high"`
}

type RegionEstimate struct {
	Region                    string `json:"region"`
	LocalCurrency             string `json:"localCurrency"`
	BudgetShareBps            int64  `json:"budgetShareBps"`
	DailyBudgetMinor          int64  `json:"dailyBudgetMinor"`
	TotalBudgetMinor          int64  `json:"totalBudgetMinor"`
	MinimumDailyBudgetMinor   int64  `json:"minimumDailyBudgetMinor"`
	SuggestedDailyBudgetMinor int64  `json:"suggestedDailyBudgetMinor"`
	SuggestedCpmMinor         int64  `json:"suggestedCpmMinor"`
	SuggestedCpcMinor         int64  `json:"suggestedCpcMinor"`
	Impressions               Range  `json:"impressions"`
	Reach                     Range  `json:"reach"`
	Clicks                    Range  `json:"clicks"`
	VideoViews                Range  `json:"videoViews"`
	Results                   Range  `json:"results"`
	CostPerResult             Range  `json:"costPerResultMinor"`
	BelowRegionMinimum        bool   `json:"belowRegionMinimum"`
	ExchangeNote              string `json:"exchangeNote,omitempty"`
}

type CampaignEstimate struct {
	BillingCurrency              string           `json:"billingCurrency"`
	Days                         int              `json:"days"`
	DailyBudgetMinor             int64            `json:"dailyBudgetMinor"`
	TotalCostMinor               int64            `json:"totalCostMinor"`
	MinimumDailyBudgetMinor      int64            `json:"minimumDailyBudgetMinor"`
	SuggestedDailyBudgetMinor    int64            `json:"suggestedDailyBudgetMinor"`
	SuggestedLifetimeBudgetMinor int64            `json:"suggestedLifetimeBudgetMinor"`
	ResultKind                   string           `json:"resultKind"`
	Impressions                  Range            `json:"impressions"`
	Reach                        Range            `json:"reach"`
	Clicks                       Range            `json:"clicks"`
	VideoViews                   Range            `json:"videoViews"`
	Results                      Range            `json:"results"`
	CostPerResult                Range            `json:"costPerResultMinor"`
	BelowMinimum                 bool             `json:"belowMinimum"`
	Regions                      []RegionEstimate `json:"regions"`
}

var ErrInvalidEstimate = errors.New("invalid estimate request")

const (
	cpmLowFactorBps    = 7_500
	cpmHighFactorBps   = 13_000
	frequencyLowTenths = 14
	frequencyHighTenth = 18
	ctrLowPpm          = 6_000
	ctrHighPpm         = 14_000
	viewRateLowBps     = 2_000
	viewRateHighBps    = 3_500
)

var resultKindByObjective = map[string]string{
	"awareness": "reach", "views": "video_views", "engagement": "video_views", "traffic": "clicks", "profile_visits": "clicks",
	"store_promotion": "clicks", "sales": "clicks", "followers": "follows", "messages": "messages",
}

func ResultKindForObjective(objective string) string {
	if kind, known := resultKindByObjective[objective]; known {
		return kind
	}
	return "clicks"
}

func scaleRange(base Range, numerator, denominator int64) Range {
	return Range{Low: base.Low * numerator / denominator, High: base.High * numerator / denominator}
}

func addRange(total *Range, part Range) {
	total.Low += part.Low
	total.High += part.High
}

func resultsFor(kind string, reach, clicks, views Range) Range {
	switch kind {
	case "reach":
		return reach
	case "video_views":
		return views
	case "follows":
		return scaleRange(clicks, 1, 20)
	case "messages":
		return scaleRange(clicks, 1, 10)
	}
	return clicks
}

func costPerResult(totalMinor int64, results Range) Range {
	if results.High <= 0 {
		return Range{}
	}
	low := totalMinor / results.High
	high := totalMinor
	if results.Low > 0 {
		high = (totalMinor + results.Low - 1) / results.Low
	}
	return Range{Low: low, High: high}
}

func exchangeNote(localCurrency, billingCurrency string, ratesE8 map[string]int64) string {
	if localCurrency == billingCurrency {
		return ""
	}
	from, to := localCurrency, billingCurrency
	converted, err := ConvertMinorUnits(100_000_000, from, to, ratesE8)
	if err == nil && converted < 100_000_000 {
		from, to = to, from
		converted, err = ConvertMinorUnits(100_000_000, from, to, ratesE8)
	}
	if err != nil {
		return ""
	}
	return fmt.Sprintf("1 %s ≈ %d.%02d %s (currency module rate)", from, converted/100_000_000, converted%100_000_000/1_000_000, to)
}

func estimateRegion(row AdRegionPricing, dailyMinor int64, days int, kind, billingCurrency string, ratesE8 map[string]int64) (RegionEstimate, error) {
	billing, err := row.InBillingCurrency(billingCurrency, ratesE8)
	if err != nil {
		return RegionEstimate{}, err
	}
	total := dailyMinor * int64(days)
	impressions := Range{}
	if billing.SuggestedCpmMinor > 0 {
		impressions = Range{
			Low:  total * 1_000 * 10_000 / (billing.SuggestedCpmMinor * cpmHighFactorBps),
			High: total * 1_000 * 10_000 / (billing.SuggestedCpmMinor * cpmLowFactorBps),
		}
	}
	reach := Range{Low: impressions.Low * 10 / frequencyHighTenth, High: impressions.High * 10 / frequencyLowTenths}
	clicks := Range{Low: impressions.Low * ctrLowPpm / 1_000_000, High: impressions.High * ctrHighPpm / 1_000_000}
	views := Range{Low: impressions.Low * viewRateLowBps / 10_000, High: impressions.High * viewRateHighBps / 10_000}
	results := resultsFor(kind, reach, clicks, views)
	return RegionEstimate{
		Region: row.Region, LocalCurrency: row.Currency, DailyBudgetMinor: dailyMinor, TotalBudgetMinor: total,
		MinimumDailyBudgetMinor: billing.MinimumDailyBudgetMinor, SuggestedDailyBudgetMinor: billing.SuggestedDailyBudgetMinor,
		SuggestedCpmMinor: billing.SuggestedCpmMinor, SuggestedCpcMinor: billing.SuggestedCpcMinor,
		Impressions: impressions, Reach: reach, Clicks: clicks, VideoViews: views, Results: results, CostPerResult: costPerResult(total, results),
		BelowRegionMinimum: dailyMinor < billing.MinimumDailyBudgetMinor, ExchangeNote: exchangeNote(row.Currency, billingCurrency, ratesE8),
	}, nil
}

func EstimateCampaign(table []AdRegionPricing, request EstimateRequest, ratesE8 map[string]int64) (CampaignEstimate, error) {
	if request.Days < 1 || request.Days > 366 || request.BudgetMinor < 0 || (request.BudgetType != "daily" && request.BudgetType != "lifetime") || !IsSupportedCurrency(request.BillingCurrency) {
		return CampaignEstimate{}, ErrInvalidEstimate
	}
	regions := RegionsForCountries(request.Countries)
	if len(regions) == 0 {
		region, _ := RegionForCurrency(request.BillingCurrency)
		regions = []string{region.Code}
	}
	slices.Sort(regions)
	daily := request.BudgetMinor
	if request.BudgetType == "lifetime" {
		daily = request.BudgetMinor / int64(request.Days)
	}
	strictest, err := FloorsForTargetedRegions(table, regions, request.BillingCurrency, ratesE8)
	if err != nil {
		return CampaignEstimate{}, err
	}
	weights, totalWeight := make([]int64, len(regions)), int64(0)
	for index, region := range regions {
		weights[index] = max(request.RegionWeights[region], 1)
		totalWeight += weights[index]
	}
	kind := ResultKindForObjective(request.Objective)
	estimate := CampaignEstimate{
		BillingCurrency: request.BillingCurrency, Days: request.Days, DailyBudgetMinor: daily, ResultKind: kind,
		MinimumDailyBudgetMinor: strictest.MinimumDailyBudgetMinor, BelowMinimum: daily < strictest.MinimumDailyBudgetMinor,
	}
	allocated := int64(0)
	for index, region := range regions {
		share := daily * weights[index] / totalWeight
		if index == len(regions)-1 {
			share = daily - allocated
		}
		allocated += share
		regionEstimate, err := estimateRegion(FindAdRegionPricing(table, region), share, request.Days, kind, request.BillingCurrency, ratesE8)
		if err != nil {
			return CampaignEstimate{}, err
		}
		regionEstimate.BudgetShareBps = weights[index] * 10_000 / totalWeight
		estimate.SuggestedDailyBudgetMinor += regionEstimate.SuggestedDailyBudgetMinor
		estimate.TotalCostMinor += regionEstimate.TotalBudgetMinor
		addRange(&estimate.Impressions, regionEstimate.Impressions)
		addRange(&estimate.Reach, regionEstimate.Reach)
		addRange(&estimate.Clicks, regionEstimate.Clicks)
		addRange(&estimate.VideoViews, regionEstimate.VideoViews)
		addRange(&estimate.Results, regionEstimate.Results)
		estimate.Regions = append(estimate.Regions, regionEstimate)
	}
	estimate.SuggestedDailyBudgetMinor = max(estimate.SuggestedDailyBudgetMinor, strictest.MinimumDailyBudgetMinor)
	estimate.SuggestedLifetimeBudgetMinor = estimate.SuggestedDailyBudgetMinor * int64(request.Days)
	estimate.CostPerResult = costPerResult(estimate.TotalCostMinor, estimate.Results)
	return estimate, nil
}

type BoostPackage struct {
	Price          int64  `json:"priceMinor"`
	Currency       string `json:"currency"`
	Days           int    `json:"days"`
	Label          string `json:"label"`
	EstimatedReach Range  `json:"estimatedReach"`
	Impressions    Range  `json:"impressions"`
}

var boostPackageShapes = []struct {
	multiple int64
	days     int
	label    string
}{{1, 1, "1 day"}, {3, 3, "3 days"}, {7, 7, "1 week"}, {15, 7, "1 week, wider reach"}}

func BoostPackages(table []AdRegionPricing, region, billingCurrency string, ratesE8 map[string]int64) ([]BoostPackage, error) {
	row := FindAdRegionPricing(table, region)
	billing, err := row.InBillingCurrency(billingCurrency, ratesE8)
	if err != nil {
		return nil, err
	}
	packages := make([]BoostPackage, 0, len(boostPackageShapes))
	for _, shape := range boostPackageShapes {
		price := billing.BoostMinimumDailyMinor * shape.multiple
		if billingCurrency != row.Currency {
			price = RoundToPricePoint(price, billingCurrency)
		}
		estimate, err := estimateRegion(row, price/int64(shape.days), shape.days, "reach", billingCurrency, ratesE8)
		if err != nil {
			return nil, err
		}
		packages = append(packages, BoostPackage{Price: price, Currency: billingCurrency, Days: shape.days, Label: shape.label, EstimatedReach: estimate.Reach, Impressions: estimate.Impressions})
	}
	return packages, nil
}
