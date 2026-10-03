package constants

const (
	PurposeOrderCheckout       = "order_checkout"
	PurposeCoinPurchase        = "coin_purchase"
	PurposeWalletTopUp         = "wallet_top_up"
	PurposeCreatorSubscription = "creator_subscription"
	PurposeWithdrawal          = "withdrawal"

	ProviderPaystack    = "paystack"
	ProviderFlutterwave = "flutterwave"
	StoreAppleIap       = "apple_iap"
	StoreGooglePlay     = "google_play"
)

var ReferencePrefixByPurpose = map[string]string{
	PurposeOrderCheckout:       "zmpay_",
	PurposeCoinPurchase:        "zmcoin_",
	PurposeWalletTopUp:         "zmtop_",
	PurposeCreatorSubscription: "zmcsub_",
}
