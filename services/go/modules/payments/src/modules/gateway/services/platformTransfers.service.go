package services

import (
	"context"
	"database/sql"
	"errors"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/payments/src/constants"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/payouttransfer"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/modules/gateway/models"
)

type transferOutcome struct {
	ProviderCode  string
	Outcome       interfaces.ProviderOutcome
	FailureReason string
}

func (gateway *PaymentGateway) TransferPlatformFundsToConnectedAccount(ctx context.Context, instruction models.PlatformTransferInstruction) (PayoutTransferStatus, error) {
	database := gateway.Container.Resources.Database
	if existing, err := gateway.Container.Client(database).PayoutTransfer.Query().Where(payouttransfer.Reference(instruction.Reference)).Only(ctx); err == nil {
		return PayoutTransferStatus{Reference: existing.Reference, Status: string(existing.Status)}, nil
	} else if !ent.IsNotFound(err) {
		return PayoutTransferStatus{}, err
	}
	account, err := gateway.FindConnectedAccountForUser(ctx, database, instruction.BeneficiaryUserId)
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	if !ConnectedAccountCapabilityActive(account, constants.CapabilityTransfers) {
		return PayoutTransferStatus{}, ErrConnectedAccountMissing
	}
	provider, err := gateway.Container.Provider(account.Provider)
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	transfer, err := gateway.Container.Client(database).PayoutTransfer.Create().
		SetReference(instruction.Reference).SetPurpose(instruction.Purpose).SetSubjectID(instruction.SubjectId).SetProvider(account.Provider).
		SetKind(payouttransfer.KindPlatformTransfer).SetConnectedAccountID(account.ProviderAccountID).SetBeneficiaryUserID(instruction.BeneficiaryUserId).
		SetTransferGroup(instruction.TransferGroup).SetAmountMinor(instruction.AmountMinor).SetCurrency(instruction.Currency).
		SetCreatedAt(gateway.Container.Now()).Save(ctx)
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	return gateway.sendPlatformTransferToProvider(ctx, provider, transfer)
}

func (gateway *PaymentGateway) sendPlatformTransferToProvider(ctx context.Context, provider interfaces.ConnectProvider, transfer *ent.PayoutTransfer) (PayoutTransferStatus, error) {
	if transfer.ProviderTransferCode != "" {
		confirmed, err := provider.ReadTransfer(ctx, transfer.ProviderTransferCode)
		if err != nil {
			return PayoutTransferStatus{}, convertProviderError(err)
		}
		return gateway.recordTransferOutcome(ctx, transfer.Reference, transferOutcome{ProviderCode: confirmed.ProviderTransferId, Outcome: confirmed.Outcome})
	}
	result, err := provider.CreateTransfer(ctx, interfaces.TransferRequest{
		ToConnectedAccountId: transfer.ConnectedAccountID, AmountMinor: transfer.AmountMinor, Currency: transfer.Currency,
		TransferGroup: transfer.TransferGroup, Description: transfer.Purpose + " " + transfer.SubjectID, IdempotencyKey: "transfer:" + transfer.Reference,
		Metadata: map[string]string{"reference": transfer.Reference, "purpose": transfer.Purpose},
	})
	switch {
	case errors.Is(err, interfaces.ErrInsufficientProviderBalance):
		return PayoutTransferStatus{Reference: transfer.Reference, Status: string(payouttransfer.StatusProcessing)}, ErrProviderBalanceTooLow
	case err != nil && !isDefinitiveProviderRejection(err):
		return PayoutTransferStatus{Reference: transfer.Reference, Status: string(payouttransfer.StatusProcessing)}, nil
	case err != nil:
		return gateway.recordTransferOutcome(ctx, transfer.Reference, transferOutcome{Outcome: interfaces.OutcomeFailed, FailureReason: truncateReason(err.Error())})
	}
	return gateway.recordTransferOutcome(ctx, transfer.Reference, transferOutcome{ProviderCode: result.ProviderTransferId, Outcome: result.Outcome})
}

func (gateway *PaymentGateway) HandleTransferNotification(ctx context.Context, providerTransferId string) error {
	transfer, err := gateway.Container.Client(gateway.Container.Resources.Database).PayoutTransfer.Query().
		Where(payouttransfer.ProviderTransferCode(providerTransferId), payouttransfer.StatusEQ(payouttransfer.StatusProcessing)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	provider, err := gateway.Container.Provider(transfer.Provider)
	if err != nil {
		return err
	}
	_, err = gateway.sendPlatformTransferToProvider(ctx, provider, transfer)
	return err
}

func (gateway *PaymentGateway) recordTransferOutcome(ctx context.Context, reference string, result transferOutcome) (PayoutTransferStatus, error) {
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
		if result.ProviderCode != "" {
			update.SetProviderTransferCode(result.ProviderCode)
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
			TransferId: transfer.ID, Kind: string(transfer.Kind), Reference: transfer.Reference, Purpose: transfer.Purpose, SubjectId: transfer.SubjectID,
			Provider: transfer.Provider, BeneficiaryUserId: transfer.BeneficiaryUserID, AmountMinor: transfer.AmountMinor, FeeMinor: transfer.FeeMinor,
			Currency: transfer.Currency, ProviderTransferCode: result.ProviderCode, FailureReason: result.FailureReason, FinishedAt: now,
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
			"transferId": transfer.ID.String(), "kind": string(transfer.Kind), "reference": transfer.Reference, "purpose": transfer.Purpose, "subjectId": transfer.SubjectID,
			"amount": map[string]any{"amountMinor": transfer.AmountMinor, "currency": transfer.Currency},
		})
	})
	return status, err
}
