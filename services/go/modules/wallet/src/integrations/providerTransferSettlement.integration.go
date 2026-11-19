package integrations

import (
	"context"
	"database/sql"
	"errors"

	paymentconstants "nantty/modules/payments/src/constants"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
	"nantty/modules/wallet/src/interfaces"
)

type ProviderTransferSettlement struct {
	Payments *paymentservices.PaymentGateway
}

func (settlement ProviderTransferSettlement) Name() string { return "providerTransfer" }

func paymentInstruction(instruction interfaces.SellerPayoutInstruction) paymentmodels.SellerPayoutInstruction {
	return paymentmodels.SellerPayoutInstruction{
		Purpose: paymentconstants.PurposeWithdrawal, SubjectId: instruction.WithdrawalId, BeneficiaryUserId: instruction.UserId, Reference: instruction.Reference,
		AmountMinor: instruction.AmountMinor, FeeMinor: instruction.FeeMinor, Currency: instruction.Currency, BankCode: instruction.BankCode, BranchCode: instruction.BranchCode, AccountNumber: instruction.AccountNumber,
	}
}

func retryLaterWhenNotReady(err error) error {
	if errors.Is(err, paymentservices.ErrPayoutsFrozen) || errors.Is(err, paymentservices.ErrConnectedAccountMissing) {
		return errors.Join(interfaces.ErrPayoutNotSentRetryLater, err)
	}
	return err
}

func (settlement ProviderTransferSettlement) SettleSellerPayout(ctx context.Context, instruction interfaces.SellerPayoutInstruction) (string, error) {
	status, err := settlement.Payments.InitiateSellerPayout(ctx, paymentInstruction(instruction))
	return status.Status, retryLaterWhenNotReady(err)
}

func (settlement ProviderTransferSettlement) PrepareSellerPayoutInTransaction(ctx context.Context, transaction *sql.Tx, instruction interfaces.SellerPayoutInstruction) error {
	_, err := settlement.Payments.PrepareSellerPayoutInTransaction(ctx, transaction, paymentInstruction(instruction))
	return retryLaterWhenNotReady(err)
}

func (settlement ProviderTransferSettlement) SendPreparedSellerPayout(ctx context.Context, reference string) (string, error) {
	status, err := settlement.Payments.SendPreparedSellerPayout(ctx, reference)
	return status.Status, err
}
