package services

import (
	"context"
	"database/sql"
	"errors"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/payouttransfer"
	"zudomart/modules/payments/src/integrations"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/modules/gateway/models"
)

type PayoutTransferStatus struct {
	Reference string
	Status    string
}

func (gateway *PaymentGateway) QuoteTransferFee(provider, currency string, amountMinor int64) (int64, error) {
	selected, err := gateway.Container.Provider(provider)
	if err != nil {
		return 0, err
	}
	fee, err := selected.QuoteTransferFee(currency, amountMinor)
	if errors.Is(err, interfaces.ErrCurrencyNotSupported) {
		return 0, ErrCurrencyNotSupported
	}
	return fee, err
}

func (gateway *PaymentGateway) InitiatePayoutTransfer(ctx context.Context, instruction models.PayoutTransferInstruction) (PayoutTransferStatus, error) {
	provider, err := gateway.Container.Provider(instruction.Provider)
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	database := gateway.Container.Resources.Database
	var transfer *ent.PayoutTransfer
	alreadyRecorded := false
	err = databases.RunInMoneyTransaction(ctx, database, func(ctx context.Context, transaction *sql.Tx) error {
		client := gateway.Container.Client(transaction)
		existing, err := client.PayoutTransfer.Query().Where(payouttransfer.Reference(instruction.Reference)).Only(ctx)
		if err == nil {
			transfer, alreadyRecorded = existing, true
			return nil
		}
		if !ent.IsNotFound(err) {
			return err
		}
		last4 := instruction.AccountNumber
		if len(last4) > 4 {
			last4 = last4[len(last4)-4:]
		}
		transfer, err = client.PayoutTransfer.Create().
			SetReference(instruction.Reference).SetPurpose(instruction.Purpose).SetSubjectID(instruction.SubjectId).
			SetProvider(instruction.Provider).SetAmountMinor(instruction.AmountMinor).SetCurrency(instruction.Currency).
			SetBankCode(instruction.BankCode).SetDestinationLast4(last4).SetCreatedAt(gateway.Container.Now()).Save(ctx)
		return err
	})
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	if alreadyRecorded {
		return PayoutTransferStatus{Reference: transfer.Reference, Status: string(transfer.Status)}, nil
	}
	result, err := provider.InitiateTransfer(ctx, interfaces.TransferRequest{
		Reference: instruction.Reference, AmountMinor: instruction.AmountMinor, Currency: instruction.Currency,
		BankCode: instruction.BankCode, AccountNumber: instruction.AccountNumber, AccountName: instruction.AccountName, Narration: instruction.Narration,
	})
	if err != nil {
		if !isDefinitiveProviderRejection(err) {
			return PayoutTransferStatus{Reference: transfer.Reference, Status: string(payouttransfer.StatusProcessing)}, nil
		}
		result = interfaces.TransferResult{Outcome: interfaces.OutcomeFailed, FailureReason: truncateReason(err.Error())}
	}
	return gateway.recordTransferOutcome(ctx, transfer.Reference, result)
}

func isDefinitiveProviderRejection(err error) bool {
	if errors.Is(err, interfaces.ErrProviderNotConfigured) {
		return true
	}
	var requestError *integrations.ProviderRequestError
	if !errors.As(err, &requestError) {
		return false
	}
	switch requestError.StatusCode {
	case 400, 401, 403, 404, 422:
		return true
	}
	return false
}

func (gateway *PaymentGateway) FinalizeTransferByReferenceWithProvider(ctx context.Context, reference string) (PayoutTransferStatus, error) {
	transfer, err := gateway.Container.Client(gateway.Container.Resources.Database).PayoutTransfer.Query().Where(payouttransfer.Reference(reference)).Only(ctx)
	if ent.IsNotFound(err) {
		return PayoutTransferStatus{}, nil
	}
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	if transfer.Status != payouttransfer.StatusProcessing {
		return PayoutTransferStatus{Reference: reference, Status: string(transfer.Status)}, nil
	}
	provider, err := gateway.Container.Provider(transfer.Provider)
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	result, err := provider.VerifyTransfer(ctx, interfaces.TransferLookup{Reference: reference, ProviderTransferCode: transfer.ProviderTransferCode})
	if err != nil {
		return PayoutTransferStatus{}, convertProviderError(err)
	}
	return gateway.recordTransferOutcome(ctx, reference, result)
}

func (gateway *PaymentGateway) recordTransferOutcome(ctx context.Context, reference string, result interfaces.TransferResult) (PayoutTransferStatus, error) {
	status := PayoutTransferStatus{Reference: reference, Status: string(payouttransfer.StatusProcessing)}
	err := databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := gateway.Container.Client(transaction)
		transfer, err := client.PayoutTransfer.Query().Where(payouttransfer.Reference(reference)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		status.Status = string(transfer.Status)
		if transfer.Status != payouttransfer.StatusProcessing {
			return nil
		}
		update := transfer.Update()
		if result.ProviderTransferCode != "" {
			update.SetProviderTransferCode(result.ProviderTransferCode)
		}
		if result.Outcome == interfaces.OutcomePending {
			return update.Exec(ctx)
		}
		now := gateway.Container.Now().UTC()
		handler, err := gateway.transferHandler(transfer.Purpose)
		if err != nil {
			return err
		}
		finished := models.FinishedTransfer{
			TransferId: transfer.ID, Reference: transfer.Reference, Purpose: transfer.Purpose, SubjectId: transfer.SubjectID,
			Provider: transfer.Provider, AmountMinor: transfer.AmountMinor, Currency: transfer.Currency,
			ProviderTransferCode: result.ProviderTransferCode, FailureReason: result.FailureReason, FinishedAt: now,
		}
		eventType := "payoutTransfer.succeeded"
		if result.Outcome == interfaces.OutcomeSucceeded {
			update.SetStatus(payouttransfer.StatusSucceeded)
			err = handler.HandleTransferSucceeded(ctx, transaction, finished)
		} else {
			update.SetStatus(payouttransfer.StatusFailed).SetFailureReason(truncateReason(result.FailureReason))
			eventType = "payoutTransfer.failed"
			err = handler.HandleTransferFailed(ctx, transaction, finished)
		}
		if err != nil {
			return err
		}
		if err := update.SetCompletedAt(now).Exec(ctx); err != nil {
			return err
		}
		status.Status = map[bool]string{true: "succeeded", false: "failed"}[result.Outcome == interfaces.OutcomeSucceeded]
		return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, eventType, transfer.ID.String(), now, map[string]any{
			"transferId": transfer.ID.String(), "reference": transfer.Reference, "purpose": transfer.Purpose, "subjectId": transfer.SubjectID,
			"amount": map[string]any{"amountMinor": transfer.AmountMinor, "currency": transfer.Currency},
		})
	})
	return status, err
}
