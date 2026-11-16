package src

import (
	"fmt"
	"math"
	"strings"

	affiliateservices "nantty/modules/creators/src/modules/affiliates/services"
	moneyservices "nantty/modules/creators/src/modules/creatorMoney/services"
	platformevents "nantty/platform/events"
	platformmoney "nantty/platform/money"
)

func validateCreatorSubscriptionPaidEvent(paid moneyservices.CreatorSubscriptionPaid) error {
	amountCurrency, amountErr := platformmoney.ParseCurrencyCode(paid.Amount.Currency)
	shareCurrency, shareErr := platformmoney.ParseCurrencyCode(paid.CreatorShare.Currency)
	if paid.SubscriptionId == "" || paid.ChargeId == "" || paid.CreatorId == "" || paid.Kind == "" || paid.Reference == "" ||
		paid.Reference != "creator-subscription-charge:"+paid.ChargeId ||
		paid.Amount.AmountMinor <= 0 || paid.CreatorShare.AmountMinor < 0 || amountErr != nil || shareErr != nil ||
		amountCurrency != shareCurrency || paid.CreatorShare.AmountMinor > paid.Amount.AmountMinor {
		return fmt.Errorf("%w: invalid creatorSubscription.paid financial payload", platformevents.ErrPoisonMessage)
	}
	return nil
}

func validateCreatorSubscriptionRefundedEvent(refunded moneyservices.CreatorSubscriptionRefunded) error {
	recoveredCurrency, recoveredErr := platformmoney.ParseCurrencyCode(refunded.Recovered.Currency)
	shortfallCurrency, shortfallErr := platformmoney.ParseCurrencyCode(refunded.Shortfall.Currency)
	if refunded.SubscriptionId == "" || refunded.ChargeId == "" || refunded.CreatorId == "" ||
		refunded.Recovered.AmountMinor < 0 || refunded.Shortfall.AmountMinor < 0 || recoveredErr != nil || shortfallErr != nil ||
		recoveredCurrency != shortfallCurrency || refunded.Recovered.AmountMinor > math.MaxInt64-refunded.Shortfall.AmountMinor {
		return fmt.Errorf("%w: invalid creatorSubscription.refunded financial payload", platformevents.ErrPoisonMessage)
	}
	return nil
}

func validateAdCreatorEarningsPostedEvent(posted moneyservices.AdCreatorEarningsPosted) error {
	if _, err := platformmoney.ParseCurrencyCode(posted.Currency); posted.CreatorUserId == "" || posted.BatchId == "" ||
		posted.IdempotencyKey != "adCreator:"+posted.BatchId+":"+posted.CreatorUserId || posted.AmountMinor <= 0 || err != nil {
		return fmt.Errorf("%w: invalid adCreatorEarnings.posted financial payload", platformevents.ErrPoisonMessage)
	}
	return nil
}

func validateAffiliateOrderGroupEvent(orderGroupId, storeId, sellerAccountId, buyerAccountId, currency string, items []affiliateservices.AttributedItem) error {
	if orderGroupId == "" || storeId == "" || sellerAccountId == "" || buyerAccountId == "" {
		return fmt.Errorf("%w: affiliate order event is missing required order or account identifiers", platformevents.ErrPoisonMessage)
	}
	if _, err := platformmoney.ParseCurrencyCode(currency); err != nil {
		return fmt.Errorf("%w: affiliate order event has invalid currency", platformevents.ErrPoisonMessage)
	}
	for _, item := range items {
		itemCurrency := strings.ToUpper(item.Currency)
		if item.OrderItemId == "" || item.ProductId == "" || item.VariantId == "" || item.Quantity <= 0 || item.LineTotalMinor <= 0 ||
			item.AttributionId == "" || (item.AttributionSource != "post" && item.AttributionSource != "clip" && item.AttributionSource != "live" && item.AttributionSource != "link") ||
			itemCurrency != currency || (item.CommissionBps != nil && (*item.CommissionBps < 0 || *item.CommissionBps > 10_000)) {
			return fmt.Errorf("%w: affiliate order event contains an invalid attributed item", platformevents.ErrPoisonMessage)
		}
	}
	return nil
}

func validateOrderGroupCompletedAffiliateEvent(completed affiliateservices.OrderGroupCompleted) error {
	if err := validateAffiliateOrderGroupEvent(completed.OrderGroupId, completed.StoreId, completed.SellerAccountId, completed.BuyerAccountId, completed.Currency, completed.AttributedItems); err != nil {
		return err
	}
	if completed.OrderNumber == "" || completed.SubtotalMinor < 0 || completed.TotalMinor < 0 || completed.RefundedMinor < 0 || completed.RefundedMinor > completed.TotalMinor {
		return fmt.Errorf("%w: invalid orderGroup.completed amount or order number", platformevents.ErrPoisonMessage)
	}
	return nil
}

func validateOrderGroupPaidAffiliateEvent(paid affiliateservices.OrderGroupPaid) error {
	if err := validateAffiliateOrderGroupEvent(paid.OrderGroupId, paid.StoreId, paid.SellerAccountId, paid.BuyerAccountId, paid.Currency, paid.AttributedItems); err != nil {
		return err
	}
	if paid.OrderNumber == "" {
		return fmt.Errorf("%w: orderGroup.paid is missing order number", platformevents.ErrPoisonMessage)
	}
	return nil
}

func validateOrderGroupStatusChangedAffiliateEvent(changed affiliateservices.OrderGroupStatusChanged) error {
	if changed.OrderGroupId == "" || changed.From == "" || changed.To == "" {
		return fmt.Errorf("%w: orderGroup.statusChanged is missing order or transition fields", platformevents.ErrPoisonMessage)
	}
	return nil
}

func validateEscrowAffiliateRefundEvent(refund affiliateservices.EscrowRefunded) error {
	amountCurrency, amountErr := platformmoney.ParseCurrencyCode(refund.Amount.Currency)
	refundedCurrency, refundedErr := platformmoney.ParseCurrencyCode(refund.Refunded.Currency)
	if refund.OrderId == "" || refund.EscrowId == "" || refund.Status == "" || refund.Amount.AmountMinor <= 0 || refund.Refunded.AmountMinor <= 0 ||
		amountErr != nil || refundedErr != nil || amountCurrency != refundedCurrency || refund.Refunded.AmountMinor > refund.Amount.AmountMinor {
		return fmt.Errorf("%w: invalid escrow refund payload for affiliate reversal", platformevents.ErrPoisonMessage)
	}
	return nil
}

func validateCreatorApplicationApprovedEvent(accountId string) error {
	if strings.TrimSpace(accountId) == "" {
		return fmt.Errorf("%w: creatorApplication.approved is missing accountId", platformevents.ErrPoisonMessage)
	}
	return nil
}
