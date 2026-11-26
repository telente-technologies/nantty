package models

import (
	"strings"
	"unicode"
)

var platformAccountNames = map[string]string{
	"platform:giftRevenue":                  "Gift revenue (coins)",
	"platform:coinTransferFees":             "Coin transfer fees",
	"platform:coinsInCirculation":           "Coins in circulation",
	"expense:unrecoveredCoinClawbacks":      "Unrecovered coin clawback losses",
	"revenue:commission":                    "Commission revenue",
	"revenue:escrowFees":                    "Escrow fee revenue",
	"revenue:ads":                           "Ad revenue",
	"revenue:coinSales":                     "Coin sales revenue",
	"revenue:creatorSubscriptions":          "Creator subscription revenue",
	"revenue:planSubscriptions":             "Plan subscription revenue",
	"liability:platformFeesUnearned":        "Unearned platform fees",
	"liability:paymentsAwaitingApplication": "Payments awaiting application",
	"expense:creatorCoinPayouts":            "Creator coin payouts",
	"expense:paymentProcessingFees":         "Payment processing fees",
	"expense:refundedProcessingFees":        "Refunded processing fees",
}

var ownedAccountPrefixes = map[string]string{"seller": "Seller", "creator": "Creator", "user": "User", "advertiser": "Advertiser", "live": "Live"}

func DescribeAccountCode(code string) string {
	base := PlatformAccountBaseCode(code)
	if name, known := platformAccountNames[base]; known {
		return name
	}
	parts := strings.Split(base, ":")
	switch {
	case len(parts) >= 3 && parts[0] == "asset" && parts[1] == "providerBalance":
		return "Provider balance (" + parts[2] + ")"
	case len(parts) >= 3 && parts[0] == "liability" && parts[1] == "refundsPayable":
		return "Refunds payable (" + parts[2] + ")"
	case len(parts) >= 3 && parts[0] == "expense" && parts[1] == "appStoreFees":
		return "App store fees (" + parts[2] + ")"
	}
	if owner, found := ownedAccountPrefixes[parts[0]]; found && len(parts) >= 3 {
		return owner + " " + strings.ToLower(splitCamelCase(strings.Join(parts[2:], " ")))
	}
	return splitCamelCase(strings.ReplaceAll(base, ":", " "))
}

func splitCamelCase(value string) string {
	var builder strings.Builder
	for index, character := range value {
		if index > 0 && unicode.IsUpper(character) {
			builder.WriteRune(' ')
		}
		builder.WriteRune(character)
	}
	return builder.String()
}
