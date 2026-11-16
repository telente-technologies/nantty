package models

type Money struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

type ServiceHealth struct {
	Name      string  `json:"name"`
	Status    string  `json:"status"`
	LatencyMs *int64  `json:"latencyMs"`
	Note      *string `json:"note"`
}

type FinanceOverview struct {
	GeneratedAt               string          `json:"generatedAt"`
	Range                     string          `json:"range"`
	Currency                  string          `json:"currency,omitempty"`
	GmvByCurrency             []Money         `json:"gmvByCurrency"`
	EscrowHeldByCurrency      []Money         `json:"escrowHeldByCurrency"`
	EscrowReleasedByCurrency  []Money         `json:"escrowReleasedByCurrency"`
	EscrowRefundedByCurrency  []Money         `json:"escrowRefundedByCurrency"`
	PayoutsPendingByCurrency  []Money         `json:"payoutsPendingByCurrency"`
	CoinSalesByCurrency       []Money         `json:"coinSalesByCurrency"`
	AdTopUpsByCurrency        []Money         `json:"adTopUpsByCurrency"`
	SubscriptionByCurrency    []Money         `json:"subscriptionByCurrency"`
	PlatformRevenueByCurrency []Money         `json:"platformRevenueByCurrency"`
	DisputesOpenCount         int64           `json:"disputesOpenCount"`
	StuckEscrowsCount         int64           `json:"stuckEscrowsCount"`
	PayoutsPendingCount       int64           `json:"payoutsPendingCount"`
	PayoutsAgedCount          int64           `json:"payoutsAgedCount"`
	SellerDebtAccountsCount   int64           `json:"sellerDebtAccountsCount"`
	Health                    []ServiceHealth `json:"health"`
}

type EscrowRecord struct {
	Id            string  `json:"id"`
	OrderId       string  `json:"orderId"`
	Status        string  `json:"status"`
	Amount        Money   `json:"amount"`
	AutoReleaseAt *string `json:"autoReleaseAt"`
	DeliveredAt   *string `json:"deliveredAt"`
	ReleasedAt    *string `json:"releasedAt"`
	RefundedAt    *string `json:"refundedAt"`
	Stuck         bool    `json:"stuck"`
}

type AspectRow struct {
	Group       string `json:"group"`
	Status      string `json:"status"`
	Count       int64  `json:"count"`
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

type MoneyByAspect struct {
	Aspect      string      `json:"aspect"`
	Range       string      `json:"range"`
	Currency    string      `json:"currency,omitempty"`
	GeneratedAt string      `json:"generatedAt"`
	Breakdown   []AspectRow `json:"breakdown"`
}

type FinanceIssue struct {
	Id          string  `json:"id"`
	Queue       string  `json:"queue"`
	EntityType  string  `json:"entityType"`
	EntityId    string  `json:"entityId"`
	Reference   string  `json:"reference"`
	Summary     string  `json:"summary"`
	Amount      *Money  `json:"amount"`
	Severity    string  `json:"severity"`
	SlaHours    int     `json:"slaHours"`
	DetectedAt  *string `json:"detectedAt"`
	ActionHref  string  `json:"actionHref"`
}

type IssuesResponse struct {
	Data        []FinanceIssue   `json:"data"`
	NextCursor  *string          `json:"nextCursor"`
	QueueCounts map[string]int64 `json:"queueCounts"`
}

type LookupHop struct {
	Store      string  `json:"store"`
	EntityType string  `json:"entityType"`
	EntityId   string  `json:"entityId"`
	Reference  string  `json:"reference"`
	Status     string  `json:"status"`
	Amount     *Money  `json:"amount"`
	OccurredAt *string `json:"occurredAt"`
	Detail     string  `json:"detail"`
	ActionHref string  `json:"actionHref"`
}

type LookupResult struct {
	Query         string      `json:"query"`
	Found         bool        `json:"found"`
	CheckedStores int         `json:"checkedStores"`
	Message       string      `json:"message"`
	Hops          []LookupHop `json:"hops"`
}

type FinanceReportSummary struct {
	Key         string `json:"key"`
	Title       string `json:"title"`
	Description string `json:"description"`
	LastExport  *string `json:"lastExport"`
}

type FinanceExportRecord struct {
	Id          string `json:"id"`
	ReportKey   string `json:"reportKey"`
	ActorId     string `json:"actorId"`
	ActorName   string `json:"actorName"`
	Reason      string `json:"reason"`
	OccurredAt  string `json:"occurredAt"`
}

type ReportsCatalog struct {
	Reports []FinanceReportSummary `json:"reports"`
	Recent  []FinanceExportRecord  `json:"recent"`
}

type ExportRequest struct {
	ReportType string `json:"reportType"`
	Range      string `json:"range"`
	Currency   string `json:"currency"`
	Reason     string `json:"reason"`
}

type PagedEscrows struct {
	Data       []EscrowRecord `json:"data"`
	NextCursor *string        `json:"nextCursor"`
}
