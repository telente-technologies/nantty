package services

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/payments/src/constants"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/payouttransfer"
	"zudomart/modules/payments/src/generated/ent/providerpayoutdestination"
	"zudomart/modules/payments/src/integrations"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/modules/gateway/models"
)

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

func (gateway *PaymentGateway) ReadProviderAvailableBalanceForUser(ctx context.Context, userId, currency string) (int64, error) {
	account, err := gateway.FindConnectedAccountForUser(ctx, gateway.Container.Resources.Database, userId)
	if err != nil {
		return 0, err
	}
	provider, err := gateway.Container.Provider(account.Provider)
	if err != nil {
		return 0, err
	}
	balances, err := provider.ReadBalances(ctx, account.ProviderAccountID)
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
	if !ConnectedAccountCapabilityActive(account, constants.CapabilityPayouts) {
		return PayoutTransferStatus{}, ErrConnectedAccountMissing
	}
	provider, err := gateway.Container.Provider(account.Provider)
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	destinationId, err := gateway.ensurePayoutDestination(ctx, provider, account, instruction)
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	last4 := instruction.AccountNumber
	if len(last4) > 4 {
		last4 = last4[len(last4)-4:]
	}
	transfer, err := gateway.Container.Client(database).PayoutTransfer.Create().
		SetReference(instruction.Reference).SetPurpose(instruction.Purpose).SetSubjectID(instruction.SubjectId).SetProvider(account.Provider).
		SetKind(payouttransfer.KindPayout).SetConnectedAccountID(account.ProviderAccountID).SetBeneficiaryUserID(instruction.BeneficiaryUserId).
		SetProviderDestinationID(destinationId).SetAmountMinor(instruction.AmountMinor).SetFeeMinor(instruction.FeeMinor).SetCurrency(instruction.Currency).
		SetBankCode(instruction.BankCode).SetDestinationLast4(last4).SetCreatedAt(gateway.Container.Now()).Save(ctx)
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	return gateway.sendPayoutToProvider(ctx, provider, transfer)
}

func (gateway *PaymentGateway) sendPayoutToProvider(ctx context.Context, provider interfaces.ConnectProvider, transfer *ent.PayoutTransfer) (PayoutTransferStatus, error) {
	result, err := provider.CreatePayout(ctx, interfaces.PayoutRequest{
		ConnectedAccountId: transfer.ConnectedAccountID, ProviderDestinationId: transfer.ProviderDestinationID, AmountMinor: transfer.AmountMinor,
		Currency: transfer.Currency, Reference: transfer.Reference, IdempotencyKey: "payout:" + transfer.Reference,
	})
	if err != nil {
		if !isDefinitiveProviderRejection(err) {
			return PayoutTransferStatus{Reference: transfer.Reference, Status: string(payouttransfer.StatusProcessing)}, nil
		}
		result = interfaces.PayoutResult{Outcome: interfaces.OutcomeFailed, FailureReason: truncateReason(err.Error())}
	}
	if result.Outcome == interfaces.OutcomeSucceeded {
		result.Outcome = interfaces.OutcomePending
	}
	return gateway.recordTransferOutcome(ctx, transfer.Reference, transferOutcome{ProviderCode: result.ProviderPayoutId, Outcome: result.Outcome, FailureReason: result.FailureReason})
}

func (gateway *PaymentGateway) ensurePayoutDestination(ctx context.Context, provider interfaces.ConnectProvider, account *ent.ConnectedAccount, instruction models.SellerPayoutInstruction) (string, error) {
	digest := sha256.Sum256([]byte(instruction.BankCode + ":" + instruction.AccountNumber))
	fingerprint := hex.EncodeToString(digest[:])
	client := gateway.Container.Client(gateway.Container.Resources.Database)
	existing, err := client.ProviderPayoutDestination.Query().Where(
		providerpayoutdestination.ConnectedAccountID(account.ID), providerpayoutdestination.AccountFingerprint(fingerprint), providerpayoutdestination.Currency(instruction.Currency),
	).Only(ctx)
	if err == nil {
		return existing.ProviderDestinationID, nil
	}
	if !ent.IsNotFound(err) {
		return "", err
	}
	destination, err := provider.CreatePayoutDestination(ctx, interfaces.PayoutDestinationRequest{
		ConnectedAccountId: account.ProviderAccountID, Currency: instruction.Currency, BankCode: instruction.BankCode, AccountNumber: instruction.AccountNumber,
		IdempotencyKey: "destination:" + account.ProviderAccountID + ":" + fingerprint[:32],
	})
	if err != nil {
		return "", convertProviderError(err)
	}
	if !destination.Usable || destination.ProviderDestinationId == "" {
		return "", ErrConnectedAccountMissing
	}
	last4 := instruction.AccountNumber
	if len(last4) > 4 {
		last4 = last4[len(last4)-4:]
	}
	err = client.ProviderPayoutDestination.Create().SetConnectedAccountID(account.ID).SetAccountFingerprint(fingerprint).SetCurrency(instruction.Currency).
		SetBankCode(instruction.BankCode).SetAccountLast4(last4).SetProviderDestinationID(destination.ProviderDestinationId).SetCreatedAt(gateway.Container.Now()).
		OnConflictColumns(providerpayoutdestination.FieldConnectedAccountID, providerpayoutdestination.FieldAccountFingerprint, providerpayoutdestination.FieldCurrency).
		DoNothing().Exec(ctx)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}
	return destination.ProviderDestinationId, nil
}

