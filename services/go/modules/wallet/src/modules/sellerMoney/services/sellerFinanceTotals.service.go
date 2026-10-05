package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	escrowent "zudomart/modules/escrow/src/generated/ent"
	"zudomart/modules/escrow/src/generated/ent/escrow"
	"zudomart/modules/wallet/src/generated/ent/withdrawal"
	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
	"zudomart/platform/httpserver"
)

type DateRange struct {
	From  time.Time
	Until time.Time
}

func (finance SellerFinance) escrowsCreatedIn(ctx context.Context, seller dtos.SellerContext, period DateRange) ([]*escrowent.Escrow, error) {
	return finance.Escrows.Query(seller).Where(escrow.CreatedAtGTE(period.From), escrow.CreatedAtLT(period.Until)).All(ctx)
}

func (finance SellerFinance) ReadFees(ctx context.Context, seller dtos.SellerContext, period DateRange) (dtos.FeeBreakdownView, error) {
	rows, err := finance.escrowsCreatedIn(ctx, seller, period)
	if err != nil {
		return dtos.FeeBreakdownView{}, err
	}
	gross, escrowFees, processing, counted := int64(0), int64(0), int64(0), 0
	var escrowRate *int
	for _, row := range rows {
		if row.Status == escrow.StatusRefunded {
			continue
		}
		counted++
		gross += row.AmountMinor
		escrowFees += row.CommissionMinor
		processing += row.ProcessingFeeMinor
		rate := int(row.CommissionBps)
		escrowRate = &rate
	}
	withdrawals, err := finance.Payouts.Payouts.Container.Client(finance.Payouts.Payouts.Container.Resources.Database).Withdrawal.Query().
		Where(withdrawal.UserID(seller.SellerId), withdrawal.Currency(seller.Currency), withdrawal.CreatedAtGTE(period.From), withdrawal.CreatedAtLT(period.Until),
			withdrawal.StatusNotIn(withdrawal.StatusFailed, withdrawal.StatusCancelled)).All(ctx)
	if err != nil {
		return dtos.FeeBreakdownView{}, err
	}
	withdrawalFees := int64(0)
	for _, row := range withdrawals {
		withdrawalFees += row.FeeMinor
	}
	adsCount, adsTotal, subscriptionCount, subscriptionTotal, err := finance.chargesFromLedger(ctx, seller, period)
	if err != nil {
		return dtos.FeeBreakdownView{}, err
	}
	lines := []dtos.FeeLineView{
		{Kind: "escrow_fee", Label: "Escrow fee", Description: "Charged on each escrow order before the money is released.", RateBasisPoints: escrowRate, Count: counted, Amount: seller.Money(escrowFees)},
		{Kind: "payment_processing", Label: "Payment processing", Description: "The payment provider's card and transfer fee.", Count: counted, Amount: seller.Money(processing)},
		{Kind: "withdrawal", Label: "Withdrawals", Description: "The bank transfer fee on each payout.", Count: len(withdrawals), Amount: seller.Money(withdrawalFees)},
		{Kind: "ads", Label: "Ads", Description: "Ads Manager charges paid from your wallet.", Count: adsCount, Amount: seller.Money(adsTotal)},
		{Kind: "subscription", Label: "Subscription", Description: "Plan charges paid from your wallet.", Count: subscriptionCount, Amount: seller.Money(subscriptionTotal)},
	}
	total := escrowFees + processing + withdrawalFees + adsTotal + subscriptionTotal
	return dtos.FeeBreakdownView{From: period.From.In(seller.Location).Format(time.DateOnly), To: period.Until.Add(-time.Second).In(seller.Location).Format(time.DateOnly),
		GrossSales: seller.Money(gross), TotalFees: seller.Money(total), NetEarnings: seller.Money(gross - total), Lines: lines}, nil
}

func (finance SellerFinance) chargesFromLedger(ctx context.Context, seller dtos.SellerContext, period DateRange) (int, int64, int, int64, error) {
	lines, _, err := finance.Ledger.ListAvailableLinesSince(ctx, seller, period.From, false)
	if err != nil {
		return 0, 0, 0, 0, err
	}
	adsCount, adsTotal, subscriptionCount, subscriptionTotal := 0, int64(0), 0, int64(0)
	for _, line := range lines {
		if line.IncreasesBalance || !line.CreatedAt.Before(period.Until) {
			continue
		}
		switch SellerTransactionKindOf(line.EntryKind) {
		case "ads_charge":
			adsCount, adsTotal = adsCount+1, adsTotal+line.AmountMinor
		case "subscription_charge":
			subscriptionCount, subscriptionTotal = subscriptionCount+1, subscriptionTotal+line.AmountMinor
		}
	}
	return adsCount, adsTotal, subscriptionCount, subscriptionTotal, nil
}

