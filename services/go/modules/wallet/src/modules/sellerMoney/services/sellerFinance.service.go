package services

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	escrowent "zudomart/modules/escrow/src/generated/ent"
	"zudomart/modules/escrow/src/generated/ent/escrow"
	"zudomart/modules/escrow/src/generated/ent/predicate"
	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
	"zudomart/platform/httpserver"
	"zudomart/platform/money"
)

var escrowStatuses = []string{"held", "released", "refunded", "disputed"}

type SellerFinance struct {
	Escrows SellerEscrows
	Ledger  SellerLedgerViews
	Payouts SellerPayouts
}

func statusPredicate(status string) predicate.Escrow {
	switch status {
	case "held":
		return escrow.StatusEQ(escrow.StatusHeld)
	case "disputed":
		return escrow.StatusEQ(escrow.StatusDisputed)
	case "released":
		return escrow.Or(escrow.StatusEQ(escrow.StatusReleased), escrow.And(escrow.StatusEQ(escrow.StatusPartiallyRefunded), escrow.ReleasedToSellerMinorGT(0)))
	}
	return escrow.Or(escrow.StatusIn(escrow.StatusRefunded, escrow.StatusClawedBack), escrow.And(escrow.StatusEQ(escrow.StatusPartiallyRefunded), escrow.ReleasedToSellerMinor(0)))
}

func (finance SellerFinance) ListEscrow(ctx context.Context, seller dtos.SellerContext, status, text string, after *uuid.UUID, limit int) (dtos.EscrowEntriesPage, error) {
	page := dtos.EscrowEntriesPage{Data: []dtos.EscrowEntryView{}, CountsByStatus: map[string]int{}, TotalsByStatus: map[string]money.Money{}}
	everything, err := finance.Escrows.Query(seller).Select(escrow.FieldStatus, escrow.FieldReleasedToSellerMinor, escrow.FieldSellerAmountMinor).All(ctx)
	if err != nil {
		return page, err
	}
	for _, name := range escrowStatuses {
		page.CountsByStatus[name], page.TotalsByStatus[name] = 0, seller.Money(0)
	}
	for _, row := range everything {
		name := DashboardEscrowStatus(row)
		page.CountsByStatus[name]++
		page.TotalsByStatus[name] = seller.Money(page.TotalsByStatus[name].AmountMinor + row.SellerAmountMinor)
	}
	query := finance.Escrows.Query(seller)
	if status != "" {
		query = query.Where(statusPredicate(status))
	}
	if text = strings.TrimSpace(text); text != "" {
		query = query.Where(escrow.OrderReferenceContainsFold(text))
	}
	if after != nil {
		query = query.Where(escrow.IDLT(*after))
	}
	rows, err := query.Order(escrowent.Desc(escrow.FieldID)).Limit(limit + 1).All(ctx)
	if err != nil {
		return page, err
	}
	nextCursor := ""
	if len(rows) > limit {
		rows = rows[:limit]
		nextCursor = rows[len(rows)-1].ID.String()
	}
	if page.Data, err = finance.Escrows.Present(ctx, seller, rows); err != nil {
		return page, err
	}
	if nextCursor != "" {
		page.NextCursor = &nextCursor
	}
	return page, nil
}

type settlementGroup struct {
	start time.Time
	rows  []*escrowent.Escrow
}

func (finance SellerFinance) settlementGroups(ctx context.Context, seller dtos.SellerContext) ([]settlementGroup, error) {
	rows, err := finance.Escrows.Query(seller).Where(escrow.ReleasedAtNotNil()).Order(escrowent.Desc(escrow.FieldReleasedAt)).Limit(5000).All(ctx)
	if err != nil {
		return nil, err
	}
	groups := []settlementGroup{}
	for _, row := range rows {
		start := WeekStartOf(*row.ReleasedAt, seller.Location)
		if len(groups) == 0 || !groups[len(groups)-1].start.Equal(start) {
			groups = append(groups, settlementGroup{start: start})
		}
		groups[len(groups)-1].rows = append(groups[len(groups)-1].rows, row)
	}
	return groups, nil
}

func settlementViewOf(seller dtos.SellerContext, group settlementGroup, now time.Time) dtos.SettlementView {
	gross, fees, net := int64(0), int64(0), int64(0)
	for _, row := range group.rows {
		gross += row.AmountMinor
		fees += row.CommissionMinor + row.ProcessingFeeMinor
		net += row.ReleasedToSellerMinor
	}
	end := group.start.AddDate(0, 0, 7)
	status := "settled"
	if now.Before(end) {
		status = "clearing"
	}
	settledAt := end.Add(-time.Second)
	if status == "clearing" {
		settledAt = *group.rows[0].ReleasedAt
	}
	return dtos.SettlementView{
		Id: SettlementIdFor(group.start), Reference: "STL-" + group.start.Format("20060102"), PeriodStart: group.start.Format(time.DateOnly),
		PeriodEnd: end.AddDate(0, 0, -1).Format(time.DateOnly), OrdersCount: len(group.rows), Gross: seller.Money(gross), Fees: seller.Money(fees), Net: seller.Money(net),
		Status: status, SettledAt: settledAt.UTC().Format(time.RFC3339),
	}
}

func (finance SellerFinance) ListSettlements(ctx context.Context, seller dtos.SellerContext, cursor string, limit int) (httpserver.CursorPage[dtos.SettlementView], error) {
	groups, err := finance.settlementGroups(ctx, seller)
	if err != nil {
		return httpserver.CursorPage[dtos.SettlementView]{}, err
	}
	now := finance.Payouts.Payouts.Container.Now()
	views := []dtos.SettlementView{}
	for _, group := range groups {
		identifier := SettlementIdFor(group.start)
		if cursor != "" && identifier >= cursor {
			continue
		}
		if len(views) == limit {
			return httpserver.NewCursorPage(views, views[len(views)-1].Id), nil
		}
		views = append(views, settlementViewOf(seller, group, now))
	}
	return httpserver.NewCursorPage(views, ""), nil
}

func (finance SellerFinance) ReadSettlement(ctx context.Context, seller dtos.SellerContext, settlementId string) (dtos.SettlementDetailView, bool, error) {
	groups, err := finance.settlementGroups(ctx, seller)
	if err != nil {
		return dtos.SettlementDetailView{}, false, err
	}
	for _, group := range groups {
		if SettlementIdFor(group.start) == settlementId {
			orders, err := finance.Escrows.Present(ctx, seller, group.rows)
			return dtos.SettlementDetailView{Settlement: settlementViewOf(seller, group, finance.Payouts.Payouts.Container.Now()), Orders: orders}, err == nil, err
		}
	}
	return dtos.SettlementDetailView{}, false, nil
}
