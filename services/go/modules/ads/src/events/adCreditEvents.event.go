package events

type AdCreditChangedEventData struct {
	EntryId        string `json:"entryId"`
	LotId          string `json:"lotId"`
	AccountId      string `json:"accountId"`
	UserId         string `json:"userId"`
	Currency       string `json:"currency"`
	AmountMinor    int64  `json:"amountMinor"`
	Kind           string `json:"kind"`
	Source         string `json:"source"`
	IdempotencyKey string `json:"idempotencyKey"`
}

type AdSpendRefundedEventData struct {
	BatchId        string `json:"batchId"`
	AccountId      string `json:"accountId"`
	Currency       string `json:"currency"`
	BalanceMinor   int64  `json:"balanceMinor"`
	CreditMinor    int64  `json:"creditMinor"`
	Reason         string `json:"reason"`
	IdempotencyKey string `json:"idempotencyKey"`
}
