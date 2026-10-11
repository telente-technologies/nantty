package services

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/enums"
	"zudomart/modules/orders/src/events"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/cartitem"
	"zudomart/modules/orders/src/generated/ent/invoicecounter"
	"zudomart/modules/orders/src/generated/ent/ordergroup"
	"zudomart/modules/orders/src/generated/ent/predicate"
	"zudomart/modules/orders/src/generated/ent/promotion"
	"zudomart/modules/orders/src/generated/ent/promotionredemption"
	"zudomart/platform/httpserver"
	"zudomart/platform/usersdirectory"
)

const referenceAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

func NewOrderReference() string {
	bytes := make([]byte, 8)
	_, _ = rand.Read(bytes)
	var builder strings.Builder
	builder.WriteString("ZM-")
	for _, value := range bytes {
		builder.WriteByte(referenceAlphabet[int(value)%len(referenceAlphabet)])
	}
	return builder.String()
}

type persistedCheckout struct {
	Checkout *ent.Checkout
	Groups   []*ent.OrderGroup
}

func persistCheckout(ctx context.Context, deployed *container.Container, tx *ent.Tx, request CheckoutRequest, plan CheckoutPlan, checkoutId uuid.UUID, reservedGroups map[uuid.UUID]bool, buyer usersdirectory.ProfileName) (persistedCheckout, error) {
	now := deployed.Now()
	checkout, err := tx.Checkout.Create().SetID(checkoutId).SetBuyerAccountID(request.BuyerId).SetIdempotencyKey(request.IdempotencyKey).SetRequestHash(request.Fingerprint()).
		SetCurrency(string(plan.Currency)).SetTotalMinor(plan.TotalMinor).SetAddress(plan.Address).SetStockReserved(len(reservedGroups) > 0).SetExpiresAt(now.Add(deployed.Settings.CheckoutReservationTtl)).Save(ctx)
	if err != nil {
		return persistedCheckout{}, err
	}
	result := persistedCheckout{Checkout: checkout}
	for _, planned := range plan.Groups {
		group, err := persistOrderGroup(ctx, deployed, tx, checkout, planned, plan, request, buyer, reservedGroups[planned.GroupId])
		if err != nil {
			return persistedCheckout{}, err
		}
		result.Groups = append(result.Groups, group)
	}
	if _, err := tx.CartItem.Delete().Where(cartitem.IDIn(plan.ConsumedItems...)).Exec(ctx); err != nil {
		return persistedCheckout{}, err
	}
	err = events.EnqueueOutboxEventInTransaction(ctx, tx, "order.created", checkout.ID.String(), now, map[string]any{
		"checkoutId": checkout.ID, "buyerAccountId": request.BuyerId, "currency": plan.Currency, "totalMinor": plan.TotalMinor, "orderGroupCount": len(result.Groups),
	})
	return result, err
}

func NextInvoiceNumber(ctx context.Context, tx *ent.Tx, storeId uuid.UUID) (string, error) {
	existing, err := tx.OrderGroup.Query().Where(ordergroup.StoreID(storeId)).Count(ctx)
	if err != nil {
		return "", err
	}
	err = tx.InvoiceCounter.Create().SetID(storeId).SetLastNumber(existing).OnConflictColumns(invoicecounter.FieldID).DoNothing().Exec(ctx)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}
	counter, err := tx.InvoiceCounter.Query().Where(invoicecounter.ID(storeId)).ForUpdate().Only(ctx)
	if err != nil {
		return "", err
	}
	next := counter.LastNumber + 1
	if err := tx.InvoiceCounter.UpdateOne(counter).SetLastNumber(next).Exec(ctx); err != nil {
		return "", err
	}
	return fmt.Sprintf("INV-%d", 10000+next), nil
}

func persistOrderGroup(ctx context.Context, deployed *container.Container, tx *ent.Tx, checkout *ent.Checkout, planned PlannedGroup, plan CheckoutPlan, request CheckoutRequest, buyer usersdirectory.ProfileName, stockReserved bool) (*ent.OrderGroup, error) {
	now := deployed.Now()
	invoice, err := NextInvoiceNumber(ctx, tx, planned.Group.StoreId)
	if err != nil {
		return nil, err
	}
	group, err := tx.OrderGroup.Create().SetID(planned.GroupId).SetCheckoutID(checkout.ID).SetReference(NewOrderReference()).SetInvoiceNumber(invoice).SetStoreID(planned.Group.StoreId).
		SetSellerAccountID(planned.Store.OwnerAccountId).SetBuyerAccountID(request.BuyerId).SetBuyerName(buyer.Name).SetBuyerUsername(buyer.Handle).
		SetCurrency(string(plan.Currency)).SetSubtotalMinor(planned.Group.SubtotalMinor).SetDiscountMinor(planned.DiscountMinor).SetNillablePromotionID(promotionIdOf(planned)).SetStoreCreditMinor(planned.CreditMinor).SetShippingMinor(planned.Shipping.FeeMinor).
		SetTotalMinor(planned.TotalMinor).SetAddress(plan.Address).SetPaymentMode(planned.PaymentMode).SetStockReserved(stockReserved).Save(ctx)
	if err != nil {
		return nil, err
	}
	if err := RedeemPromotionInTransaction(ctx, tx, group, planned); err != nil {
		return nil, err
	}
	if err := redeemCampaigns(ctx, tx, group, planned.Campaigns); err != nil {
		return nil, err
	}
	for _, line := range planned.Group.Lines {
		if err := createOrderItem(ctx, tx, group, line); err != nil {
			return nil, err
		}
	}
	if err := recordShippingSnapshot(ctx, tx, group, planned, plan); err != nil {
		return nil, err
	}
	if planned.CreditMinor > 0 {
		state, err := CreditStateInTransaction(ctx, tx, group.StoreID, group.BuyerAccountID, now)
		if err != nil {
			return nil, err
		}
		if state.BalanceMinor < planned.CreditMinor {
			return nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "creditMinor", Message: "insufficient store credit balance"}})
		}
		if err := recordCredit(ctx, tx, creditMovement{StoreId: group.StoreID, BuyerId: group.BuyerAccountID, GroupId: &group.ID, Kind: enums.CreditRedeem, AmountMinor: planned.CreditMinor,
			Currency: group.Currency, DedupeKey: "redeem:" + group.ID.String(), EventType: "storeCredit.redeemed"}, now); err != nil {
			return nil, err
		}
	}
	buyerActor := OrderActor{Kind: enums.ActorBuyer, AccountId: &request.BuyerId, Name: buyer.Name}
	if err := AppendTimelineEvent(ctx, tx, group.ID, "placed", "Order placed, waiting for payment", buyerActor); err != nil {
		return nil, err
	}
	return group, events.EnqueueOutboxEventInTransaction(ctx, tx, "orderGroup.created", group.ID.String(), now, map[string]any{
		"orderGroupId": group.ID, "checkoutId": checkout.ID, "storeId": group.StoreID, "buyerAccountId": group.BuyerAccountID, "totalMinor": group.TotalMinor, "currency": group.Currency,
	})
}

