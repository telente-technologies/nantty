package services

import (
	"context"

	"zudomart/modules/creators/src/generated/ent/creatoraffiliation"
	"zudomart/modules/creators/src/repositories"
)

type AffiliateOverviewView struct {
	Settings             ProgramSettingsView      `json:"settings"`
	CreatorDrivenSales   Money                    `json:"creatorDrivenSales"`
	CommissionsOwed      Money                    `json:"commissionsOwed"`
	CommissionsPaid      Money                    `json:"commissionsPaid"`
	ActiveCreatorsCount  int                      `json:"activeCreatorsCount"`
	PendingRequestsCount int                      `json:"pendingRequestsCount"`
	TopCreators          []CreatorPerformanceView `json:"topCreators"`
}

func (affiliates Affiliates) Overview(ctx context.Context, store repositories.StoreSummary) (AffiliateOverviewView, error) {
	settings, err := affiliates.Settings(ctx, store)
	if err != nil {
		return AffiliateOverviewView{}, err
	}
	creators, err := affiliates.ListCreators(ctx, store, nil, nil)
	if err != nil {
		return AffiliateOverviewView{}, err
	}
	pending, err := affiliates.Container.Client(affiliates.Container.Resources.Database).CreatorAffiliation.Query().
		Where(creatoraffiliation.StoreID(store.Id), creatoraffiliation.StatusEQ(creatoraffiliation.StatusRequested)).Count(ctx)
	if err != nil {
		return AffiliateOverviewView{}, err
	}
	view := AffiliateOverviewView{
		Settings: settings, CreatorDrivenSales: Money{0, store.Currency}, CommissionsOwed: Money{0, store.Currency}, CommissionsPaid: Money{0, store.Currency},
		PendingRequestsCount: pending, TopCreators: creators[:min(len(creators), 5)],
	}
	for _, creator := range creators {
		view.CreatorDrivenSales.AmountMinor += creator.Sales.AmountMinor
		view.CommissionsPaid.AmountMinor += creator.CommissionPaid.AmountMinor
		view.CommissionsOwed.AmountMinor += creator.CommissionOwed.AmountMinor
		if creator.Status == "active" {
			view.ActiveCreatorsCount++
		}
	}
	return view, nil
}
