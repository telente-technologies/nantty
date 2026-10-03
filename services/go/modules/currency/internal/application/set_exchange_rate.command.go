package application

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"strings"

	"zudomart/modules/currency/internal/catalog"
	"zudomart/modules/currency/internal/ent"
	"zudomart/modules/currency/internal/ent/exchangeraterevision"
	"zudomart/modules/currency/internal/rates"
	"zudomart/platform/identityports"
)

const (
	largeChangeLimitPercent = 30
	minimumReasonLength     = 5
)

type SetExchangeRateInput struct {
	StaffId            string
	StaffRole          string
	Currency           string
	Rate               string
	Reason             string
	ConfirmLargeChange bool
	IpAddress          string
	UserAgent          string
	RequestId          string
}

type ExchangeRateUpdatedEventData struct {
	Currency          string `json:"currency"`
	PreviousUsdRateE8 int64  `json:"previousUsdRateE8"`
	UsdRateE8         int64  `json:"usdRateE8"`
	SetBy             string `json:"setBy"`
	Reason            string `json:"reason"`
}

func (application *CurrencyApplication) SetExchangeRateForCurrency(ctx context.Context, input SetExchangeRateInput) (RevisionView, error) {
	code := strings.ToUpper(strings.TrimSpace(input.Currency))
	reason := strings.TrimSpace(input.Reason)
	if _, supported := catalog.FindSupportedCurrency(code); !supported {
		return RevisionView{}, errUnsupportedCurrency
	}
	if code == catalog.FixedBaseCurrency {
		return RevisionView{}, unprocessable("BASE_CURRENCY_FIXED", "USD is the base currency and its rate is always 1.")
	}
	if len(reason) < minimumReasonLength || len(reason) > 500 {
		return RevisionView{}, unprocessable("REASON_REQUIRED", "Give a reason of 5 to 500 characters.")
	}
	proposed, err := rates.ParseDecimalRateToE8(input.Rate)
	if errors.Is(err, rates.ErrInvalidRate) {
		return RevisionView{}, unprocessable("INVALID_RATE", err.Error())
	}
	var created, previous *ent.ExchangeRateRevision
	err = application.runInTransaction(ctx, func(tx *ent.Tx) error {
		var err error
		if previous, err = tx.ExchangeRateRevision.Query().Where(exchangeraterevision.Currency(code)).Order(ent.Desc(exchangeraterevision.FieldID)).ForUpdate().First(ctx); err != nil {
			return err
		}
		if rates.ExceedsChangeLimit(previous.UsdRateE8, proposed, largeChangeLimitPercent) && !input.ConfirmLargeChange {
			return unprocessable("LARGE_RATE_CHANGE_NEEDS_CONFIRMATION", "This changes the rate by more than 30%. Send confirmLargeChange: true to apply it.")
		}
		now := application.Now()
		if created, err = tx.ExchangeRateRevision.Create().SetCurrency(code).SetUsdRateE8(proposed).SetSetBy(input.StaffId).SetReason(reason).SetSource(exchangeraterevision.SourceAdmin).SetCreatedAt(now).Save(ctx); err != nil {
			return err
		}
		return enqueueOutboxEventInTransaction(ctx, tx, "exchangeRate.updated", code, now, ExchangeRateUpdatedEventData{
			Currency: code, PreviousUsdRateE8: previous.UsdRateE8, UsdRateE8: proposed, SetBy: input.StaffId, Reason: reason,
		})
	})
	if err != nil {
		return RevisionView{}, err
	}
	application.recordAuditEvent(ctx, input, previous, created)
	return convertRevisionToView(created), nil
}

func (application *CurrencyApplication) recordAuditEvent(ctx context.Context, input SetExchangeRateInput, previous, created *ent.ExchangeRateRevision) {
	recorder, err := identityports.Default.AuditRecorder()
	if err != nil {
		return
	}
	before, _ := json.Marshal(map[string]any{"usdRateE8": previous.UsdRateE8})
	after, _ := json.Marshal(map[string]any{"usdRateE8": created.UsdRateE8})
	err = recorder.RecordAuditEvent(ctx, identityports.AuditEvent{
		ActorId: input.StaffId, ActorRole: input.StaffRole, Action: "currency.exchange_rate_set", SubjectType: "exchange_rate", SubjectId: created.Currency,
		Before: before, After: after, Reason: created.Reason, IpAddress: input.IpAddress, UserAgent: input.UserAgent, RequestId: input.RequestId,
	})
	if err != nil {
		application.Logger.ErrorContext(ctx, "audit event not recorded", slog.Any("error", err))
	}
}
