package setexchangerate

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"strings"

	"nantty/modules/currency/src/constants"
	"nantty/modules/currency/src/container"
	currencyerrors "nantty/modules/currency/src/errors"
	"nantty/modules/currency/src/events"
	"nantty/modules/currency/src/generated/ent"
	"nantty/modules/currency/src/generated/ent/exchangeraterevision"
	"nantty/modules/currency/src/modules/exchangeRates/models"
	"nantty/modules/currency/src/modules/exchangeRates/services"
	"nantty/platform/identityports"
)

const (
	largeChangeLimitPercent = 30
	minimumReasonLength     = 5
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	code := strings.ToUpper(strings.TrimSpace(command.Currency))
	reason := strings.TrimSpace(command.Reason)
	supportedCurrency, supported := constants.FindSupportedCurrency(code)
	if !supported {
		return Result{}, currencyerrors.UnsupportedCurrency
	}
	if code == constants.FixedBaseCurrency {
		return Result{}, currencyerrors.Unprocessable("BASE_CURRENCY_FIXED", "USD is the base currency and its rate is always 1.")
	}
	if len(reason) < minimumReasonLength || len(reason) > 500 {
		return Result{}, currencyerrors.Unprocessable("REASON_REQUIRED", "Give a reason of 5 to 500 characters.")
	}
	proposed, err := services.ParseDecimalRateToE8(command.Rate)
	if errors.Is(err, services.ErrInvalidRate) {
		return Result{}, currencyerrors.Unprocessable("INVALID_RATE", err.Error())
	}
	var created, previous *ent.ExchangeRateRevision
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		var err error
		if previous, err = tx.ExchangeRateRevision.Query().Where(exchangeraterevision.Currency(code)).Order(ent.Desc(exchangeraterevision.FieldCreatedAt), ent.Desc(exchangeraterevision.FieldID)).ForUpdate().First(ctx); ent.IsNotFound(err) {
			previous, err = tx.ExchangeRateRevision.Create().
				SetCurrency(code).SetUsdRateE8(supportedCurrency.DefaultE8).SetSource(exchangeraterevision.SourceSeed).SetReason("initial default rate").
				Save(ctx)
		}
		if err != nil {
			return err
		}
		if services.ExceedsChangeLimit(previous.UsdRateE8, proposed, largeChangeLimitPercent) && !command.ConfirmLargeChange {
			return currencyerrors.Unprocessable("LARGE_RATE_CHANGE_NEEDS_CONFIRMATION", "This changes the rate by more than 30%. Send confirmLargeChange: true to apply it.")
		}
		now := handler.Container.Now()
		created, err = tx.ExchangeRateRevision.Create().SetCurrency(code).SetUsdRateE8(proposed).SetSetBy(command.StaffId).SetReason(reason).
			SetSource(exchangeraterevision.SourceAdmin).SetCreatedAt(now).Save(ctx)
		if err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "exchangeRate.updated", code, now, ExchangeRateUpdatedEventData{
			Currency: code, PreviousUsdRateE8: previous.UsdRateE8, UsdRateE8: proposed, SetBy: command.StaffId, Reason: reason,
		})
	})
	if err != nil {
		return Result{}, err
	}
	handler.recordAuditEvent(ctx, command, previous, created)
	return models.ConvertRevisionToView(created), nil
}

func (handler Handler) recordAuditEvent(ctx context.Context, command Command, previous, created *ent.ExchangeRateRevision) {
	recorder, err := handler.Container.Identity.AuditRecorder()
	if err != nil {
		return
	}
	before, _ := json.Marshal(map[string]any{"usdRateE8": previous.UsdRateE8})
	after, _ := json.Marshal(map[string]any{"usdRateE8": created.UsdRateE8})
	err = recorder.RecordAuditEvent(ctx, identityports.AuditEvent{
		ActorId: command.StaffId, ActorRole: command.StaffRole, Action: "currency.exchange_rate_set", SubjectType: "exchange_rate", SubjectId: created.Currency,
		Before: before, After: after, Reason: created.Reason, IpAddress: command.IpAddress, UserAgent: command.UserAgent, RequestId: command.RequestId,
	})
	if err != nil {
		handler.Container.Logger.ErrorContext(ctx, "audit event not recorded", slog.Any("error", err))
	}
}
