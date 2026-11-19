package services

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ledger/src/databases"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/walletfunding"
	"nantty/modules/payments/src/integrations"
	"nantty/modules/payments/src/interfaces"
	"nantty/platform/httpserver"
)

var ErrFundingNotRejectable = httpserver.NewApiError(http.StatusConflict, "FUNDING_NOT_REJECTABLE", "This deposit can no longer be sent back.")
var ErrFundingReversalPending = httpserver.NewApiError(http.StatusAccepted, "FUNDING_REVERSAL_PENDING", "The provider is still processing this deposit reversal.")
var ErrFundingReversalFailed = httpserver.NewApiError(http.StatusBadGateway, "FUNDING_REVERSAL_FAILED", "The payment provider could not complete this deposit reversal.")

func mustUuid(value string) uuid.UUID {
	parsed, _ := uuid.Parse(value)
	return parsed
}

func (gateway *PaymentGateway) RecordWalletCreditHoldInTransaction(ctx context.Context, transaction *sql.Tx, userId, reference string, source walletfunding.Source, amountMinor int64, currency string, hold time.Duration) error {
	if amountMinor <= 0 {
		return nil
	}
	wallet, err := gateway.FindProviderWallet(ctx, transaction, userId)
	if err != nil {
		return err
	}
	now := gateway.Container.Now().UTC()
	err = gateway.Container.Client(transaction).WalletFunding.Create().SetWalletID(wallet.ID).SetUserID(userId).SetProvider(wallet.Provider).SetProviderReference(reference).
		SetSource(source).SetGrossMinor(amountMinor).SetCurrency(currency).SetHoldReleaseAt(now.Add(hold)).SetCreatedAt(now).
		OnConflictColumns(walletfunding.FieldProvider, walletfunding.FieldProviderReference).DoNothing().Exec(ctx)
	if err != nil && err != sql.ErrNoRows {
		return err
	}
	return nil
}

func (gateway *PaymentGateway) RejectWalletFunding(ctx context.Context, fundingReference, reason string) error {
	funding, err := gateway.claimFundingReversal(ctx, fundingReference)
	if err != nil {
		return err
	}
	provider, err := gateway.Container.Wallets(funding.Provider)
	if err != nil {
		_ = gateway.ReleasePendingFundingReversal(ctx, fundingReference)
		return err
	}
	result, err := provider.ReverseFunding(ctx, funding.ProviderReference, funding.Currency)
	if err != nil {
		var requestError *integrations.ProviderRequestError
		if (errors.As(err, &requestError) && requestError.IsDefinitiveRejection()) || errors.Is(err, interfaces.ErrProviderNotConfigured) || errors.Is(err, interfaces.ErrCurrencyNotSupported) {
			_ = gateway.ReleasePendingFundingReversal(ctx, fundingReference)
			return convertProviderError(err)
		}
		return ErrFundingReversalPending
	}
	switch result.Outcome {
	case interfaces.OutcomeSucceeded:
		return gateway.ApplyFundingReversal(ctx, funding.ProviderReference, result.ProviderRefundId, "rejected: "+reason)
	case interfaces.OutcomeFailed:
		if err := gateway.ReleasePendingFundingReversal(ctx, fundingReference); err != nil {
			return err
		}
		return ErrFundingReversalFailed
	default:
		if err := gateway.RecordPendingFundingReversal(ctx, fundingReference, result.ProviderRefundId); err != nil {
			return err
		}
		return ErrFundingReversalPending
	}
}

func (gateway *PaymentGateway) claimFundingReversal(ctx context.Context, fundingReference string) (*ent.WalletFunding, error) {
	var claimed *ent.WalletFunding
	err := databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := gateway.Container.Client(transaction)
		funding, err := client.WalletFunding.Query().Where(walletfunding.Provider(gateway.walletProviderName()), walletfunding.ProviderReference(fundingReference), walletfunding.SourceEQ(walletfunding.SourceDeposit)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return ErrFundingNotRejectable
		}
		if err != nil {
			return err
		}
		if funding.Status != walletfunding.StatusHeld || funding.ReversedAt != nil {
			return ErrFundingNotRejectable
		}
		spendable, err := gateway.Container.Ledger.ReadAccountBalance(ctx, transaction, ledgermodels.WalletDepositHoldAccount(funding.UserID, funding.Currency))
		if err != nil {
			return err
		}
		if spendable < funding.GrossMinor-funding.ProviderFeeMinor-funding.DepositFeeMinor {
			return ErrFundingNotRejectable
		}
		if err := funding.Update().SetStatus(walletfunding.StatusReversalPending).AddVersion(1).Exec(ctx); err != nil {
			return err
		}
		claimed = funding
		return nil
	})
	return claimed, err
}

