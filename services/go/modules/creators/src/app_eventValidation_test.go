package src

import (
	"errors"
	"math"
	"testing"

	affiliateservices "nantty/modules/creators/src/modules/affiliates/services"
	moneyservices "nantty/modules/creators/src/modules/creatorMoney/services"
	platformevents "nantty/platform/events"
)

func TestCreatorMoneyEventValidatorsRejectFinancialPayloadsThatWouldBeAcknowledgedAsNoOps(t *testing.T) {
	validPaid := moneyservices.CreatorSubscriptionPaid{
		SubscriptionId: "subscription-1", ChargeId: "charge-1", CreatorId: "creator-1", Kind: "initial", Reference: "creator-subscription-charge:charge-1",
		Amount: moneyservices.Money{AmountMinor: 1_000, Currency: "NGN"}, CreatorShare: moneyservices.Money{AmountMinor: 800, Currency: "NGN"},
	}
	validRefunded := moneyservices.CreatorSubscriptionRefunded{
		SubscriptionId: "subscription-1", ChargeId: "charge-1", CreatorId: "creator-1",
		Recovered: moneyservices.Money{AmountMinor: 500, Currency: "NGN"}, Shortfall: moneyservices.Money{AmountMinor: 300, Currency: "NGN"},
	}
	validAds := moneyservices.AdCreatorEarningsPosted{CreatorUserId: "creator-1", Currency: "NGN", AmountMinor: 250, BatchId: "batch-1", IdempotencyKey: "adCreator:batch-1:creator-1"}

	tests := []struct {
		name string
		err  error
	}{
		{name: "paid event missing charge", err: validateCreatorSubscriptionPaidEvent(moneyservices.CreatorSubscriptionPaid{CreatorId: "creator-1"})},
		{name: "paid event mismatched currency", err: validateCreatorSubscriptionPaidEvent(func() moneyservices.CreatorSubscriptionPaid {
			paid := validPaid
			paid.CreatorShare.Currency = "USD"
			return paid
		}())},
		{name: "paid reference does not match charge", err: validateCreatorSubscriptionPaidEvent(func() moneyservices.CreatorSubscriptionPaid {
			paid := validPaid
			paid.Reference = "creator-subscription-charge:other-charge"
			return paid
		}())},
		{name: "paid share exceeds gross", err: validateCreatorSubscriptionPaidEvent(func() moneyservices.CreatorSubscriptionPaid {
			paid := validPaid
			paid.CreatorShare.AmountMinor = 1_001
			return paid
		}())},
		{name: "refund negative shortfall", err: validateCreatorSubscriptionRefundedEvent(func() moneyservices.CreatorSubscriptionRefunded {
			refunded := validRefunded
			refunded.Shortfall.AmountMinor = -1
			return refunded
		}())},
		{name: "refund amount overflow", err: validateCreatorSubscriptionRefundedEvent(func() moneyservices.CreatorSubscriptionRefunded {
			refunded := validRefunded
			refunded.Recovered.AmountMinor = math.MaxInt64
			return refunded
		}())},
		{name: "refund currency mismatch", err: validateCreatorSubscriptionRefundedEvent(func() moneyservices.CreatorSubscriptionRefunded {
			refunded := validRefunded
			refunded.Shortfall.Currency = "USD"
			return refunded
		}())},
		{name: "ad event idempotency key does not match owner", err: validateAdCreatorEarningsPostedEvent(func() moneyservices.AdCreatorEarningsPosted {
			posted := validAds
			posted.IdempotencyKey = "adCreator:batch-1:another-creator"
			return posted
		}())},
		{name: "ad event malformed currency", err: validateAdCreatorEarningsPostedEvent(func() moneyservices.AdCreatorEarningsPosted {
			posted := validAds
			posted.Currency = "N"
			return posted
		}())},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if !errors.Is(test.err, platformevents.ErrPoisonMessage) {
				t.Fatalf("invalid financial payload must be poison, got %v", test.err)
			}
		})
	}
	if err := validateCreatorSubscriptionPaidEvent(func() moneyservices.CreatorSubscriptionPaid {
		paid := validPaid
		paid.CreatorShare.AmountMinor = 0
		return paid
	}()); err != nil {
		t.Fatalf("a valid zero-share charge should not be rejected: %v", err)
	}
	if err := validateCreatorSubscriptionPaidEvent(validPaid); err != nil {
		t.Fatalf("valid paid event: %v", err)
	}
	if err := validateCreatorSubscriptionRefundedEvent(validRefunded); err != nil {
		t.Fatalf("valid refund event: %v", err)
	}
	if err := validateAdCreatorEarningsPostedEvent(validAds); err != nil {
		t.Fatalf("valid ads event: %v", err)
	}
}

