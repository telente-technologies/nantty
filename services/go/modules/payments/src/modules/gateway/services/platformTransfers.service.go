package services

import (
	"context"
	"database/sql"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/payments/src/generated/ent/payouttransfer"
	"nantty/modules/payments/src/interfaces"
	"nantty/modules/payments/src/modules/gateway/models"
)

type transferOutcome struct {
	ProviderCode  string
	Outcome       interfaces.ProviderOutcome
	FailureReason string
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
