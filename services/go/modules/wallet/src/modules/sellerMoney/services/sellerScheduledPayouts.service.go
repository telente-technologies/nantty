package services

import (
	"context"
	"log/slog"
	"time"

	"zudomart/modules/wallet/src/generated/ent"
	"zudomart/modules/wallet/src/generated/ent/sellerpayoutschedule"
	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
)

type SellerScheduledPayouts struct {
	Schedules SellerPayoutSchedules
	Payouts   SellerPayouts
	Ledger    SellerLedgerViews
}

func (runner SellerScheduledPayouts) RunDueSchedules(ctx context.Context, limit int) int {
	container := runner.Payouts.Payouts.Container
	now := container.Now()
	due, err := runner.Schedules.Accounts.client().SellerPayoutSchedule.Query().
		Where(sellerpayoutschedule.ModeNEQ(sellerpayoutschedule.ModeManual), sellerpayoutschedule.NextRunAtLTE(now), sellerpayoutschedule.PayoutAccountIDNotNil()).
		Order(ent.Asc(sellerpayoutschedule.FieldNextRunAt)).Limit(limit).All(ctx)
	if err != nil {
		container.Resources.Logger.WarnContext(ctx, "loading due payout schedules failed", slog.Any("error", err))
		return 0
	}
	requested := 0
	for _, schedule := range due {
		if runner.runOne(ctx, schedule, now) {
			requested++
		}
	}
	return requested
}

func (runner SellerScheduledPayouts) runOne(ctx context.Context, schedule *ent.SellerPayoutSchedule, now time.Time) bool {
	logger := runner.Payouts.Payouts.Container.Resources.Logger
	location, err := time.LoadLocation(schedule.Timezone)
	if err != nil {
		location = time.UTC
	}
	runDay := now.In(location).Format(time.DateOnly)
	next := NextScheduledRun(string(schedule.Mode), schedule.Weekday, schedule.DayOfMonth, location, now)
	defer func() {
		update := schedule.Update().SetLastRunOn(runDay).ClearNextRunAt()
		if next != nil {
			update.SetNextRunAt(*next)
		}
		if saveError := update.Exec(ctx); saveError != nil {
			logger.WarnContext(ctx, "advancing a payout schedule failed", slog.Any("error", saveError))
		}
	}()
	if schedule.LastRunOn == runDay {
		return false
	}
	seller := dtos.SellerContext{SellerId: schedule.UserID, Currency: schedule.Currency, Location: location}
	balances, err := runner.Ledger.ReadBalances(ctx, seller)
	if err != nil {
		logger.WarnContext(ctx, "reading balances for a scheduled payout failed", slog.Any("error", err))
		return false
	}
	fee, err := runner.Payouts.Payouts.Container.Payments.QuotePayoutFee(schedule.Currency, balances.Available.AmountMinor)
	if err != nil {
		return false
	}
	amount := balances.Available.AmountMinor - schedule.KeepMinimumMinor - fee
	if amount < runner.Payouts.MinimumPayoutMinor(schedule.Currency) {
		return false
	}
	body := dtos.RequestPayoutBody{AmountMinor: amount, AccountId: schedule.PayoutAccountID.String()}
	if _, _, err := runner.Payouts.RequestPayout(ctx, seller, body, "schedule-"+schedule.ID.String()+"-"+runDay); err != nil {
		logger.WarnContext(ctx, "scheduled payout was not requested", slog.Any("error", err), slog.String("sellerId", schedule.UserID))
		return false
	}
	return true
}
