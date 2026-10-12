package services

import (
	"context"
	"sort"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/creators/src/generated/ent"
	"zudomart/modules/creators/src/generated/ent/affiliateattributedsale"
	"zudomart/modules/creators/src/generated/ent/affiliatecommission"
)

type EarningCounterpartyView struct {
	Id   string `json:"id"`
	Name string `json:"name"`
}

type AffiliateEarningView struct {
	Id                string                  `json:"id"`
	Status            string                  `json:"status"`
	PayoutStatus      string                  `json:"payoutStatus"`
	Reason            string                  `json:"reason"`
	OrderNumber       string                  `json:"orderNumber"`
	Product           EarningCounterpartyView `json:"product"`
	Store             EarningCounterpartyView `json:"store"`
	Sale              Money                   `json:"sale"`
	CommissionPercent float64                 `json:"commissionPercent"`
	Commission        Money                   `json:"commission"`
	Reversed          Money                   `json:"reversed"`
	Source            SaleAttributionView     `json:"source"`
	OrderedAt         *time.Time              `json:"orderedAt"`
	DecidedAt         *time.Time              `json:"decidedAt"`
	CreatedAt         time.Time               `json:"createdAt"`
}

type AffiliateEarningsSummaryView struct {
	Pending  []Money `json:"pending"`
	Earned   []Money `json:"earned"`
	Paid     []Money `json:"paid"`
	Reversed []Money `json:"reversed"`
}

type AffiliateEarningsPage struct {
	Summary    AffiliateEarningsSummaryView `json:"summary"`
	Data       []AffiliateEarningView       `json:"data"`
	NextCursor *string                      `json:"nextCursor"`
}

var payoutStatusOf = map[affiliatecommission.Status]string{
	affiliatecommission.StatusPending: "waiting_for_seller_funds", affiliatecommission.StatusProcessing: "transferring",
	affiliatecommission.StatusPaid: "paid", affiliatecommission.StatusReversed: "reversed",
}

func presentSale(sale *ent.AffiliateAttributedSale) AffiliateEarningView {
	view := AffiliateEarningView{Id: sale.ID.String(), Status: "pending", PayoutStatus: "awaiting_completion", OrderNumber: sale.OrderNumber,
		Product: EarningCounterpartyView{sale.ProductID, sale.ProductName}, Store: EarningCounterpartyView{sale.StoreID, sale.StoreName}, Sale: Money{sale.SaleMinor, sale.Currency},
		CommissionPercent: float64(sale.CommissionBps) / 100, Commission: Money{sale.EstimatedCommissionMinor, sale.Currency}, Reversed: Money{0, sale.Currency},
		Source: SaleAttributionView{sale.AttributionSource, sale.AttributionID}, OrderedAt: sale.OrderedAt, DecidedAt: sale.DecidedAt, CreatedAt: sale.CreatedAt}
	if sale.Status == affiliateattributedsale.StatusVoided {
		view.Status, view.PayoutStatus, view.Reason = "reversed", "not_paid", sale.VoidReason
		view.Commission, view.Reversed = Money{0, sale.Currency}, Money{sale.EstimatedCommissionMinor, sale.Currency}
	}
	return view
}

func presentCommission(commission *ent.AffiliateCommission, status string) AffiliateEarningView {
	view := AffiliateEarningView{Id: commission.ID.String(), Status: status, PayoutStatus: payoutStatusOf[commission.Status], OrderNumber: commission.OrderNumber,
		Product: EarningCounterpartyView{commission.ProductID, commission.ProductName}, Store: EarningCounterpartyView{commission.StoreID, commission.StoreName},
		Sale: Money{commission.SaleMinor, commission.Currency}, CommissionPercent: float64(commission.CommissionBps) / 100,
		Commission: Money{commission.CommissionMinor - commission.ReversedMinor, commission.Currency}, Reversed: Money{commission.ReversedMinor, commission.Currency},
		Source: SaleAttributionView{commission.AttributionSource, commission.AttributionID}, OrderedAt: commission.OrderedAt, DecidedAt: &commission.CreatedAt, CreatedAt: commission.CreatedAt}
	if status == "reversed" {
		view.Reason = "refunded_after_completion"
	}
	return view
}