func (gateway *PaymentGateway) RecordPendingFundingReversal(ctx context.Context, fundingReference, providerReversalReference string) error {
	if providerReversalReference == "" {
		return nil
	}
	return gateway.Container.Client(gateway.Container.Resources.Database).WalletFunding.Update().
		Where(walletfunding.Provider(gateway.walletProviderName()), walletfunding.ProviderReference(fundingReference), walletfunding.StatusEQ(walletfunding.StatusReversalPending), walletfunding.ReversedAtIsNil()).
		SetReversalReference(truncate(providerReversalReference, 120)).AddVersion(1).Exec(ctx)
}

func (gateway *PaymentGateway) ReleasePendingFundingReversal(ctx context.Context, fundingReference string) error {
	return databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		funding, err := gateway.Container.Client(transaction).WalletFunding.Query().
			Where(walletfunding.Provider(gateway.walletProviderName()), walletfunding.ProviderReference(fundingReference), walletfunding.StatusEQ(walletfunding.StatusReversalPending), walletfunding.ReversedAtIsNil()).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}
		return funding.Update().SetStatus(walletfunding.StatusHeld).SetReversalReference("").AddVersion(1).Exec(ctx)
	})
}

func (gateway *PaymentGateway) ApplyFundingReversal(ctx context.Context, fundingReference, reversalReference, reason string) error {
	return databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := gateway.Container.Client(transaction)
		funding, err := client.WalletFunding.Query().Where(walletfunding.Provider(gateway.walletProviderName()), walletfunding.ProviderReference(fundingReference)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			_, caseErr := gateway.openReconciliationCaseInTransaction(ctx, transaction, "reversalOfUnknownFunding", fundingReference, fundingReference, 0, 0, "NGN", "the provider reversed a funding we never credited")
			return caseErr
		}
		if err != nil || funding.ReversedAt != nil {
			return err
		}
		wallet, err := client.ProviderWallet.Get(ctx, funding.WalletID)
		if err != nil {
			return err
		}
		debt, err := gateway.postFundingReversalInTransaction(ctx, transaction, funding, wallet)
		if err != nil {
			return err
		}
		now := gateway.Container.Now().UTC()
		if err := funding.Update().SetStatus(walletfunding.StatusReversed).SetReversedAt(now).SetReversalReference(truncate(reversalReference, 120)).SetDebtMinor(debt).AddVersion(1).Exec(ctx); err != nil {
			return err
		}
		data := map[string]any{"fundingId": funding.ID.String(), "userId": funding.UserID, "reason": reason, "debt": map[string]any{"amountMinor": debt, "currency": funding.Currency}}
		if debt > 0 {
			gateway.RecordPaymentAlertMetric(ctx, "walletDebt", "userId", funding.UserID, "debtMinor", debt, "fundingReference", fundingReference)
			if err := gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "wallet.debtRecorded", funding.ID.String(), now, data); err != nil {
				return err
			}
		}
		return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "wallet.fundingReversed", funding.ID.String(), now, data)
	})
}

func (gateway *PaymentGateway) postFundingReversalInTransaction(ctx context.Context, transaction *sql.Tx, funding *ent.WalletFunding, wallet *ent.ProviderWallet) (int64, error) {
	currency := funding.Currency
	mirror := ledgermodels.ProviderWalletMirrorAccount(wallet.Provider, wallet.AccountRef, currency)
	hold, available := ledgermodels.WalletDepositHoldAccount(funding.UserID, currency), ledgermodels.WalletAvailableAccount(funding.UserID, currency)
	balances, err := gateway.Container.Ledger.ReadAccountBalances(ctx, transaction, []ledgermodels.AccountRef{mirror, hold, available})
	if err != nil {
		return 0, err
	}
	pulled := funding.GrossMinor
	fromWallet := min(pulled, max(balances[mirror.Key()], 0))
	owed := funding.GrossMinor - funding.ProviderFeeMinor - funding.DepositFeeMinor
	fromHold := min(owed, max(balances[hold.Key()], 0))
	fromAvailable := min(owed-fromHold, max(balances[available.Key()], 0))
	debt := owed - fromHold - fromAvailable
	lines := AppendPositiveLine(nil, mirror, ledgermodels.Credit, fromWallet)
	lines = AppendPositiveLine(lines, ledgermodels.PlatformProviderBalanceAccount(wallet.Provider, currency), ledgermodels.Credit, pulled-fromWallet)
	lines = AppendPositiveLine(lines, hold, ledgermodels.Debit, fromHold)
	lines = AppendPositiveLine(lines, available, ledgermodels.Debit, fromAvailable)
	lines = AppendPositiveLine(lines, ledgermodels.WalletDebtAccount(funding.UserID, currency), ledgermodels.Debit, debt)
	lines = AppendPositiveLine(lines, ledgermodels.PlatformUnreconciledLossAccount(currency), ledgermodels.Debit, pulled-owed)
	_, err = gateway.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "fund-reversed:" + funding.ProviderReference, Kind: "wallet.fundingReversed", ExternalReference: funding.ProviderReference,
		Description: "A deposit was reversed by the sending bank", Metadata: map[string]any{"fundingId": funding.ID.String(), "debtMinor": debt}, Lines: lines,
	})
	return debt, err
}
