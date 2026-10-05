package services

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/wallet/src/generated/ent"
	"zudomart/modules/wallet/src/generated/ent/payoutaccount"
	"zudomart/modules/wallet/src/generated/ent/sellerpayoutschedule"
	"zudomart/modules/wallet/src/modules/sellerMoney/dtos"
	"zudomart/platform/httpserver"
)

var weekdayNames = []string{"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"}

type SellerPayoutSchedules struct {
	Accounts SellerPayoutAccounts
}

func NextScheduledRun(mode string, weekday, dayOfMonth int, location *time.Location, now time.Time) *time.Time {
	if mode == "manual" {
		return nil
	}
	local := now.In(location)
	candidate := time.Date(local.Year(), local.Month(), local.Day(), 9, 0, 0, 0, location)
	for attempt := 0; attempt < 400; attempt++ {
		matches := mode == "daily" || (mode == "weekly" && int(candidate.Weekday()) == weekday) || (mode == "monthly" && candidate.Day() == dayOfMonth)
		if matches && candidate.After(now) {
			utc := candidate.UTC()
			return &utc
		}
		candidate = candidate.AddDate(0, 0, 1)
	}
	return nil
}

func ScheduleLabel(mode string, weekday, dayOfMonth int) string {
	switch mode {
	case "daily":
		return "Every day at 09:00"
	case "weekly":
		return "Every " + weekdayNames[weekday] + " at 09:00"
	case "monthly":
		return fmt.Sprintf("On day %d of every month at 09:00", dayOfMonth)
	}
	return "Manual: you request each payout"
}

func (schedules SellerPayoutSchedules) find(ctx context.Context, seller dtos.SellerContext) (*ent.SellerPayoutSchedule, error) {
	row, err := schedules.Accounts.client().SellerPayoutSchedule.Query().Where(sellerpayoutschedule.UserID(seller.SellerId)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return row, err
}

func (schedules SellerPayoutSchedules) Read(ctx context.Context, seller dtos.SellerContext) (dtos.PayoutScheduleView, string, error) {
	row, err := schedules.find(ctx, seller)
	if err != nil {
		return dtos.PayoutScheduleView{}, "", err
	}
	if row == nil {
		var accountId *string
		if defaultAccount, findError := schedules.Accounts.client().PayoutAccount.Query().Where(payoutaccount.UserID(seller.SellerId), payoutaccount.DeletedAtIsNil(), payoutaccount.IsDefault(true)).First(ctx); findError == nil {
			text := defaultAccount.ID.String()
			accountId = &text
		}
		return dtos.PayoutScheduleView{Mode: "manual", Weekday: 1, DayOfMonth: 1, KeepMinimumBalance: seller.Money(0), AccountId: accountId}, ScheduleLabel("manual", 1, 1), nil
	}
	return scheduleViewOf(row), ScheduleLabel(string(row.Mode), row.Weekday, row.DayOfMonth), nil
}

func scheduleViewOf(row *ent.SellerPayoutSchedule) dtos.PayoutScheduleView {
	var accountId *string
	if row.PayoutAccountID != nil {
		text := row.PayoutAccountID.String()
		accountId = &text
	}
	return dtos.PayoutScheduleView{Mode: string(row.Mode), Weekday: row.Weekday, DayOfMonth: row.DayOfMonth, KeepMinimumBalance: moneyOf(row.KeepMinimumMinor, row.Currency),
		AccountId: accountId, NextRunAt: formatOptionalTime(row.NextRunAt)}
}

func (schedules SellerPayoutSchedules) Save(ctx context.Context, seller dtos.SellerContext, body dtos.SavePayoutScheduleBody) (dtos.PayoutScheduleView, error) {
	var accountId *uuid.UUID
	if body.AccountId != nil {
		parsed := uuid.MustParse(*body.AccountId)
		exists, err := schedules.Accounts.client().PayoutAccount.Query().Where(payoutaccount.ID(parsed), payoutaccount.UserID(seller.SellerId), payoutaccount.DeletedAtIsNil()).Exist(ctx)
		if err != nil {
			return dtos.PayoutScheduleView{}, err
		}
		if !exists {
			return dtos.PayoutScheduleView{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "accountId", Message: "must be one of your payout accounts"}})
		}
		accountId = &parsed
	}
	next := NextScheduledRun(body.Mode, body.Weekday, body.DayOfMonth, seller.Location, schedules.Accounts.Payouts.Container.Now())
	client := schedules.Accounts.client()
	err := client.SellerPayoutSchedule.Create().SetUserID(seller.SellerId).SetCurrency(seller.Currency).SetTimezone(seller.Location.String()).
		SetMode(sellerpayoutschedule.Mode(body.Mode)).SetWeekday(body.Weekday).SetDayOfMonth(body.DayOfMonth).SetKeepMinimumMinor(body.KeepMinimumBalanceMinor).
		SetNillablePayoutAccountID(accountId).SetNillableNextRunAt(next).
		OnConflictColumns(sellerpayoutschedule.FieldUserID).
		UpdateCurrency().UpdateTimezone().UpdateMode().UpdateWeekday().UpdateDayOfMonth().UpdateKeepMinimumMinor().UpdatePayoutAccountID().UpdateNextRunAt().UpdateUpdatedAt().
		Exec(ctx)
	if err != nil {
		return dtos.PayoutScheduleView{}, err
	}
	row, err := schedules.find(ctx, seller)
	if err != nil {
		return dtos.PayoutScheduleView{}, err
	}
	if accountId == nil {
		if row, err = row.Update().ClearPayoutAccountID().Save(ctx); err != nil {
			return dtos.PayoutScheduleView{}, err
		}
	}
	if next == nil {
		if row, err = row.Update().ClearNextRunAt().Save(ctx); err != nil {
			return dtos.PayoutScheduleView{}, err
		}
	}
	return scheduleViewOf(row), nil
}
