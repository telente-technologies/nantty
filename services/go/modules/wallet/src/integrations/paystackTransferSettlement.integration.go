package integrations

import (
	"context"
	"database/sql"
	"errors"

	paymentconstants "zudomart/modules/payments/src/constants"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
	paymentservices "zudomart/modules/payments/src/modules/gateway/services"
	"zudomart/modules/wallet/src/interfaces"
)

type PaystackTransferSettlement struct {
	Payments *paymentservices.PaymentGateway
}

func (settlement PaystackTransferSettlement) Name() string { return "paystackTransfer" }

func paymentInstruction(instruction interfaces.SellerPayoutInstruction) paymentmodels.SellerPayoutInstruction {
	return paymentmodels.SellerPayoutInstruction{
		Purpose: paymentconstants.PurposeWithdrawal, SubjectId: instruction.WithdrawalId, BeneficiaryUserId: instruction.UserId, Reference: instruction.Reference,
		AmountMinor: instruction.AmountMinor, FeeMinor: instruction.FeeMinor, Currency: instruction.Currency, BankCode: instruction.BankCode, AccountNumber: instruction.AccountNumber,
	}
}

func retryLaterWhenNotReady(err error) error {
	if errors.Is(err, paymentservices.ErrPayoutsFrozen) || errors.Is(err, paymentservices.ErrConnectedAccountMissing) {
		return errors.Join(interfaces.ErrPayoutNotSentRetryLater, err)
	}
	return err
}

func (settlement PaystackTransferSettlement) SettleSellerPayout(ctx context.Context, instruction interfaces.SellerPayoutInstruction) (string, error) {
	status, err := settlement.Payments.InitiateSellerPayout(ctx, paymentInstruction(instruction))
	return status.Status, retryLaterWhenNotReady(err)
}

func (settlement PaystackTransferSettlement) PrepareSellerPayoutInTransaction(ctx context.Context, transaction *sql.Tx, instruction interfaces.SellerPayoutInstruction) error {
	_, err := settlement.Payments.PrepareSellerPayoutInTransaction(ctx, transaction, paymentInstruction(instruction))
	return retryLaterWhenNotReady(err)
}

func (settlement PaystackTransferSettlement) SendPreparedSellerPayout(ctx context.Context, reference string) (string, error) {
	status, err := settlement.Payments.SendPreparedSellerPayout(ctx, reference)
	return status.Status, err
}
