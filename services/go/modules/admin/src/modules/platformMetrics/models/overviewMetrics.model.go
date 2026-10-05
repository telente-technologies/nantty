package models

type Money struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

type UserMetrics struct {
	Total             int64   `json:"total"`
	NewInRange        int64   `json:"newInRange"`
	DailyActive       int64   `json:"dailyActive"`
	MonthlyActive     int64   `json:"monthlyActive"`
	DailyActiveSeries []int64 `json:"dailyActiveSeries"`
}

type CommerceMetrics struct {
	OrdersInRange            int64   `json:"ordersInRange"`
	OrdersSeries             []int64 `json:"ordersSeries"`
	GmvByCurrency            []Money `json:"gmvByCurrency"`
	EscrowHeldByCurrency     []Money `json:"escrowHeldByCurrency"`
	EscrowReleasedByCurrency []Money `json:"escrowReleasedByCurrency"`
	DisputesOpen             int64   `json:"disputesOpen"`
}

type MoneyMetrics struct {
	PayoutsPendingCount      int64   `json:"payoutsPendingCount"`
	PayoutsPendingByCurrency []Money `json:"payoutsPendingByCurrency"`
	CreatorPayoutsByCurrency []Money `json:"creatorPayoutsByCurrency"`
	AdsSpendByCurrency       []Money `json:"adsSpendByCurrency"`
}

type TrustMetrics struct {
	ReportsPending      int64 `json:"reportsPending"`
	AppealsPending      int64 `json:"appealsPending"`
	CopyrightPending    int64 `json:"copyrightPending"`
	VerificationPending int64 `json:"verificationPending"`
}

type AttentionQueue struct {
	Key          string  `json:"key"`
	Label        string  `json:"label"`
	Href         string  `json:"href"`
	Count        int64   `json:"count"`
	OldestAt     *string `json:"oldestAt"`
	BreachingSla int64   `json:"breachingSla"`
}

type ServiceHealth struct {
	Name      string  `json:"name"`
	Status    string  `json:"status"`
	LatencyMs *int64  `json:"latencyMs"`
	Note      *string `json:"note"`
}

type OverviewMetrics struct {
	GeneratedAt string           `json:"generatedAt"`
	Range       string           `json:"range"`
	Users       UserMetrics      `json:"users"`
	Commerce    CommerceMetrics  `json:"commerce"`
	Money       MoneyMetrics     `json:"money"`
	Trust       TrustMetrics     `json:"trust"`
	Queues      []AttentionQueue `json:"queues"`
	Health      []ServiceHealth  `json:"health"`
}
