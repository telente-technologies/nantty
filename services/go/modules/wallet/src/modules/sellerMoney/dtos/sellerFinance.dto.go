package dtos

import "zudomart/platform/money"

type EscrowEntryView struct {
	OrderId           string      `json:"orderId"`
	OrderNumber       string      `json:"orderNumber"`
	BuyerName         string      `json:"buyerName"`
	BuyerUsername     string      `json:"buyerUsername"`
	Gross             money.Money `json:"gross"`
	Fees              money.Money `json:"fees"`
	Net               money.Money `json:"net"`
	Status            string      `json:"status"`
	HeldAt            string      `json:"heldAt"`
	ReleaseExpectedAt *string     `json:"releaseExpectedAt"`
	ReleasedAt        *string     `json:"releasedAt"`
	SettlementId      *string     `json:"settlementId"`
}

type EscrowEntriesPage struct {
	Data           []EscrowEntryView      `json:"data"`
	NextCursor     *string                `json:"nextCursor"`
	CountsByStatus map[string]int         `json:"countsByStatus"`
	TotalsByStatus map[string]money.Money `json:"totalsByStatus"`
}

type SettlementView struct {
	Id          string      `json:"id"`
	Reference   string      `json:"reference"`
	PeriodStart string      `json:"periodStart"`
	PeriodEnd   string      `json:"periodEnd"`
	OrdersCount int         `json:"ordersCount"`
	Gross       money.Money `json:"gross"`
	Fees        money.Money `json:"fees"`
	Net         money.Money `json:"net"`
	Status      string      `json:"status"`
	SettledAt   string      `json:"settledAt"`
}

type SettlementDetailView struct {
	Settlement SettlementView    `json:"settlement"`
	Orders     []EscrowEntryView `json:"orders"`
}

type FeeLineView struct {
	Kind            string      `json:"kind"`
	Label           string      `json:"label"`
	Description     string      `json:"description"`
	RateBasisPoints *int        `json:"rateBasisPoints"`
	Count           int         `json:"count"`
	Amount          money.Money `json:"amount"`
}

type FeeBreakdownView struct {
	From        string        `json:"from"`
	To          string        `json:"to"`
	GrossSales  money.Money   `json:"grossSales"`
	TotalFees   money.Money   `json:"totalFees"`
	NetEarnings money.Money   `json:"netEarnings"`
	Lines       []FeeLineView `json:"lines"`
}

type RefundEntryView struct {
	Id           string      `json:"id"`
	OrderId      string      `json:"orderId"`
	OrderNumber  string      `json:"orderNumber"`
	BuyerName    string      `json:"buyerName"`
	Kind         string      `json:"kind"`
	Reason       string      `json:"reason"`
	Amount       money.Money `json:"amount"`
	FeesReturned money.Money `json:"feesReturned"`
	CreatedAt    string      `json:"createdAt"`
}

type FinanceSummaryView struct {
	From             string             `json:"from"`
	To               string             `json:"to"`
	Balances         WalletBalancesView `json:"balances"`
	GrossSales       money.Money        `json:"grossSales"`
	TotalFees        money.Money        `json:"totalFees"`
	Refunds          money.Money        `json:"refunds"`
	NetEarnings      money.Money        `json:"netEarnings"`
	PaidOut          money.Money        `json:"paidOut"`
	OrdersCount      int                `json:"ordersCount"`
	UpcomingReleases []EscrowEntryView  `json:"upcomingReleases"`
}

type StatementMonthView struct {
	Month             string      `json:"month"`
	OpeningBalance    money.Money `json:"openingBalance"`
	Credits           money.Money `json:"credits"`
	Debits            money.Money `json:"debits"`
	ClosingBalance    money.Money `json:"closingBalance"`
	TransactionsCount int         `json:"transactionsCount"`
}

type StatementLineView struct {
	WalletTransactionView
	RunningBalance money.Money `json:"runningBalance"`
}

type StatementDetailView struct {
	Summary      StatementMonthView  `json:"summary"`
	StoreName    string              `json:"storeName"`
	StoreAddress string              `json:"storeAddress"`
	GeneratedAt  string              `json:"generatedAt"`
	Lines        []StatementLineView `json:"lines"`
}
