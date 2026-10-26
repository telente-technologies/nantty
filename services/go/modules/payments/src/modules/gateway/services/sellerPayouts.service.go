package services

import (
	"context"
	"database/sql"
	"errors"
	"regexp"
	"time"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/payouttransfer"
	"nantty/modules/payments/src/integrations"
	"nantty/modules/payments/src/interfaces"
	"nantty/modules/payments/src/modules/gateway/models"
)

var providerTransferReferencePattern = regexp.MustCompile(`^[a-z0-9_-]{16,100}$`)

const PayoutTransferMissing = "missing"

type PayoutTransferStatus struct {
	Reference string
	Status    string
}

func (gateway *PaymentGateway) QuotePayoutFee(currency string, amountMinor int64) (int64, error) {
	provider, err := gateway.Container.DefaultPayouts()
	if err != nil {
		return 0, err
	}
	fee, err := provider.QuotePayoutFee(currency, amountMinor)
	if errors.Is(err, interfaces.ErrCurrencyNotSupported) {
		return 0, ErrCurrencyNotSupported
	}
	return fee, err
}

func (gateway *PaymentGateway) ReadProviderAvailableBalanceForUser(ctx context.Context, userId string, currency string) (int64, error) {
	return gateway.readUserWalletBalance(ctx, userId, currency)
}

func (gateway *PaymentGateway) InitiateSellerPayout(ctx context.Context, instruction models.SellerPayoutInstruction) (PayoutTransferStatus, error) {
	var prepared PayoutTransferStatus
	err := databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		var prepareErr error
		prepared, prepareErr = gateway.PrepareSellerPayoutInTransaction(ctx, transaction, instruction)
		return prepareErr
	})
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	return gateway.SendPreparedSellerPayout(ctx, prepared.Reference)
}

func (gateway *PaymentGateway) PrepareSellerPayoutInTransaction(ctx context.Context, transaction *sql.Tx, instruction models.SellerPayoutInstruction) (PayoutTransferStatus, error) {
	if !providerTransferReferencePattern.MatchString(instruction.Reference) {
		return PayoutTransferStatus{}, errors.New("a payout reference must be 16 to 100 lowercase letters, digits, - or _")
	}
	client := gateway.Container.Client(transaction)
	if existing, err := client.PayoutTransfer.Query().Where(payouttransfer.Reference(instruction.Reference)).Only(ctx); err == nil {
		return PayoutTransferStatus{Reference: existing.Reference, Status: string(existing.Status)}, nil
	} else if !ent.IsNotFound(err) {
		return PayoutTransferStatus{}, err
	}
	return gateway.prepareWalletPayoutInTransaction(ctx, transaction, instruction)
}

func (gateway *PaymentGateway) SendPreparedSellerPayout(ctx context.Context, reference string) (PayoutTransferStatus, error) {
	transfer, err := gateway.Container.Client(gateway.Container.Resources.Database).PayoutTransfer.Query().Where(payouttransfer.Reference(reference)).Only(ctx)
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	if transfer.Status != payouttransfer.StatusProcessing || transfer.ProviderTransferCode != "" {
		return PayoutTransferStatus{Reference: reference, Status: string(transfer.Status)}, nil
	}
	provider, err := gateway.Container.Payouts(transfer.Provider)
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	return gateway.claimAndSendPayoutToProvider(ctx, provider, transfer)
}

const payoutSendClaimLifetime = 15 * time.Minute

func (gateway *PaymentGateway) claimAndSendPayoutToProvider(ctx context.Context, provider interfaces.PayoutProvider, transfer *ent.PayoutTransfer) (PayoutTransferStatus, error) {
	now := gateway.Container.Now().UTC()
	claimed, err := gateway.Container.Client(gateway.Container.Resources.Database).PayoutTransfer.Update().
		Where(payouttransfer.ID(transfer.ID), payouttransfer.StatusEQ(payouttransfer.StatusProcessing), payouttransfer.ProviderTransferCode(""),
			payouttransfer.Or(payouttransfer.SendClaimedAtIsNil(), payouttransfer.SendClaimedAtLT(now.Add(-payoutSendClaimLifetime)))).
		SetSendClaimedAt(now).Save(ctx)
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	if claimed == 0 {
		return gateway.readTransferStatus(ctx, gateway.Container.Resources.Database, transfer.Reference)
	}
	return gateway.sendPayoutToProvider(ctx, provider, transfer)
}