func isDefinitiveProviderRejection(err error) bool {
	if errors.Is(err, interfaces.ErrProviderNotConfigured) {
		return true
	}
	var requestError *integrations.ProviderRequestError
	return errors.As(err, &requestError) && requestError.IsDefinitiveRejection()
}

func (gateway *PaymentGateway) HandlePayoutNotification(ctx context.Context, notification interfaces.WebhookNotification) error {
	client := gateway.Container.Client(gateway.Container.Resources.Database)
	query := client.PayoutTransfer.Query().Where(payouttransfer.KindEQ(payouttransfer.KindPayout))
	if notification.Reference != "" {
		query = query.Where(payouttransfer.Reference(notification.Reference))
	} else {
		query = query.Where(payouttransfer.ProviderTransferCode(notification.ProviderObjectId))
	}
	transfer, err := query.Only(ctx)
	if ent.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	return gateway.confirmPayoutWithProvider(ctx, transfer, notification.EventType, notification.ProviderObjectId)
}

func (gateway *PaymentGateway) confirmPayoutWithProvider(ctx context.Context, transfer *ent.PayoutTransfer, eventType, providerPayoutId string) error {
	if transfer.Status != payouttransfer.StatusProcessing {
		return nil
	}
	if providerPayoutId == "" {
		providerPayoutId = transfer.ProviderTransferCode
	}
	provider, err := gateway.Container.Provider(transfer.Provider)
	if err != nil {
		return err
	}
	outcome := transferOutcome{ProviderCode: providerPayoutId, Outcome: interfaces.OutcomePending}
	if providerPayoutId != "" {
		if confirmed, err := provider.ReadPayout(ctx, interfaces.PayoutLookup{ConnectedAccountId: transfer.ConnectedAccountID, ProviderPayoutId: providerPayoutId}); err == nil {
			outcome = transferOutcome{ProviderCode: providerPayoutId, Outcome: confirmed.Outcome, FailureReason: confirmed.FailureReason}
		} else if eventType == "" {
			return convertProviderError(err)
		}
	}
	if outcome.Outcome == interfaces.OutcomePending {
		switch eventType {
		case "payout.paid":
			outcome.Outcome = interfaces.OutcomeSucceeded
		case "payout.failed":
			outcome.Outcome, outcome.FailureReason = interfaces.OutcomeFailed, "payout failed at the provider"
		}
	}
	_, err = gateway.recordTransferOutcome(ctx, transfer.Reference, outcome)
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
	if transfer.Status != payouttransfer.StatusProcessing {
		return PayoutTransferStatus{Reference: reference, Status: string(transfer.Status)}, nil
	}
	provider, err := gateway.Container.Provider(transfer.Provider)
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	switch {
	case transfer.Kind == payouttransfer.KindPlatformTransfer:
		return gateway.sendPlatformTransferToProvider(ctx, provider, transfer)
	case transfer.ProviderTransferCode == "":
		return gateway.sendPayoutToProvider(ctx, provider, transfer)
	}
	if err := gateway.confirmPayoutWithProvider(ctx, transfer, "", ""); err != nil {
		return PayoutTransferStatus{}, err
	}
	return gateway.readTransferStatus(ctx, databases.ExecutorQuerier(gateway.Container.Resources.Database), reference)
}

func (gateway *PaymentGateway) readTransferStatus(ctx context.Context, executor databases.ExecutorQuerier, reference string) (PayoutTransferStatus, error) {
	transfer, err := gateway.Container.Client(executor).PayoutTransfer.Query().Where(payouttransfer.Reference(reference)).Only(ctx)
	if err != nil {
		return PayoutTransferStatus{}, err
	}
	return PayoutTransferStatus{Reference: reference, Status: string(transfer.Status)}, nil
}
