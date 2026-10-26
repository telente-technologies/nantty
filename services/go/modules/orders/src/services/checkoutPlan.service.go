package services

import (
	"nantty/platform/regionpricing"

	"context"
	"slices"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/databases/schema"
	"nantty/modules/orders/src/enums"
	ordererrors "nantty/modules/orders/src/errors"
	"nantty/platform/commerceports"
	"nantty/platform/httpserver"
	"nantty/platform/money"
	"nantty/platform/usersdirectory"
)

type PlannedGroup struct {
	GroupId        uuid.UUID
	Group          SellerGroup
	Store          commerceports.StoreSnapshot
	Shipping       ShippingResult
	CreditMinor    int64
	DiscountMinor  int64
	Promotion      *PromotionRule
	PromotionIssue *PromotionIssue
	Campaigns      CampaignPlan
	TotalMinor     int64
	PaymentMode    string
}

type PromotionIssue struct {
	Code    string
	Message string
}

type CheckoutPlan struct {
	Groups        []PlannedGroup
	Blocked       []uuid.UUID
	Address       schema.AddressSnapshot
	AddressRow    usersdirectory.ShippingAddress
	Currency      money.CurrencyCode
	TotalMinor    int64
	ConsumedItems []uuid.UUID
}

func AddressSnapshotOf(address usersdirectory.ShippingAddress) schema.AddressSnapshot {
	snapshot := schema.AddressSnapshot{
		RecipientName: address.RecipientName, Phone: address.Phone, Line1: address.Line1, Line2: address.Line2, PostalCode: address.PostalCode, Details: address.Details,
		CountryCode: address.CountryCode, RegionName: address.RegionName, AdminAreaName: address.AdminAreaName, CityName: address.CityName,
	}
	for target, source := range map[**string]*uuid.UUID{&snapshot.RegionId: address.RegionId, &snapshot.AdminAreaId: address.AdminAreaId, &snapshot.CityId: address.CityId} {
		if source != nil {
			text := source.String()
			*target = &text
		}
	}
	return snapshot
}

func BuildCheckoutPlan(ctx context.Context, deployed *container.Container, buyerId, addressId uuid.UUID, useCredit bool, promoCodes map[uuid.UUID]string) (CheckoutPlan, error) {
	plan := CheckoutPlan{}
	address, found, err := deployed.Users.FindShippingAddress(ctx, buyerId, addressId)
	if err != nil {
		return plan, err
	}
	if !found {
		return plan, ordererrors.AddressNotFound
	}
	buyerCountry := BuyerCountry(ctx, deployed, buyerId, &address)
	if buyerCountry == "" {
		return plan, regionpricing.ErrCountryRequired
	}
	plan.AddressRow, plan.Address = address, AddressSnapshotOf(address)
	contents, err := LoadCartContents(ctx, deployed.Client, buyerId)
	if err != nil {
		return plan, err
	}
	if len(contents.Items) == 0 {
		return plan, ordererrors.CartEmpty
	}
	lines, unavailable, err := PriceCartItems(ctx, deployed, contents.Items, buyerCountry)
	if err != nil {
		return plan, err
	}
	if len(unavailable) > 0 {
		return plan, ordererrors.ProductUnavailable
	}
	groups, err := GroupCartLinesBySeller(lines)
	if err != nil {
		return plan, ordererrors.MixedCurrencies
	}
	return planGroups(ctx, deployed, buyerId, &plan, groups, useCredit, promoCodes)
}

