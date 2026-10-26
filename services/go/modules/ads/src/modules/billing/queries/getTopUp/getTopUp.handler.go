package gettopup

import (
	"context"
	"time"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adtopup"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	applytopupresult "nantty/modules/ads/src/modules/billing/commands/applyTopUpResult"
	"nantty/modules/ads/src/modules/billing/dtos"
	adsservices "nantty/modules/ads/src/services"
	"nantty/modules/ads/src/types"
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
	if row.Status == adtopup.StatusPending {
		row = handler.refreshFromMoney(ctx, row)
	}
	return Present(row, deployed.Now()), nil
}

func (handler Handler) refreshFromMoney(ctx context.Context, row *ent.AdTopUp) *ent.AdTopUp {
	deployed := handler.Container
	status, err := deployed.TopUps.ReadTopUp(ctx, row.AccountID.String(), row.Reference)
	if err != nil {
		deployed.Logger.Warn("top-up status lookup failed", "reference", row.Reference, "error", err)
		return row
	}
	completedAt := deployed.Now()
	if status.CompletedAt != nil {
		completedAt = *status.CompletedAt
	}
	switch status.Status {
	case "succeeded":
		err = (applytopupresult.Handler{Container: deployed}).Execute(ctx, applytopupresult.Command{AccountId: row.AccountID, TopUpId: row.MoneyTopUpID, AmountMinor: row.AmountMinor, Currency: row.Currency, OccurredAt: completedAt})
	case "failed":
		err = deployed.Client.AdTopUp.UpdateOneID(row.ID).SetStatus(adtopup.StatusFailed).SetCompletedAt(completedAt).SetFailureReason("The payment did not go through.").Exec(ctx)
	default:
		return row
	}
	if err != nil {
		deployed.Logger.Warn("top-up status could not be applied", "reference", row.Reference, "error", err)
		return row
	}
	if reloaded, err := deployed.Client.AdTopUp.Get(ctx, row.ID); err == nil {
		return reloaded
	}
	return row
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
