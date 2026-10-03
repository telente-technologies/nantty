package services

import (
	"context"
	"errors"
	"regexp"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/payouttransfer"
	"zudomart/modules/payments/src/integrations"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/modules/gateway/models"
)

var providerTransferReferencePattern = regexp.MustCompile(`^[a-z0-9_-]{16,100}$`)

type PayoutTransferStatus struct {
	Reference string
	Status    string
}

func (gateway *PaymentGateway) QuotePayoutFee(currency string, amountMinor int64) (int64, error) {
	provider, err := gateway.Container.DefaultProvider()
	if err != nil {
		return 0, err
	}
	fee, err := provider.QuotePayoutFee(currency, amountMinor)
	if errors.Is(err, interfaces.ErrCurrencyNotSupported) {
		return 0, ErrCurrencyNotSupported
	}
	return fee, err
}

func (gateway *PaymentGateway) ReadProviderAvailableBalanceForUser(ctx context.Context, _ string, currency string) (int64, error) {
	provider, err := gateway.Container.DefaultProvider()
	if err != nil {
		return 0, err
	}
	balances, err := provider.ReadPlatformBalances(ctx)
	if err != nil {
		return 0, convertProviderError(err)
	}
	for _, balance := range balances {
		if balance.Currency == currency {
			return balance.AvailableMinor, nil
		}
	}
	return 0, nil
}

func (gateway *PaymentGateway) InitiateSellerPayout(ctx context.Context, instruction models.SellerPayoutInstruction) (PayoutTransferStatus, error) {
	database := gateway.Container.Resources.Database
	if !providerTransferReferencePattern.MatchString(instruction.Reference) {
		return PayoutTransferStatus{}, errors.New("a payout reference must be 16 to 100 lowercase letters, digits, - or _")
	}
	if existing, err := gateway.Container.Client(database).PayoutTransfer.Query().Where(payouttransfer.Reference(instruction.Reference)).Only(ctx); err == nil {
		return PayoutTransferStatus{Reference: existing.Reference, Status: string(existing.Status)}, nil
	} else if !ent.IsNotFound(err) {
		return PayoutTransferStatus{}, err
	}
	account, err := gateway.FindConnectedAccountForUser(ctx, database, instruction.BeneficiaryUserId)
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	if account.PayoutsFrozen {
		return PayoutTransferStatus{}, ErrPayoutsFrozen
	}
	if !ConnectedAccountReadyForPayouts(account) {
		return PayoutTransferStatus{}, ErrConnectedAccountMissing
	}
	provider, err := gateway.Container.Provider(account.Provider)
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	transfer, err := gateway.Container.Client(database).PayoutTransfer.Create().
		SetReference(instruction.Reference).SetPurpose(instruction.Purpose).SetSubjectID(instruction.SubjectId).SetProvider(account.Provider).
		SetKind(payouttransfer.KindPayout).SetConnectedAccountID(account.RecipientCode).SetBeneficiaryUserID(instruction.BeneficiaryUserId).
		SetProviderDestinationID(account.RecipientCode).SetAmountMinor(instruction.AmountMinor).SetFeeMinor(instruction.FeeMinor).SetCurrency(instruction.Currency).
		SetBankCode(account.BankCode).SetDestinationLast4(account.AccountLast4).SetCreatedAt(gateway.Container.Now()).Save(ctx)
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	return gateway.sendPayoutToProvider(ctx, provider, transfer)
}

func (gateway *PaymentGateway) sendPayoutToProvider(ctx context.Context, provider interfaces.FullPaymentProvider, transfer *ent.PayoutTransfer) (PayoutTransferStatus, error) {
	result, err := provider.CreateTransfer(ctx, interfaces.TransferRequest{
		RecipientCode: transfer.ProviderDestinationID, AmountMinor: transfer.AmountMinor, Currency: transfer.Currency, Reference: transfer.Reference,
		Reason: "Zudomart payout " + transfer.Purpose,
	})
	switch {
	case errors.Is(err, interfaces.ErrTransferNeedsOtp):
		gateway.Container.Resources.Logger.ErrorContext(ctx, "paystack asked for a transfer OTP; disable transfer OTP on the dashboard", "reference", transfer.Reference)
		return PayoutTransferStatus{Reference: transfer.Reference, Status: string(payouttransfer.StatusProcessing)}, nil
	case errors.Is(err, interfaces.ErrInsufficientProviderBalance):
		return gateway.recordTransferOutcome(ctx, transfer.Reference, transferOutcome{Outcome: interfaces.OutcomeFailed, FailureReason: "provider balance too low"})
	case err != nil && !isDefinitiveProviderRejection(err):
		return PayoutTransferStatus{Reference: transfer.Reference, Status: string(payouttransfer.StatusProcessing)}, nil
	case err != nil:
		return gateway.recordTransferOutcome(ctx, transfer.Reference, transferOutcome{Outcome: interfaces.OutcomeFailed, FailureReason: truncateReason(err.Error())})
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
		return nil
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
	provider, err := gateway.Container.Provider(transfer.Provider)
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
		return PayoutTransferStatus{}, nil
	}
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	if transfer.Status == payouttransfer.StatusProcessing {
		if transfer.ProviderTransferCode == "" {
			provider, err := gateway.Container.Provider(transfer.Provider)
			if err != nil {
				return PayoutTransferStatus{}, err
			}
			if _, verifyErr := provider.VerifyTransfer(ctx, transfer.Reference); verifyErr != nil {
				return gateway.sendPayoutToProvider(ctx, provider, transfer)
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