func TestAffiliateOrderEventValidatorsRejectPayloadsThatWouldDropAffiliateWork(t *testing.T) {
	validItem := affiliateservices.AttributedItem{
		OrderItemId: "order-item-1", ProductId: "product-1", VariantId: "variant-1", Quantity: 1, LineTotalMinor: 5_000,
		Currency: "NGN", AttributionSource: "post", AttributionId: "post-1",
	}
	validPaid := affiliateservices.OrderGroupPaid{
		OrderGroupId: "order-1", OrderNumber: "NAT-1", StoreId: "store-1", SellerAccountId: "seller-1", BuyerAccountId: "buyer-1",
		Currency: "NGN", AttributedItems: []affiliateservices.AttributedItem{validItem},
	}
	validCompleted := affiliateservices.OrderGroupCompleted{
		OrderGroupId: "order-1", OrderNumber: "NAT-1", StoreId: "store-1", SellerAccountId: "seller-1", BuyerAccountId: "buyer-1",
		Currency: "NGN", SubtotalMinor: 5_000, TotalMinor: 5_500, RefundedMinor: 0, AttributedItems: []affiliateservices.AttributedItem{validItem},
	}
	validEscrowRefund := affiliateservices.EscrowRefunded{
		EscrowId: "escrow-1", OrderId: "order-1", Status: "partiallyRefunded",
		Amount: affiliateservices.Money{AmountMinor: 5_500, Currency: "NGN"}, Refunded: affiliateservices.Money{AmountMinor: 500, Currency: "NGN"},
	}
	tests := []struct {
		name string
		err  error
	}{
		{name: "paid missing order id", err: validateOrderGroupPaidAffiliateEvent(func() affiliateservices.OrderGroupPaid { value := validPaid; value.OrderGroupId = ""; return value }())},
		{name: "paid malformed currency", err: validateOrderGroupPaidAffiliateEvent(func() affiliateservices.OrderGroupPaid { value := validPaid; value.Currency = "N"; return value }())},
		{name: "paid malformed attributed line", err: validateOrderGroupPaidAffiliateEvent(func() affiliateservices.OrderGroupPaid {
			value := validPaid
			value.AttributedItems = []affiliateservices.AttributedItem{func() affiliateservices.AttributedItem {
				item := validItem
				item.AttributionSource = "unknown"
				return item
			}()}
			return value
		}())},
		{name: "paid attributed currency mismatch", err: validateOrderGroupPaidAffiliateEvent(func() affiliateservices.OrderGroupPaid {
			value := validPaid
			value.AttributedItems = []affiliateservices.AttributedItem{func() affiliateservices.AttributedItem { item := validItem; item.Currency = "USD"; return item }()}
			return value
		}())},
		{name: "completed refunded amount exceeds total", err: validateOrderGroupCompletedAffiliateEvent(func() affiliateservices.OrderGroupCompleted {
			value := validCompleted
			value.RefundedMinor = value.TotalMinor + 1
			return value
		}())},
		{name: "status changed missing target state", err: validateOrderGroupStatusChangedAffiliateEvent(affiliateservices.OrderGroupStatusChanged{OrderGroupId: "order-1", From: "new"})},
		{name: "escrow refund missing escrow id", err: validateEscrowAffiliateRefundEvent(func() affiliateservices.EscrowRefunded { value := validEscrowRefund; value.EscrowId = ""; return value }())},
		{name: "escrow refund currency mismatch", err: validateEscrowAffiliateRefundEvent(func() affiliateservices.EscrowRefunded {
			value := validEscrowRefund
			value.Refunded.Currency = "USD"
			return value
		}())},
		{name: "escrow refund exceeds original amount", err: validateEscrowAffiliateRefundEvent(func() affiliateservices.EscrowRefunded {
			value := validEscrowRefund
			value.Refunded.AmountMinor = value.Amount.AmountMinor + 1
			return value
		}())},
		{name: "creator approval missing account", err: validateCreatorApplicationApprovedEvent("  ")},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if !errors.Is(test.err, platformevents.ErrPoisonMessage) {
				t.Fatalf("invalid affiliate event must be poison, got %v", test.err)
			}
		})
	}
	if err := validateOrderGroupPaidAffiliateEvent(validPaid); err != nil {
		t.Fatalf("valid paid event: %v", err)
	}
	if err := validateOrderGroupCompletedAffiliateEvent(validCompleted); err != nil {
		t.Fatalf("valid completed event: %v", err)
	}
	validPaid.AttributedItems = nil
	if err := validateOrderGroupPaidAffiliateEvent(validPaid); err != nil {
		t.Fatalf("valid order without affiliate attribution should be accepted: %v", err)
	}
	if err := validateOrderGroupStatusChangedAffiliateEvent(affiliateservices.OrderGroupStatusChanged{OrderGroupId: "order-1", From: "new", To: "cancelled"}); err != nil {
		t.Fatalf("valid status transition: %v", err)
	}
	if err := validateEscrowAffiliateRefundEvent(validEscrowRefund); err != nil {
		t.Fatalf("valid escrow refund: %v", err)
	}
	if err := validateCreatorApplicationApprovedEvent("creator-1"); err != nil {
		t.Fatalf("valid creator approval: %v", err)
	}
}
