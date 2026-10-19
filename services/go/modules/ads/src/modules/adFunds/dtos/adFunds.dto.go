package dtos

import "zudomart/modules/ads/src/types"

type StaffReference struct {
	Id   string `json:"id"`
	Name string `json:"name"`
}

type AdminAdCredit struct {
	Id            string          `json:"id"`
	UserId        string          `json:"userId"`
	Username      string          `json:"username"`
	AccountId     string          `json:"accountId"`
	Source        string          `json:"source"`
	Amount        types.Money     `json:"amount"`
	Remaining     types.Money     `json:"remaining"`
	ExpiresAt     *string         `json:"expiresAt"`
	Reason        string          `json:"reason"`
	Status        string          `json:"status"`
	IssuedBy      *StaffReference `json:"issuedBy"`
	CreatedAt     string          `json:"createdAt"`
	RevokedAt     *string         `json:"revokedAt"`
	RevokedAmount *types.Money    `json:"revokedAmount"`
}

type IssueAdCreditRequest struct {
	UserId    string      `json:"userId"`
	Amount    types.Money `json:"amount"`
	ExpiresAt *string     `json:"expiresAt"`
	Reason    string      `json:"reason"`
}

type RevokeAdCreditRequest struct {
	Reason string `json:"reason"`
}

type AdminCashbackSetting struct {
	UserId    string          `json:"userId"`
	Username  string          `json:"username"`
	Enabled   bool            `json:"enabled"`
	Percent   int             `json:"percent"`
	Reason    string          `json:"reason"`
	UpdatedAt string          `json:"updatedAt"`
	UpdatedBy *StaffReference `json:"updatedBy"`
}

type SetCashbackRequest struct {
	Enabled bool   `json:"enabled"`
	Percent int    `json:"percent"`
	Reason  string `json:"reason"`
}

type SpendRefundRequest struct {
	AmountMinor int64  `json:"amountMinor"`
	Reason      string `json:"reason"`
	Reference   string `json:"reference"`
}

type SpendRefundResult struct {
	BatchId             string `json:"batchId"`
	BalanceMinor        int64  `json:"balanceMinor"`
	CreditMinor         int64  `json:"creditMinor"`
	CashbackReversed    int64  `json:"cashbackReversedMinor"`
	RemainingRefundable int64  `json:"remainingRefundableMinor"`
}
