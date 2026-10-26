package services

import (
	"context"
	"net/url"
	"strings"

	"nantty/modules/orders/src/container"
)

func LockAffiliateCommissionRates(ctx context.Context, deployed *container.Container, plan *CheckoutPlan) {
	for groupIndex := range plan.Groups {
		lines := plan.Groups[groupIndex].Group.Lines
		productIds := []string{}
		for _, line := range lines {
			if line.AttributionSource != nil {
				productIds = append(productIds, line.Product.ProductId.String())
			}
		}
		if len(productIds) == 0 {
			continue
		}
		query := url.Values{"storeId": {plan.Groups[groupIndex].Group.StoreId.String()}, "productIds": {strings.Join(productIds, ",")}}
		var response struct {
			Rates map[string]int64 `json:"rates"`
		}
		if err := internalGet(ctx, deployed.Settings.MoneyInternalUrl, "/api/v1/internal/affiliates/commission-rates?"+query.Encode(), deployed.Settings.MoneyInternalToken, nil, &response); err != nil {
			deployed.Logger.WarnContext(ctx, "affiliate commission rates unavailable; the rate is decided at release", "storeId", query.Get("storeId"), "error", err.Error())
			continue
		}
		for lineIndex, line := range lines {
			if rate, found := response.Rates[line.Product.ProductId.String()]; found && line.AttributionSource != nil {
				locked := rate
				lines[lineIndex].CommissionBps = &locked
			}
		}
	}
}
