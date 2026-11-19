package types

import "time"

type IngestEventInput struct {
	EventKey    string         `json:"eventKey"`
	Domain      string         `json:"domain"`
	EventName   string         `json:"eventName"`
	SubjectId   string         `json:"subjectId,omitempty"`
	StoreId     string         `json:"storeId,omitempty"`
	AmountMinor int64          `json:"amountMinor,omitempty"`
	Currency    string         `json:"currency,omitempty"`
	OccurredAt  *time.Time     `json:"occurredAt,omitempty"`
	Properties  map[string]any `json:"properties,omitempty"`
}

type StoredEvent struct {
	Id          string
	EventKey    string
	Domain      string
	EventName   string
	SubjectId   string
	ActorId     string
	StoreId     string
	AmountMinor int64
	Currency    string
	Anonymized  bool
	Properties  map[string]any
	OccurredAt  time.Time
}

type IngestBatchResult struct {
	Accepted int `json:"accepted"`
	Ignored  int `json:"ignored"`
}

type DomainMetric struct {
	Domain      string `json:"domain"`
	EventName   string `json:"eventName"`
	Count       int64  `json:"count"`
	AmountMinor int64  `json:"amountMinor"`
}

type CreatorSummary struct {
	CreatorId     string `json:"creatorId"`
	Window        string `json:"window"`
	Views         int64  `json:"views"`
	Engagements   int64  `json:"engagements"`
	ProfileVisits int64  `json:"profileVisits"`
	RevenueMinor  int64  `json:"revenueMinor"`
}

type SellerSummary struct {
	StoreId         string  `json:"storeId"`
	Window          string  `json:"window"`
	ProductViews    int64   `json:"productViews"`
	AddToCarts      int64   `json:"addToCarts"`
	Orders          int64   `json:"orders"`
	GrossSalesMinor int64   `json:"grossSalesMinor"`
	ConversionRate  float64 `json:"conversionRate"`
}

type PlatformOverview struct {
	Window      string         `json:"window"`
	TotalEvents int64          `json:"totalEvents"`
	ByDomain    []DomainMetric `json:"byDomain"`
}