func (affiliates Affiliates) ListAffiliateEarnings(ctx context.Context, creatorId, status, cursor string, limit int) (AffiliateEarningsPage, error) {
	client := affiliates.Container.Client(affiliates.Container.Resources.Database)
	summary, err := affiliates.affiliateEarningsSummary(ctx, client, creatorId)
	if err != nil {
		return AffiliateEarningsPage{}, err
	}
	before, _ := uuid.Parse(cursor)
	views := []AffiliateEarningView{}
	if status == "pending" || status == "reversed" {
		saleStatus := affiliateattributedsale.StatusAwaiting
		if status == "reversed" {
			saleStatus = affiliateattributedsale.StatusVoided
		}
		query := client.AffiliateAttributedSale.Query().Where(affiliateattributedsale.CreatorID(creatorId), affiliateattributedsale.StatusEQ(saleStatus))
		if before != uuid.Nil {
			query.Where(affiliateattributedsale.IDLT(before))
		}
		sales, err := query.Order(ent.Desc(affiliateattributedsale.FieldID)).Limit(limit + 1).All(ctx)
		if err != nil {
			return AffiliateEarningsPage{}, err
		}
		for _, sale := range sales {
			views = append(views, presentSale(sale))
		}
	}
	if status == "earned" || status == "reversed" {
		query := client.AffiliateCommission.Query().Where(affiliatecommission.CreatorID(creatorId))
		if status == "earned" {
			query.Where(affiliatecommission.StatusNEQ(affiliatecommission.StatusReversed))
		} else {
			query.Where(affiliatecommission.ReversedMinorGT(0))
		}
		if before != uuid.Nil {
			query.Where(affiliatecommission.IDLT(before))
		}
		commissions, err := query.Order(ent.Desc(affiliatecommission.FieldID)).Limit(limit + 1).All(ctx)
		if err != nil {
			return AffiliateEarningsPage{}, err
		}
		for _, commission := range commissions {
			views = append(views, presentCommission(commission, status))
		}
	}
	sort.SliceStable(views, func(left, right int) bool { return views[left].Id > views[right].Id })
	page := AffiliateEarningsPage{Summary: summary, Data: views}
	if len(views) > limit {
		page.Data = views[:limit]
		next := views[limit-1].Id
		page.NextCursor = &next
	}
	return page, nil
}

type currencyTotals map[string]int64

func (totals currencyTotals) add(currency string, amount int64) {
	if amount != 0 {
		totals[currency] += amount
	}
}

func (totals currencyTotals) list() []Money {
	monies := []Money{}
	for currency, amount := range totals {
		monies = append(monies, Money{amount, currency})
	}
	sort.Slice(monies, func(left, right int) bool { return monies[left].Currency < monies[right].Currency })
	return monies
}

func (affiliates Affiliates) affiliateEarningsSummary(ctx context.Context, client *ent.Client, creatorId string) (AffiliateEarningsSummaryView, error) {
	var commissionTotals []struct {
		Currency  string `json:"currency"`
		Status    string `json:"status"`
		Committed int64  `json:"committed"`
		Reversed  int64  `json:"reversed"`
	}
	if err := client.AffiliateCommission.Query().Where(affiliatecommission.CreatorID(creatorId)).GroupBy(affiliatecommission.FieldCurrency, affiliatecommission.FieldStatus).
		Aggregate(ent.As(ent.Sum(affiliatecommission.FieldCommissionMinor), "committed"), ent.As(ent.Sum(affiliatecommission.FieldReversedMinor), "reversed")).Scan(ctx, &commissionTotals); err != nil {
		return AffiliateEarningsSummaryView{}, err
	}
	var saleTotals []struct {
		Currency  string `json:"currency"`
		Status    string `json:"status"`
		Estimated int64  `json:"estimated"`
	}
	if err := client.AffiliateAttributedSale.Query().Where(affiliateattributedsale.CreatorID(creatorId), affiliateattributedsale.StatusIn(affiliateattributedsale.StatusAwaiting, affiliateattributedsale.StatusVoided)).
		GroupBy(affiliateattributedsale.FieldCurrency, affiliateattributedsale.FieldStatus).Aggregate(ent.As(ent.Sum(affiliateattributedsale.FieldEstimatedCommissionMinor), "estimated")).Scan(ctx, &saleTotals); err != nil {
		return AffiliateEarningsSummaryView{}, err
	}
	pending, earned, paid, reversed := currencyTotals{}, currencyTotals{}, currencyTotals{}, currencyTotals{}
	for _, total := range commissionTotals {
		reversed.add(total.Currency, total.Reversed)
		if total.Status != affiliatecommission.StatusReversed.String() {
			earned.add(total.Currency, total.Committed-total.Reversed)
		}
		if total.Status == affiliatecommission.StatusPaid.String() {
			paid.add(total.Currency, total.Committed-total.Reversed)
		}
	}
	for _, total := range saleTotals {
		if total.Status == affiliateattributedsale.StatusAwaiting.String() {
			pending.add(total.Currency, total.Estimated)
		} else {
			reversed.add(total.Currency, total.Estimated)
		}
	}
	return AffiliateEarningsSummaryView{Pending: pending.list(), Earned: earned.list(), Paid: paid.list(), Reversed: reversed.list()}, nil
}
