package services

import (
	"strconv"
	"strings"

	"nantty/modules/creators/src/generated/ent"
)

func FormatCommissionPercent(bps int64) string {
	whole, fraction := bps/100, bps%100
	if fraction == 0 {
		return strconv.FormatInt(whole, 10) + "%"
	}
	return strings.TrimRight(strconv.FormatInt(whole, 10)+"."+strconv.FormatInt(100+fraction, 10)[1:], "0") + "%"
}

func creatorLabel(commission *ent.AffiliateCommission) string {
	if commission.CreatorHandle == "" {
		return "a creator"
	}
	return "@" + commission.CreatorHandle
}

func storeLabel(commission *ent.AffiliateCommission) string {
	if commission.StoreName == "" {
		return "the store"
	}
	return commission.StoreName
}

func orderLabel(commission *ent.AffiliateCommission) string {
	label := "order"
	if commission.OrderNumber != "" {
		label = "order #" + strings.TrimPrefix(commission.OrderNumber, "#")
	}
	if commission.ProductName != "" {
		label += " (" + commission.ProductName + ")"
	}
	return label
}

func SellerCommissionDebitDescription(commission *ent.AffiliateCommission) string {
	return "Affiliate commission to " + creatorLabel(commission) + ", " + FormatCommissionPercent(commission.CommissionBps) + " on " + orderLabel(commission)
}

func CreatorCommissionCreditDescription(commission *ent.AffiliateCommission) string {
	return "Affiliate commission from " + storeLabel(commission) + ", " + orderLabel(commission)
}

func SellerCommissionTransferFailedDescription(commission *ent.AffiliateCommission) string {
	return "Affiliate commission to " + creatorLabel(commission) + " could not be sent and was returned, " + orderLabel(commission)
}

func CreatorCommissionReversalDescription(commission *ent.AffiliateCommission) string {
	return "Affiliate commission reversed to " + storeLabel(commission) + " after a refund, " + orderLabel(commission)
}

func SellerCommissionReversalCreditDescription(commission *ent.AffiliateCommission) string {
	return "Affiliate commission returned by " + creatorLabel(commission) + " after a refund, " + orderLabel(commission)
}

func CreatorCommissionReversalFailedDescription(commission *ent.AffiliateCommission) string {
	return "Affiliate commission reversal to " + storeLabel(commission) + " could not be sent and was returned, " + orderLabel(commission)
}

func SellerCommissionShortfallDescription(commission *ent.AffiliateCommission) string {
	return "Affiliate commission refund covered by Zudomart while " + creatorLabel(commission) + " repays it, " + orderLabel(commission)
}
