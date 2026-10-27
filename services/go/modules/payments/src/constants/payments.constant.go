package constants

const (
	PurposeOrderCheckout       = "order_checkout"
	PurposeCoinPurchase        = "coin_purchase"
	PurposeWalletTopUp         = "wallet_top_up"
	PurposeCreatorSubscription = "creator_subscription"
	PurposeWithdrawal          = "withdrawal"
	PurposeCreatorEarnings     = "creator_earnings"
	PurposeAdBalanceTopUp      = "ad_balance_top_up"
	PurposeRefundBankPayout    = "refund_bank_payout"
	PurposeSubscription        = "subscription"
	PurposeCardVerification    = "card_verification"
	PurposeSubscriptionRenewal = "subscription_renewal"

	ProviderFlutterwave = "flutterwave"
	StoreAppleIap       = "apple_iap"
	StoreGooglePlay     = "google_play"

	ConnectedAccountRoleSeller  = "seller"
	ConnectedAccountRoleCreator = "creator"

	AppPaymentReturnUrl = "nantty://payments/return"
)

var ReferencePrefixByPurpose = map[string]string{
	PurposeOrderCheckout:       "chk-",
	PurposeCoinPurchase:        "coin-",
	PurposeWalletTopUp:         "top-",
	PurposeCreatorSubscription: "csub-",
	PurposeAdBalanceTopUp:      "ads-",
	PurposeCardVerification:    "card-",
	PurposeSubscriptionRenewal: "ren-",
}
