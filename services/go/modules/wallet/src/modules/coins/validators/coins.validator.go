package validators

import (
	"regexp"

	ledgerutils "zudomart/modules/ledger/src/utils"
	"zudomart/modules/wallet/src/modules/coins/dtos"
)

var (
	packageIdPattern = regexp.MustCompile(`^[a-z0-9-]{2,60}$`)
	referencePattern = regexp.MustCompile(`^[A-Za-z0-9_:.-]{6,200}$`)
)

func IsValidPurchaseReference(reference string) bool { return referencePattern.MatchString(reference) }

func ValidateStartCoinPurchaseRequest(request dtos.StartCoinPurchaseRequestDto) error {
	collector := &ledgerutils.IssueCollector{}
	if !packageIdPattern.MatchString(request.PackageId) {
		collector.Add("packageId", "has an invalid format")
	}
	if request.Provider != "" {
		collector.RequireOneOf("provider", request.Provider, "paystack", "flutterwave")
	}
	collector.RequireLength("returnTo", request.ReturnTo, 0, 300)
	return collector.Result()
}

func ValidateStoreReceiptRequest(request dtos.StoreReceiptRequestDto) error {
	collector := &ledgerutils.IssueCollector{}
	collector.RequireOneOf("platform", request.Platform, "ios", "android")
	collector.RequireLength("productId", request.ProductId, 1, 200)
	collector.RequireLength("receipt", request.Receipt, 1, 20_000)
	collector.RequireLength("transactionId", request.TransactionId, 0, 200)
	return collector.Result()
}

func ValidateCoinTransferRequest(request dtos.CoinTransferRequestDto) error {
	collector := &ledgerutils.IssueCollector{}
	collector.RequireUuid("recipientUserId", request.RecipientUserId)
	collector.RequireRange("coins", request.Coins, 1, 100_000_000)
	collector.RequireLength("note", request.Note, 0, 140)
	return collector.Result()
}

func ValidateConvertEarnedCoinsRequest(request dtos.ConvertEarnedCoinsRequestDto) error {
	collector := &ledgerutils.IssueCollector{}
	collector.RequireRange("coins", request.Coins, 1, 100_000_000)
	if request.Currency != "" {
		collector.RequireOneOf("currency", request.Currency, "NGN", "GHS", "KES", "ZAR", "GBP", "EUR", "USD")
	}
	return collector.Result()
}
