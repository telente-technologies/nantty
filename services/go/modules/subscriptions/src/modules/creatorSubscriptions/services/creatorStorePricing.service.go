package services

import (
	"context"
	"net/http"
	"strings"

	paymentconstants "nantty/modules/payments/src/constants"
	"nantty/platform/httpserver"
	"nantty/platform/regionpricing"
)

var (
	ErrPriceNotATier         = httpserver.NewApiError(http.StatusUnprocessableEntity, "PRICE_NOT_A_TIER", "Pick one of the subscription price tiers.")
	ErrStoreBillingOff       = httpserver.NewApiError(http.StatusServiceUnavailable, "STORE_BILLING_UNAVAILABLE", "In-app subscriptions aren't available right now. Subscribe on the web instead.")
	ErrPlanNotInStore        = httpserver.NewApiError(http.StatusUnprocessableEntity, "PLAN_NOT_IN_STORE", "This plan can't be bought in the app. Subscribe on the web instead.")
	ErrStoreSlotsFull        = httpserver.NewApiError(http.StatusConflict, "STORE_SLOTS_FULL", "You've reached the in-app limit for subscriptions at this price. Subscribe on the web instead.")
	ErrManageInStore         = httpserver.NewApiError(http.StatusConflict, "MANAGE_IN_STORE", "This subscription is billed by the app store. Manage it in your store subscription settings.")
	ErrStoreReceiptMismatch  = httpserver.NewApiError(http.StatusUnprocessableEntity, "STORE_RECEIPT_MISMATCH", "This purchase doesn't match the subscription.")
	ErrStoreReceiptUnclaimed = httpserver.NewApiError(http.StatusUnprocessableEntity, "STORE_PURCHASE_NOT_LINKED", "This purchase isn't linked to a creator subscription.")
)

var storeByChannel = map[string]string{"ios": paymentconstants.StoreAppleIap, "android": paymentconstants.StoreGooglePlay}

type ChannelPlanView struct {
	CreatorPlanView
	Tier           string    `json:"tier"`
	Channel        string    `json:"channel"`
	ChannelPrice   MoneyView `json:"channelPrice"`
	StoreProductId *string   `json:"storeProductId"`
	StoreFeeBps    int64     `json:"storeFeeBps"`
}

type PriceTierView struct {
	Tier    string               `json:"tier"`
	Prices  map[string]MoneyView `json:"prices"`
	Default bool                 `json:"default"`
}

func NormalizeChannel(raw string) string {
	switch channel := strings.ToLower(strings.TrimSpace(raw)); channel {
	case "ios", "android":
		return channel
	}
	return "web"
}

func (service CreatorSubscriptions) StoreFees(ctx context.Context) regionpricing.StoreFeeSettings {
	raw, found := service.Container.Resources.Platform.ReadValue(ctx, regionpricing.StoreFeesSettingKey)
	return regionpricing.ParseStoreFeeSettings(raw, found)
}

func ChannelPriceFor(plan CreatorPlanView, channel string, fees regionpricing.StoreFeeSettings) ChannelPlanView {
	view := ChannelPlanView{CreatorPlanView: plan, Channel: channel, ChannelPrice: plan.Price}
	tier, isTier := regionpricing.FindCreatorTier(plan.Price.AmountMinor, plan.Price.Currency, plan.Interval)
	if isTier {
		view.Tier = tier
	}
	if channel == "web" {
		return view
	}
	view.StoreFeeBps = fees.FeeBpsForChannel(channel)
	view.ChannelPrice.AmountMinor = regionpricing.GrossUpForStoreFee(plan.Price.AmountMinor, view.StoreFeeBps, plan.Price.Currency)
	if isTier {
		productId := regionpricing.CreatorStoreProductId(tier, plan.Interval, 1)
		view.StoreProductId = &productId
	}
	return view
}

func (service CreatorSubscriptions) ListPlansForChannel(ctx context.Context, creatorId, channel string) ([]ChannelPlanView, error) {
	plans, err := service.ListPlans(ctx, creatorId, false)
	if err != nil {
		return nil, err
	}
	fees := service.StoreFees(ctx)
	views := make([]ChannelPlanView, 0, len(plans))
	for _, plan := range plans {
		views = append(views, ChannelPriceFor(plan, channel, fees))
	}
	return views, nil
}

func (service CreatorSubscriptions) PriceTiers(ctx context.Context, currency, interval string) ([]PriceTierView, error) {
	currency = strings.ToUpper(currency)
	if _, known := regionpricing.RegionForCurrency(currency); !known {
		return nil, ErrCurrencyNotPriced
	}
	fees := service.StoreFees(ctx)
	ladder := regionpricing.CreatorTierLadder(currency, interval)
	views := make([]PriceTierView, 0, len(ladder))
	for index, price := range ladder {
		prices := map[string]MoneyView{"web": {price.AmountMinor, currency}}
		for _, channel := range []string{"ios", "android"} {
			prices[channel] = MoneyView{regionpricing.GrossUpForStoreFee(price.AmountMinor, fees.FeeBpsForChannel(channel), currency), currency}
		}
		views = append(views, PriceTierView{Tier: price.Tier, Prices: prices, Default: index == 1})
	}
	return views, nil
}