func planGroups(ctx context.Context, deployed *container.Container, buyerId uuid.UUID, plan *CheckoutPlan, groups []SellerGroup, useCredit bool, promoCodes map[uuid.UUID]string) (CheckoutPlan, error) {
	storeIds := make([]uuid.UUID, 0, len(groups))
	for _, group := range groups {
		storeIds = append(storeIds, group.StoreId)
	}
	loaded, err := loadCartContext(ctx, deployed, buyerId, storeIds, &plan.AddressRow)
	if err != nil {
		return *plan, err
	}
	for _, group := range groups {
		store := loaded.stores[group.StoreId]
		if store.OwnerAccountId == buyerId {
			return *plan, ordererrors.CannotBuyOwnProduct
		}
		result := CalculateShippingForOrderGroup(loaded.profiles[group.StoreId], DeliveryLocationOf(plan.AddressRow), group.SubtotalMinor)
		if result.Outcome == enums.ShippingNotDeliverable {
			plan.Blocked = append(plan.Blocked, group.StoreId)
			continue
		}
		if plan.Currency != "" && plan.Currency != group.Currency {
			return *plan, ordererrors.MixedCurrencies
		}
		plan.Currency = group.Currency
		chosen, discount, issue, err := ChoosePromotion(ctx, deployed, buyerId, group, promoCodes[group.StoreId])
		if err != nil {
			return *plan, err
		}
		campaigns, err := PlanGroupCampaigns(ctx, deployed, group)
		if err != nil {
			return *plan, err
		}
		campaigns.DiscountMinor = min(campaigns.DiscountMinor, group.SubtotalMinor-discount)
		discount += campaigns.DiscountMinor
		credit := int64(0)
		if useCredit {
			credit = RedeemableCreditMinor(loaded.credits[group.StoreId].BalanceMinor, group.SubtotalMinor-discount)
		}
		planned := PlannedGroup{GroupId: uuid.Must(uuid.NewV7()), Group: group, Store: store, Shipping: result, CreditMinor: credit, DiscountMinor: discount, Promotion: chosen, PromotionIssue: issue, Campaigns: campaigns,
			TotalMinor: group.SubtotalMinor - discount - credit + result.FeeMinor}
		plan.Groups = append(plan.Groups, planned)
		plan.TotalMinor += planned.TotalMinor
		for _, line := range group.Lines {
			plan.ConsumedItems = append(plan.ConsumedItems, line.ItemId)
		}
	}
	if len(plan.Groups) == 0 {
		return *plan, ordererrors.NothingDeliverable
	}
	if !CheckoutCurrencySupported(deployed.Settings.CheckoutCurrencies, string(plan.Currency)) {
		return *plan, ordererrors.CheckoutCurrencyNotSupported
	}
	return *plan, nil
}

func CheckoutCurrencySupported(allowed []string, currency string) bool {
	parsed, err := money.ParseCurrencyCode(currency)
	if err != nil || string(parsed) != currency {
		return false
	}
	return len(allowed) == 0 || slices.Contains(allowed, currency)
}

func ChoosePromotion(ctx context.Context, deployed *container.Container, buyerId uuid.UUID, group SellerGroup, code string) (*PromotionRule, int64, *PromotionIssue, error) {
	now := deployed.Now()
	var issue *PromotionIssue
	candidates, err := LoadCandidatePromotions(ctx, deployed, group.StoreId, code, now)
	if err != nil {
		issue = PromotionIssueOf(err)
		if issue == nil {
			return nil, 0, nil, err
		}
		code = ""
	}
	lines := make([]DiscountLine, 0, len(group.Lines))
	for _, line := range group.Lines {
		total, _ := line.Product.UnitPrice.MultiplyByQuantity(int64(line.Quantity))
		lines = append(lines, DiscountLine{ProductId: line.Product.ProductId, CategoryId: line.Product.CategoryId, TotalMinor: total.AmountMinor})
	}
	if code != "" {
		coupon := candidates[len(candidates)-1]
		if err := CheckPromotionApplicable(coupon, now, group.SubtotalMinor, CountBuyerRedemptions(ctx, deployed, buyerId, coupon)); err != nil {
			issue = PromotionIssueOf(err)
		}
	}
	best, discount, found := BestPromotion(candidates, lines, now, group.SubtotalMinor, func(rule PromotionRule) int { return CountBuyerRedemptions(ctx, deployed, buyerId, rule) })
	if !found {
		return nil, 0, issue, nil
	}
	return &best, discount, issue, nil
}

func PromotionIssueOf(err error) *PromotionIssue {
	apiError := httpserver.ConvertErrorToApiError(err)
	if apiError.Code != "COUPON_NOT_FOUND" && apiError.Code != "COUPON_NOT_APPLICABLE" {
		return nil
	}
	return &PromotionIssue{Code: apiError.Code, Message: apiError.Message}
}
