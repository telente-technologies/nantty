package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/payments/src/generated/ent/providerwallet"
	"nantty/modules/payments/src/generated/ent/reconciliationcase"
)

var paymentAlertCounters sync.Map

func PaymentAlertCount(name string) int64 {
	value, found := paymentAlertCounters.Load(name)
	if !found {
		return 0
	}
	return value.(*atomic.Int64).Load()
}

func (gateway *PaymentGateway) RecordPaymentAlertMetric(ctx context.Context, name string, attributes ...any) {
	counter, _ := paymentAlertCounters.LoadOrStore(name, &atomic.Int64{})
	total := counter.(*atomic.Int64).Add(1)
	fields := append([]any{"metric", "nantty.payments." + name, "value", 1, "total", total, "_aws", map[string]any{
		"CloudWatchMetrics": []map[string]any{{"Namespace": "Nantty/Payments", "Dimensions": [][]string{{}}, "Metrics": []map[string]string{{"Name": name, "Unit": "Count"}}}},
	}, name, 1}, attributes...)
	gateway.Container.Resources.Logger.ErrorContext(ctx, "payment alert", fields...)
}

func (gateway *PaymentGateway) FreezeProviderWallet(ctx context.Context, userId, reason string) {
	if userId == "" {
		return
	}
	err := databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		return gateway.freezeProviderWalletInTransaction(ctx, transaction, userId, reason)
	})
	if err != nil {
		gateway.Container.Resources.Logger.ErrorContext(ctx, "could not freeze a provider wallet", "userId", userId, "error", err)
	}
}

func (gateway *PaymentGateway) freezeProviderWalletInTransaction(ctx context.Context, transaction *sql.Tx, userId, reason string) error {
	client := gateway.Container.Client(transaction)
	now := gateway.Container.Now().UTC()
	updated, err := client.ProviderWallet.Update().Where(providerwallet.UserID(userId), providerwallet.Provider(gateway.walletProviderName()), providerwallet.StatusEQ(providerwallet.StatusActive)).
		SetStatus(providerwallet.StatusFrozen).SetFreezeReason(truncate(reason, 300)).SetFrozenAt(now).AddVersion(1).Save(ctx)
	if err != nil || updated == 0 {
		return err
	}
	gateway.RecordPaymentAlertMetric(ctx, "walletFrozen", "userId", userId, "reason", reason)
	return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "providerWallet.frozen", userId, now, map[string]any{"userId": userId, "reason": reason})
}

func (gateway *PaymentGateway) UnfreezeProviderWallet(ctx context.Context, userId string) error {
	return databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		updated, err := gateway.Container.Client(transaction).ProviderWallet.Update().
			Where(providerwallet.UserID(userId), providerwallet.Provider(gateway.walletProviderName()), providerwallet.StatusEQ(providerwallet.StatusFrozen)).
			SetStatus(providerwallet.StatusActive).SetFreezeReason("").ClearFrozenAt().AddVersion(1).Save(ctx)
		if err != nil || updated == 0 {
			return err
		}
		return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "providerWallet.unfrozen", userId, gateway.Container.Now().UTC(), map[string]any{"userId": userId})
	})
}

func (gateway *PaymentGateway) OpenReconciliationCase(ctx context.Context, kind, subject, dedupe string, expectedMinor, actualMinor int64, currency, detail string) bool {
	opened := false
	err := databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		var err error
		opened, err = gateway.openReconciliationCaseInTransaction(ctx, transaction, kind, subject, dedupe, expectedMinor, actualMinor, currency, detail)
		return err
	})
	if err != nil {
		gateway.Container.Resources.Logger.ErrorContext(ctx, "could not record a reconciliation case", "kind", kind, "subject", subject, "error", err)
	}
	return opened
}

func (gateway *PaymentGateway) openReconciliationCaseInTransaction(ctx context.Context, transaction *sql.Tx, kind, subject, dedupe string, expectedMinor, actualMinor int64, currency, detail string) (bool, error) {
	key := truncate(kind+":"+dedupe, 255)
	err := gateway.Container.Client(transaction).ReconciliationCase.Create().SetProvider(gateway.walletProviderName()).SetKind(kind).SetSubject(truncate(subject, 160)).
		SetDedupeKey(key).SetExpectedMinor(expectedMinor).SetActualMinor(actualMinor).SetCurrency(currency).SetDetail(truncate(detail, 1000)).
		SetCreatedAt(gateway.Container.Now()).OnConflictColumns(reconciliationcase.FieldDedupeKey).DoNothing().Exec(ctx)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	gateway.RecordPaymentAlertMetric(ctx, "reconciliation."+kind, "subject", subject, "expectedMinor", expectedMinor, "actualMinor", actualMinor, "currency", currency)
	return true, gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "reconciliation.alertRaised", key, gateway.Container.Now().UTC(), map[string]any{
		"kind": kind, "subject": subject, "detail": detail, "currency": currency,
		"expected": map[string]any{"amountMinor": expectedMinor, "currency": currency}, "actual": map[string]any{"amountMinor": actualMinor, "currency": currency},
		"message": fmt.Sprintf("%s on %s", kind, subject),
	})
}
