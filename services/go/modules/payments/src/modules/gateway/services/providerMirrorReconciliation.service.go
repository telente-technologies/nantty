package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"zudomart/modules/ledger/src/databases"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"

	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/connectedaccount"
	"zudomart/modules/payments/src/generated/ent/paymentrefund"
	"zudomart/modules/payments/src/generated/ent/payouttransfer"
)

const (
	mirrorMismatchReasonPrefix = "mirrorMismatch"
	mirrorAccountPageSize      = 200
)

type ProviderMirrorLine struct {
	UserId                string `json:"userId"`
	Currency              string `json:"currency"`
	LedgerProviderHeld    int64  `json:"ledgerProviderHeldMinor"`
	InFlightAdjustment    int64  `json:"inFlightAdjustmentMinor"`
	ProviderBalanceMinor  int64  `json:"providerBalanceMinor"`
	DifferenceMinor       int64  `json:"differenceMinor"`
	PayoutsFrozenByResult bool   `json:"payoutsFrozen"`
}

type ProviderMirrorReport struct {
	AccountsChecked int                  `json:"accountsChecked"`
	Mismatches      []ProviderMirrorLine `json:"mismatches"`
}

func (gateway *PaymentGateway) ReconcileProviderHeldSellerFundsAgainstProviderBalances(ctx context.Context) (int, error) {
	report, err := gateway.ReconcileProviderMirror(ctx)
	return len(report.Mismatches), err
}

func (gateway *PaymentGateway) ReconcileProviderMirror(ctx context.Context) (ProviderMirrorReport, error) {
	report := ProviderMirrorReport{Mismatches: []ProviderMirrorLine{}}
	database := gateway.Container.Resources.Database
	var failures []error
	var after *uuid.UUID
	for {
		query := gateway.Container.Client(database).ConnectedAccount.Query().Order(ent.Asc(connectedaccount.FieldID)).Limit(mirrorAccountPageSize)
		if after != nil {
			query = query.Where(connectedaccount.IDGT(*after))
		}
		accounts, err := query.All(ctx)
		if err != nil {
			return report, err
		}
		for _, account := range accounts {
			lines, err := gateway.reconcileOneConnectedAccount(ctx, account)
			if err != nil {
				failures = append(failures, fmt.Errorf("account %s: %w", account.ProviderAccountID, err))
				continue
			}
			report.AccountsChecked++
			report.Mismatches = append(report.Mismatches, lines...)
		}
		if len(accounts) < mirrorAccountPageSize {
			return report, errors.Join(failures...)
		}
		last := accounts[len(accounts)-1].ID
		after = &last
	}
}

func (gateway *PaymentGateway) reconcileOneConnectedAccount(ctx context.Context, account *ent.ConnectedAccount) ([]ProviderMirrorLine, error) {
	provider, err := gateway.Container.Provider(account.Provider)
	if err != nil {
		return nil, err
	}
	balances, err := provider.ReadBalances(ctx, account.ProviderAccountID)
	if err != nil {
		return nil, err
	}
	providerTotals := map[string]int64{}
	for _, balance := range balances {
		providerTotals[balance.Currency] = balance.AvailableMinor + balance.PendingMinor
	}
	database := gateway.Container.Resources.Database
	var mismatches []ProviderMirrorLine
	for _, currency := range []string{"NGN", "USD"} {
		ledgerHeld, err := gateway.Container.Ledger.ReadAccountBalance(ctx, database, ledgermodels.SellerProviderHeldFundsAccount(account.UserID, currency))
		if err != nil {
			return nil, err
		}
		inFlight, err := gateway.providerMovementsNotYetInLedger(ctx, account.ProviderAccountID, currency)
		if err != nil {
			return nil, err
		}
		line := ProviderMirrorLine{UserId: account.UserID, Currency: currency, LedgerProviderHeld: ledgerHeld, InFlightAdjustment: inFlight, ProviderBalanceMinor: providerTotals[currency]}
		line.DifferenceMinor = ledgerHeld - inFlight - line.ProviderBalanceMinor
		if line.DifferenceMinor != 0 {
			line.PayoutsFrozenByResult = true
			mismatches = append(mismatches, line)
		}
	}
	return mismatches, gateway.applyMirrorResultToAccount(ctx, account, mismatches)
}

func (gateway *PaymentGateway) providerMovementsNotYetInLedger(ctx context.Context, connectedAccountId, currency string) (int64, error) {
	client := gateway.Container.Client(gateway.Container.Resources.Database)
	payouts, err := client.PayoutTransfer.Query().Where(
		payouttransfer.ConnectedAccountID(connectedAccountId), payouttransfer.Currency(currency), payouttransfer.KindEQ(payouttransfer.KindPayout),
		payouttransfer.StatusEQ(payouttransfer.StatusProcessing), payouttransfer.ProviderTransferCodeNEQ(""),
	).All(ctx)
	if err != nil {
		return 0, err
	}
	var inFlight int64
	for _, payout := range payouts {
		inFlight += payout.AmountMinor + payout.FeeMinor
	}
	refunds, err := client.PaymentRefund.Query().Where(
		paymentrefund.ConnectedAccountID(connectedAccountId), paymentrefund.Currency(currency),
		paymentrefund.StatusIn(paymentrefund.StatusPending, paymentrefund.StatusProcessing),
	).All(ctx)
	if err != nil {
		return 0, err
	}
	for _, refund := range refunds {
		if refund.FeeTopUpMinor > 0 && refund.FeeTopUpTransferID == "" {
			inFlight += refund.FeeTopUpMinor
		}
		if refund.ProviderRefundID != "" {
			inFlight += refund.AmountMinor
		}
	}
	return inFlight, nil
}

func (gateway *PaymentGateway) applyMirrorResultToAccount(ctx context.Context, account *ent.ConnectedAccount, mismatches []ProviderMirrorLine) error {
	return databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		if len(mismatches) == 0 {
			if account.PayoutsFrozen && strings.HasPrefix(account.PayoutsFrozenReason, mirrorMismatchReasonPrefix) {
				return gateway.SetConnectedAccountPayoutsFrozen(ctx, transaction, account.ProviderAccountID, false, "")
			}
			return nil
		}
		reason := fmt.Sprintf("%s: %s differs by %d", mirrorMismatchReasonPrefix, mismatches[0].Currency, mismatches[0].DifferenceMinor)
		if err := gateway.SetConnectedAccountPayoutsFrozen(ctx, transaction, account.ProviderAccountID, true, reason); err != nil {
			return err
		}
		return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "providerMirror.mismatchFound", account.UserID, gateway.Container.Now().UTC(), map[string]any{
			"userId": account.UserID, "mismatches": mismatches,
		})
	})
}