func (gateway *PaymentGateway) sendPayoutToProvider(ctx context.Context, provider interfaces.PayoutProvider, transfer *ent.PayoutTransfer) (PayoutTransferStatus, error) {
	request := interfaces.TransferRequest{
		RecipientCode: transfer.ProviderDestinationID, AmountMinor: transfer.AmountMinor, Currency: transfer.Currency, Reference: transfer.Reference,
		Reason: "Zudomart payout " + transfer.Purpose, SourceWalletRef: transfer.SourceWalletRef,
	}
	if transfer.SealedDestination != nil {
		if refusal, err := gateway.completeWalletPayoutRequest(ctx, transfer, &request); err != nil || refusal != "" {
			if refusal != "" {
				return gateway.recordTransferOutcome(ctx, transfer.Reference, transferOutcome{Outcome: interfaces.OutcomeFailed, FailureReason: refusal})
			}
			return PayoutTransferStatus{}, err
		}
	}
	result, err := provider.CreateTransfer(ctx, request)
	switch {
	case errors.Is(err, interfaces.ErrTransferNeedsOtp):
		gateway.Container.Resources.Logger.ErrorContext(ctx, "the provider asked for a transfer OTP; disable transfer OTP on the dashboard", "reference", transfer.Reference)
		return PayoutTransferStatus{Reference: transfer.Reference, Status: string(payouttransfer.StatusProcessing)}, nil
	case errors.Is(err, interfaces.ErrInsufficientProviderBalance):
		return gateway.recordTransferOutcome(ctx, transfer.Reference, transferOutcome{Outcome: interfaces.OutcomeFailed, FailureReason: "provider balance too low"})
	case err != nil && !isDefinitiveProviderRejection(err):
		return PayoutTransferStatus{Reference: transfer.Reference, Status: string(payouttransfer.StatusProcessing)}, nil
	case err != nil:
		vResult, vErr := provider.VerifyTransfer(ctx, transfer.Reference)
		switch {
		case vErr == nil && vResult.Outcome != interfaces.OutcomeFailed:
			return gateway.recordTransferOutcome(ctx, transfer.Reference, transferOutcome{ProviderCode: vResult.ProviderTransferId, Outcome: vResult.Outcome, FailureReason: vResult.FailureReason})
		case vErr == nil || isDefinitiveProviderRejection(vErr):
			return gateway.recordTransferOutcome(ctx, transfer.Reference, transferOutcome{Outcome: interfaces.OutcomeFailed, FailureReason: truncateReason(err.Error())})
		}
		return PayoutTransferStatus{Reference: transfer.Reference, Status: string(payouttransfer.StatusProcessing)}, nil
	}
	if result.Outcome == interfaces.OutcomeSucceeded {
		result.Outcome = interfaces.OutcomePending
	}
	return gateway.recordTransferOutcome(ctx, transfer.Reference, transferOutcome{ProviderCode: result.ProviderTransferId, Outcome: result.Outcome, FailureReason: result.FailureReason})
}

func isDefinitiveProviderRejection(err error) bool {
	if errors.Is(err, interfaces.ErrProviderNotConfigured) {
		return true
	}
	var requestError *integrations.ProviderRequestError
	return errors.As(err, &requestError) && requestError.IsDefinitiveRejection()
}

func (gateway *PaymentGateway) HandleTransferNotification(ctx context.Context, notification interfaces.WebhookNotification) error {
	transfer, err := gateway.Container.Client(gateway.Container.Resources.Database).PayoutTransfer.Query().Where(payouttransfer.Reference(notification.Reference)).Only(ctx)
	if ent.IsNotFound(err) {
		return gateway.ConfirmMovement(ctx, notification.Reference, "")
	}
	if err != nil {
		return err
	}
	return gateway.confirmTransferWithProvider(ctx, transfer, notification.EventType)
}

func (gateway *PaymentGateway) confirmTransferWithProvider(ctx context.Context, transfer *ent.PayoutTransfer, eventType string) error {
	if transfer.Status != payouttransfer.StatusProcessing {
		return nil
	}
	provider, err := gateway.Container.Payouts(transfer.Provider)
	if err != nil {
		return err
	}
	confirmed, err := provider.VerifyTransfer(ctx, transfer.Reference)
	if err != nil {
		return convertProviderError(err)
	}
	if confirmed.Outcome == interfaces.OutcomeFailed && eventType == "transfer.reversed" {
		confirmed.FailureReason = "transfer reversed by the bank"
		gateway.Container.Resources.Logger.WarnContext(ctx, "payout transfer reversed", "reference", transfer.Reference)
	}
	_, err = gateway.recordTransferOutcome(ctx, transfer.Reference, transferOutcome{ProviderCode: confirmed.ProviderTransferId, Outcome: confirmed.Outcome, FailureReason: confirmed.FailureReason})
	return err
}

func (gateway *PaymentGateway) FinalizeTransferByReferenceWithProvider(ctx context.Context, reference string) (PayoutTransferStatus, error) {
	transfer, err := gateway.Container.Client(gateway.Container.Resources.Database).PayoutTransfer.Query().Where(payouttransfer.Reference(reference)).Only(ctx)
	if ent.IsNotFound(err) {
		return PayoutTransferStatus{Reference: reference, Status: PayoutTransferMissing}, nil
	}
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	if transfer.Status == payouttransfer.StatusProcessing {
		if transfer.ProviderTransferCode == "" {
			provider, err := gateway.Container.Payouts(transfer.Provider)
			if err != nil {
				return PayoutTransferStatus{}, err
			}
			if _, verifyErr := provider.VerifyTransfer(ctx, transfer.Reference); verifyErr != nil {
				if !isDefinitiveProviderRejection(verifyErr) {
					return PayoutTransferStatus{Reference: reference, Status: string(transfer.Status)}, nil
				}
				return gateway.claimAndSendPayoutToProvider(ctx, provider, transfer)
			}
		}
		if err := gateway.confirmTransferWithProvider(ctx, transfer, ""); err != nil {
			return PayoutTransferStatus{}, err
		}
	}
	return gateway.readTransferStatus(ctx, gateway.Container.Resources.Database, reference)
}

func (gateway *PaymentGateway) readTransferStatus(ctx context.Context, executor databases.ExecutorQuerier, reference string) (PayoutTransferStatus, error) {
	transfer, err := gateway.Container.Client(executor).PayoutTransfer.Query().Where(payouttransfer.Reference(reference)).Only(ctx)
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	return PayoutTransferStatus{Reference: reference, Status: string(transfer.Status)}, nil
}
