package services

import (
	"context"
	"database/sql"
	"errors"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/paymentintent"
	"zudomart/modules/payments/src/generated/ent/providerdispute"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/modules/gateway/models"
)

func (gateway *PaymentGateway) HandleProviderDisputeNotification(ctx context.Context, notification interfaces.WebhookNotification) error {
	if notification.Dispute == nil || notification.Dispute.ProviderDisputeId == "" {
		return nil
	}
	return gateway.recordProviderDispute(ctx, *notification.Dispute)
}

func (gateway *PaymentGateway) recordProviderDispute(ctx context.Context, dispute interfaces.ProviderDispute) error {
	provider := gateway.Container.Settings.DefaultProvider
	return databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := gateway.Container.Client(transaction)
		existing, err := client.ProviderDispute.Query().Where(providerdispute.Provider(provider), providerdispute.ProviderDisputeID(dispute.ProviderDisputeId)).ForUpdate().Only(ctx)
		if err != nil && !ent.IsNotFound(err) {
			return err
		}
		opened := existing == nil
		if !opened && existing.Status == dispute.Status {
			return nil
		}
		intent, err := client.PaymentIntent.Query().Where(paymentintent.Or(paymentintent.ProviderTransactionID(dispute.ProviderChargeId), paymentintent.Reference(dispute.ChargeReference))).First(ctx)
		if err != nil && !ent.IsNotFound(err) {
			return err
		}
		if opened {
			create := client.ProviderDispute.Create().SetProvider(provider).SetProviderDisputeID(dispute.ProviderDisputeId).
				SetProviderChargeID(dispute.ProviderChargeId).SetAmountMinor(dispute.AmountMinor).
				SetCurrency(dispute.Currency).SetStatus(dispute.Status).SetReason(truncate(dispute.Reason, 120)).
				SetNillableResponseDeadlineAt(dispute.ResponseDeadlineAt).SetCreatedAt(gateway.Container.Now())
			if intent != nil {
				create.SetPaymentIntentID(intent.ID)
			}
			if err := create.Exec(ctx); err != nil {
				return err
			}
		} else if err := existing.Update().SetStatus(dispute.Status).SetNillableResponseDeadlineAt(dispute.ResponseDeadlineAt).Exec(ctx); err != nil {
			return err
		}
		if intent == nil {
			return nil
		}
		now := gateway.Container.Now().UTC()
		notice := models.ProviderDisputeNotice{
			PaymentIntentId: intent.ID, Purpose: string(intent.Purpose), SubjectId: intent.SubjectID, BeneficiaryUserId: intent.BeneficiaryUserID,
			ProviderDisputeId: dispute.ProviderDisputeId, Status: dispute.Status, Reason: dispute.Reason, AmountMinor: dispute.AmountMinor,
			Currency: dispute.Currency, Opened: opened, OccurredAt: now,
		}
		if handler, found := gateway.disputeHandler(string(intent.Purpose)); found {
			if err := handler.HandleProviderDispute(ctx, transaction, notice); err != nil {
				return err
			}
		}
		return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "providerDispute."+dispute.Status, dispute.ProviderDisputeId, now, map[string]any{
			"providerDisputeId": dispute.ProviderDisputeId, "paymentIntentId": intent.ID.String(), "subjectId": intent.SubjectID, "status": dispute.Status,
			"amount": map[string]any{"amountMinor": dispute.AmountMinor, "currency": dispute.Currency},
		})
	})
}

func (gateway *PaymentGateway) PollOpenProviderDisputes(ctx context.Context) (int, error) {
	provider, err := gateway.Container.DefaultProvider()
	if err != nil {
		return 0, err
	}
	disputes, err := provider.ListOpenDisputes(ctx)
	if err != nil {
		return 0, convertProviderError(err)
	}
	seen := 0
	var failures []error
	for _, dispute := range disputes {
		seen++
		if err := gateway.recordProviderDispute(ctx, dispute); err != nil {
			failures = append(failures, err)
		}
	}
	return seen, errors.Join(failures...)
}

func (gateway *PaymentGateway) SubmitProviderDisputeEvidence(ctx context.Context, providerDisputeId string, evidence interfaces.DisputeEvidence) error {
	dispute, err := gateway.Container.Client(gateway.Container.Resources.Database).ProviderDispute.Query().Where(providerdispute.ProviderDisputeID(providerDisputeId)).Only(ctx)
	if ent.IsNotFound(err) {
		return ErrPaymentNotFound
	}
	if err != nil {
		return err
	}
	provider, err := gateway.Container.Provider(dispute.Provider)
	if err != nil {
		return err
	}
	evidence.ProviderDisputeId = dispute.ProviderDisputeID
	return convertProviderError(provider.SubmitDisputeEvidence(ctx, evidence))
}