func (finance SellerFinance) ListRefunds(ctx context.Context, seller dtos.SellerContext, period DateRange, text string, after *uuid.UUID, limit int) (httpserver.CursorPage[dtos.RefundEntryView], error) {
	query := finance.Escrows.Query(seller).Where(escrow.RefundedMinorGT(0), escrow.RefundedAtGTE(period.From), escrow.RefundedAtLT(period.Until))
	if text != "" {
		query = query.Where(escrow.OrderReferenceContainsFold(text))
	}
	if after != nil {
		query = query.Where(escrow.IDLT(*after))
	}
	rows, err := query.Order(escrowent.Desc(escrow.FieldID)).Limit(limit + 1).All(ctx)
	if err != nil {
		return httpserver.CursorPage[dtos.RefundEntryView]{}, err
	}
	nextCursor := ""
	if len(rows) > limit {
		rows = rows[:limit]
		nextCursor = rows[len(rows)-1].ID.String()
	}
	entries, err := finance.Escrows.Present(ctx, seller, rows)
	if err != nil {
		return httpserver.CursorPage[dtos.RefundEntryView]{}, err
	}
	views := make([]dtos.RefundEntryView, 0, len(rows))
	for index, row := range rows {
		kind, returned := "refunded_order", int64(0)
		if row.ShippedAt == nil {
			kind = "cancelled_before_shipping"
		}
		if row.Status == escrow.StatusRefunded {
			returned = row.CommissionMinor
		}
		views = append(views, dtos.RefundEntryView{Id: row.ID.String(), OrderId: row.OrderID, OrderNumber: row.OrderReference, BuyerName: entries[index].BuyerName,
			Kind: kind, Reason: "Refunded to the buyer", Amount: seller.Money(row.RefundedMinor), FeesReturned: seller.Money(returned), CreatedAt: row.RefundedAt.UTC().Format(time.RFC3339)})
	}
	return httpserver.NewCursorPage(views, nextCursor), nil
}

func (finance SellerFinance) ReadSummary(ctx context.Context, seller dtos.SellerContext, period DateRange) (dtos.FinanceSummaryView, error) {
	balances, err := finance.Ledger.ReadBalances(ctx, seller)
	if err != nil {
		return dtos.FinanceSummaryView{}, err
	}
	fees, err := finance.ReadFees(ctx, seller, period)
	if err != nil {
		return dtos.FinanceSummaryView{}, err
	}
	created, err := finance.escrowsCreatedIn(ctx, seller, period)
	if err != nil {
		return dtos.FinanceSummaryView{}, err
	}
	refunded, err := finance.Escrows.Query(seller).Where(escrow.RefundedMinorGT(0), escrow.RefundedAtGTE(period.From), escrow.RefundedAtLT(period.Until)).All(ctx)
	if err != nil {
		return dtos.FinanceSummaryView{}, err
	}
	refundTotal := int64(0)
	for _, row := range refunded {
		refundTotal += row.RefundedMinor
	}
	paidOut, err := finance.paidOutIn(ctx, seller, period)
	if err != nil {
		return dtos.FinanceSummaryView{}, err
	}
	upcoming, err := finance.Escrows.Query(seller).Where(escrow.StatusEQ(escrow.StatusHeld), escrow.AutoReleaseAtNotNil()).Order(escrowent.Asc(escrow.FieldAutoReleaseAt)).Limit(5).All(ctx)
	if err != nil {
		return dtos.FinanceSummaryView{}, err
	}
	upcomingViews, err := finance.Escrows.Present(ctx, seller, upcoming)
	if err != nil {
		return dtos.FinanceSummaryView{}, err
	}
	return dtos.FinanceSummaryView{From: fees.From, To: fees.To, Balances: balances, GrossSales: fees.GrossSales, TotalFees: fees.TotalFees, Refunds: seller.Money(refundTotal),
		NetEarnings: fees.NetEarnings, PaidOut: seller.Money(paidOut), OrdersCount: len(created), UpcomingReleases: upcomingViews}, nil
}

func (finance SellerFinance) paidOutIn(ctx context.Context, seller dtos.SellerContext, period DateRange) (int64, error) {
	rows, err := finance.Payouts.Payouts.Container.Client(finance.Payouts.Payouts.Container.Resources.Database).Withdrawal.Query().
		Where(withdrawal.UserID(seller.SellerId), withdrawal.Currency(seller.Currency), withdrawal.CreatedAtGTE(period.From), withdrawal.CreatedAtLT(period.Until),
			withdrawal.StatusNotIn(withdrawal.StatusFailed, withdrawal.StatusCancelled)).All(ctx)
	total := int64(0)
	for _, row := range rows {
		total += row.NetMinor
	}
	return total, err
}
