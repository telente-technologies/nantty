package dtos

import "zudomart/modules/ads/src/types"

type BoostBudgetChangeRequest struct {
	ExtraDays        int          `json:"extraDays"`
	DailyBudget      *types.Money `json:"dailyBudget,omitempty"`
	AdditionalBudget *types.Money `json:"additionalBudget,omitempty"`
	PaymentMethod    string       `json:"paymentMethod,omitempty"`
}

type BoostBudgetQuote struct {
	AdditionalCost  types.Money     `json:"additionalCost"`
	NewDailyBudget  types.Money     `json:"newDailyBudget"`
	NewTotalBudget  types.Money     `json:"newTotalBudget"`
	NewDurationDays int             `json:"newDurationDays"`
	NewEndsAt       *string         `json:"newEndsAt"`
	PaymentOptions  []PaymentOption `json:"paymentOptions"`
}

type BoostBudgetChange struct {
	Id             string      `json:"id"`
	Status         string      `json:"status"`
	AdditionalCost types.Money `json:"additionalCost"`
}

type BoostBudgetChangeResult struct {
	Boost       Boost             `json:"boost"`
	Change      BoostBudgetChange `json:"change"`
	CheckoutUrl *string           `json:"checkoutUrl"`
}

type BoostReportTotals struct {
	Impressions   int64        `json:"impressions"`
	Reach         int64        `json:"reach"`
	Clicks        int64        `json:"clicks"`
	Results       int64        `json:"results"`
	Spend         types.Money  `json:"spend"`
	CostPerResult *types.Money `json:"costPerResult"`
}

type BoostReportPoint struct {
	Date        string      `json:"date"`
	Impressions int64       `json:"impressions"`
	Reach       int64       `json:"reach"`
	Clicks      int64       `json:"clicks"`
	Results     int64       `json:"results"`
	Spend       types.Money `json:"spend"`
}

type BoostReport struct {
	Currency    string             `json:"currency"`
	ResultLabel string             `json:"resultLabel"`
	Totals      BoostReportTotals  `json:"totals"`
	Series      []BoostReportPoint `json:"series"`
}

type AdBalanceTopUpOptions struct {
	Available  bool          `json:"available"`
	ReasonCode *string       `json:"reasonCode"`
	Reason     *string       `json:"reason"`
	Minimum    types.Money   `json:"minimum"`
	Maximum    types.Money   `json:"maximum"`
	Suggested  []types.Money `json:"suggested"`
}

type AdCreditLotView struct {
	Id        string      `json:"id"`
	Source    string      `json:"source"`
	Remaining types.Money `json:"remaining"`
	ExpiresAt *string     `json:"expiresAt"`
	Reason    *string     `json:"reason"`
	CreatedAt string      `json:"createdAt"`
}

type AdCashbackView struct {
	Enabled bool `json:"enabled"`
	Percent int  `json:"percent"`
}

type AdBalanceWithdrawalOptions struct {
	Available  bool        `json:"available"`
	ReasonCode *string     `json:"reasonCode"`
	Reason     *string     `json:"reason"`
	Minimum    types.Money `json:"minimum"`
}

type AdBalanceView struct {
	AccountId         *string                    `json:"accountId"`
	Balance           types.Money                `json:"balance"`
	Credit            types.Money                `json:"credit"`
	Committed         types.Money                `json:"committed"`
	Spendable         types.Money                `json:"spendable"`
	Withdrawable      types.Money                `json:"withdrawable"`
	PendingSettlement types.Money                `json:"pendingSettlement"`
	CreditLots        []AdCreditLotView          `json:"creditLots"`
	Cashback          AdCashbackView             `json:"cashback"`
	TopUp             AdBalanceTopUpOptions      `json:"topUp"`
	Withdrawal        AdBalanceWithdrawalOptions `json:"withdrawal"`
}

type AdBalanceTransaction struct {
	Id          string      `json:"id"`
	Pot         string      `json:"pot"`
	Kind        string      `json:"kind"`
	Amount      types.Money `json:"amount"`
	Description string      `json:"description"`
	CreatedAt   string      `json:"createdAt"`
}

type AdBalanceWithdrawalRequest struct {
	Amount types.Money `json:"amount"`
}

type AdBalanceWithdrawalQuote struct {
	Amount       types.Money `json:"amount"`
	Fee          types.Money `json:"fee"`
	Net          types.Money `json:"net"`
	Destination  string      `json:"destination"`
	Withdrawable types.Money `json:"withdrawable"`
}

type AdBalanceWithdrawalView struct {
	Id          string      `json:"id"`
	Status      string      `json:"status"`
	Amount      types.Money `json:"amount"`
	Fee         types.Money `json:"fee"`
	Net         types.Money `json:"net"`
	Destination string      `json:"destination"`
	CreatedAt   string      `json:"createdAt"`
}

type AdBalanceTopUpRequest struct {
	Amount types.Money `json:"amount"`
}

type AdBalanceTopUp struct {
	TopUpId     string `json:"topUpId"`
	Reference   string `json:"reference"`
	CheckoutUrl string `json:"checkoutUrl"`
}