func createOrderItem(ctx context.Context, tx *ent.Tx, group *ent.OrderGroup, line PricedCartLine) error {
	product := line.Product
	lineTotal, err := product.UnitPrice.MultiplyByQuantity(int64(line.Quantity))
	if err != nil {
		return err
	}
	create := tx.OrderItem.Create().SetOrderGroupID(group.ID).SetStoreID(group.StoreID).SetProductID(product.ProductId).SetVariantID(product.VariantId).
		SetProductName(product.ProductTitle).SetVariantTitle(product.VariantTitle).SetSku(product.Sku).SetSize(product.Size).SetColor(product.Color).
		SetUnitPriceMinor(product.UnitPrice.AmountMinor).SetQuantity(line.Quantity).SetLineTotalMinor(lineTotal.AmountMinor).SetCategoryName(product.CategoryName).
		SetTracksStock(product.TrackInventory).SetNillableCategoryID(product.CategoryId).SetTaxable(product.Taxable).
		SetNillableAttributionSource(line.AttributionSource).SetNillableAttributionID(line.AttributionId).SetNillableAffiliateCommissionBps(line.CommissionBps)
	if product.ImageUrl != "" {
		create.SetImageURL(product.ImageUrl)
	}
	if product.CostPrice != nil {
		create.SetCostPriceMinor(product.CostPrice.AmountMinor)
	}
	return create.Exec(ctx)
}

func recordShippingSnapshot(ctx context.Context, tx *ent.Tx, group *ent.OrderGroup, planned PlannedGroup, plan CheckoutPlan) error {
	address := plan.AddressRow
	label := strings.Join(nonEmpty(address.CityName, address.AdminAreaName, address.RegionName, address.CountryCode), ", ")
	create := tx.ShippingCalculation.Create().SetOrderGroupID(group.ID).SetOutcome(planned.Shipping.Outcome).SetMatchedLevel(planned.Shipping.MatchedLevel).
		SetZoneName(planned.Shipping.ZoneName).SetDestinationLabel(label).SetOrderSubtotalMinor(planned.Group.SubtotalMinor).SetFeeMinor(planned.Shipping.FeeMinor).
		SetNillableThresholdAppliedMinor(planned.Shipping.ThresholdAppliedMinor).SetCurrency(string(plan.Currency)).
		SetNillableProfileID(planned.Shipping.ProfileId).SetNillableZoneID(planned.Shipping.ZoneId).SetNillableRuleID(planned.Shipping.RuleId)
	return create.Exec(ctx)
}

func nonEmpty(values ...string) []string {
	kept := []string{}
	for _, value := range values {
		if value != "" {
			kept = append(kept, value)
		}
	}
	return kept
}

func RedeemPromotionInTransaction(ctx context.Context, tx *ent.Tx, group *ent.OrderGroup, planned PlannedGroup) error {
	if planned.Promotion == nil {
		return nil
	}
	guards := []predicate.Promotion{promotion.ID(planned.Promotion.Id)}
	if planned.Promotion.UsageLimit != nil {
		guards = append(guards, promotion.UsedCountLT(*planned.Promotion.UsageLimit))
	}
	updated, err := tx.Promotion.Update().Where(guards...).AddUsedCount(1).Save(ctx)
	if err != nil {
		return err
	}
	if updated == 0 {
		return couponNotApplicable
	}
	if limit := planned.Promotion.UsageLimitPerCustomer; limit != nil {
		used, err := tx.PromotionRedemption.Query().Where(promotionredemption.PromotionID(planned.Promotion.Id), promotionredemption.BuyerAccountID(group.BuyerAccountID)).Count(ctx)
		if err != nil {
			return err
		}
		if used >= *limit {
			return couponNotApplicable
		}
	}
	return tx.PromotionRedemption.Create().SetPromotionID(planned.Promotion.Id).SetOrderGroupID(group.ID).SetBuyerAccountID(group.BuyerAccountID).SetDiscountMinor(planned.DiscountMinor).Exec(ctx)
}

func promotionIdOf(planned PlannedGroup) *uuid.UUID {
	if planned.Promotion == nil {
		return nil
	}
	return &planned.Promotion.Id
}
