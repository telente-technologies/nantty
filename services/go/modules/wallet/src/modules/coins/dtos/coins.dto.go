package dtos

import "time"

type MoneyDto struct {
	AmountMinor int64  `json:"amountMinor"`
	Currency    string `json:"currency"`
}

type CoinPackageDto struct {
	Id              string   `json:"id"`
	Name            string   `json:"name"`
	Coins           int64    `json:"coins"`
	BonusCoins      int64    `json:"bonusCoins"`
	TotalCoins      int64    `json:"totalCoins"`
	PurchaseChannel string   `json:"purchaseChannel"`
	ClientPlatform  string   `json:"clientPlatform"`
	StoreProductId  *string  `json:"storeProductId"`
	Price           MoneyDto `json:"price"`
	BillingNote     string   `json:"billingNote,omitempty"`
}

type CoinPackagePriceRowDto struct {
	Id             string           `json:"id"`
	Name           string           `json:"name"`
	ClientPlatform string           `json:"clientPlatform"`
	Coins          int64            `json:"coins"`
	BonusCoins     int64            `json:"bonusCoins"`
	Prices         map[string]int64 `json:"prices"`
	StoreProductId string           `json:"storeProductId"`
	Active         bool             `json:"active"`
	SortOrder      int              `json:"sortOrder"`
	Reason         string           `json:"reason,omitempty"`
}

type CoinBalanceDto struct {
	Coins       int64 `json:"coins"`
	EarnedCoins int64 `json:"earnedCoins"`
}

type CoinActivityEntryDto struct {
	Id            string    `json:"id"`
	TransactionId string    `json:"transactionId"`
	Type          string    `json:"type"`
	Kind          string    `json:"kind"`
	Coins         int64     `json:"coins"`
	BalanceAfter  int64     `json:"balanceAfter"`
	CreatedAt     time.Time `json:"createdAt"`
}

type StartCoinPurchaseRequestDto struct {
	PackageId string `json:"packageId"`
	Provider  string `json:"provider,omitempty"`
	ReturnTo  string `json:"returnTo,omitempty"`
}

type CoinPurchaseDto struct {
	Id        string    `json:"id"`
	Reference string    `json:"reference"`
	PackageId string    `json:"packageId"`
	Coins     int64     `json:"coins"`
	Channel   string    `json:"channel"`
	Source    string    `json:"source"`
	Amount    MoneyDto  `json:"amount"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
}

type StartedCoinPurchaseDto struct {
	Reference        string           `json:"reference"`
	PurchaseChannel  string           `json:"purchaseChannel"`
	AuthorizationUrl *string          `json:"authorizationUrl,omitempty"`
	CallbackUrl      *string          `json:"callbackUrl,omitempty"`
	StoreProductId   *string          `json:"storeProductId,omitempty"`
	Purchase         *CoinPurchaseDto `json:"purchase"`
	PaymentIntentId  string           `json:"paymentIntentId,omitempty"`
}

type VerifiedCoinPurchaseDto struct {
	Status   string          `json:"status"`
	Coins    int64           `json:"coins"`
	Balance  int64           `json:"balance"`
	Purchase CoinPurchaseDto `json:"purchase"`
}

type StoreReceiptRequestDto struct {
	Platform      string `json:"platform"`
	ProductId     string `json:"productId"`
	Receipt       string `json:"receipt"`
	TransactionId string `json:"transactionId,omitempty"`
}

type CoinTransferRequestDto struct {
	RecipientUserId string `json:"recipientUserId"`
	Coins           int64  `json:"coins"`
	Note            string `json:"note,omitempty"`
}

type CoinTransferQuoteDto struct {
	Coins      int64 `json:"coins"`
	FeeCoins   int64 `json:"feeCoins"`
	NetCoins   int64 `json:"netCoins"`
	FeePercent int64 `json:"feePercent"`
}

type CoinTransferReceiptDto struct {
	TransferId string `json:"transferId"`
	Coins      int64  `json:"coins"`
	FeeCoins   int64  `json:"feeCoins"`
	NetCoins   int64  `json:"netCoins"`
	Balance    int64  `json:"balance"`
}

type ConvertEarnedCoinsRequestDto struct {
	Coins    int64  `json:"coins"`
	Currency string `json:"currency,omitempty"`
}

type CoinConversionReceiptDto struct {
	Coins                int64    `json:"coins"`
	Cash                 MoneyDto `json:"cash"`
	EarnedCoinsRemaining int64    `json:"earnedCoinsRemaining"`
	MinimumPayout        MoneyDto `json:"minimumPayout"`
}
