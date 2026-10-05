package gettopup

import (
	"context"
	"time"

	"zudomart/modules/ads/src/container"
	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/generated/ent/adtopup"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/modules/billing/dtos"
	adsservices "zudomart/modules/ads/src/services"
	"zudomart/modules/ads/src/types"
)

const abandonedAfter = 24 * time.Hour

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.TopUp, error) {
	deployed := handler.Container
	if _, _, err := accountservices.LoadAccountForPermission(ctx, deployed, query.AccountId, query.UserId, adsservices.PermissionBillingView); err != nil {
		return dtos.TopUp{}, err
	}
	row, err := deployed.Client.AdTopUp.Query().Where(adtopup.AccountID(query.AccountId), adtopup.Reference(query.Reference)).Only(ctx)
	if ent.IsNotFound(err) {
		return dtos.TopUp{}, adserrors.TopUpNotFound
	}
	if err != nil {
		return dtos.TopUp{}, err
	}
	return Present(row, deployed.Now()), nil
}

func Present(row *ent.AdTopUp, now time.Time) dtos.TopUp {
	status := string(row.Status)
	if row.Status == adtopup.StatusPending && now.Sub(row.CreatedAt) > abandonedAfter {
		status = string(adtopup.StatusAbandoned)
	}
	presented := dtos.TopUp{
		Id: row.MoneyTopUpID, Reference: row.Reference, Amount: types.Money{AmountMinor: row.AmountMinor, Currency: row.Currency}, Status: status,
		Provider: row.Provider, CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339),
	}
	if row.CompletedAt != nil {
		completed := row.CompletedAt.UTC().Format(time.RFC3339)
		presented.CompletedAt = &completed
	}
	if row.FailureReason != "" {
		reason := row.FailureReason
		presented.FailureReason = &reason
	}
	return presented
}
