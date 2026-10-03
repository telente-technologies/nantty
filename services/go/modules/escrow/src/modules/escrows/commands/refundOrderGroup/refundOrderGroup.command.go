package refundordergroup

type Command struct {
	OrderGroupId   string `json:"orderGroupId"`
	StoreId        string `json:"storeId"`
	BuyerAccountId string `json:"buyerAccountId"`
	AmountMinor    int64  `json:"amountMinor"`
	Currency       string `json:"currency"`
	Reason         string `json:"reason"`
}
