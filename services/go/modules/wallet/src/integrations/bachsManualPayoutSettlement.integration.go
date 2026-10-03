package integrations

import (
	"context"
	"errors"

	paymentconstants "zudomart/modules/payments/src/constants"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
	paymentservices "zudomart/modules/payments/src/modules/gateway/services"
	"zudomart/modules/wallet/src/interfaces"
)

type BachsManualPayoutSettlement struct {
	Payments *paymentservices.PaymentGateway
}

func (settlement BachsManualPayoutSettlement) Name() string { return "bachsManualPayout" }

func (settlement BachsManualPayoutSettlement) SettleSellerPayout(ctx context.Context, instruction interfaces.SellerPayoutInstruction) (string, error) {
	status, err := settlement.Payments.InitiateSellerPayout(ctx, paymentmodels.SellerPayoutInstruction{
		Purpose: paymentconstants.PurposeWithdrawal, SubjectId: instruction.WithdrawalId, BeneficiaryUserId: instruction.UserId, Reference: instruction.Reference,
		AmountMinor: instruction.AmountMinor, FeeMinor: instruction.FeeMinor, Currency: instruction.Currency, BankCode: instruction.BankCode, AccountNumber: instruction.AccountNumber,
	})
	if errors.Is(err, paymentservices.ErrPayoutsFrozen) || errors.Is(err, paymentservices.ErrConnectedAccountMissing) {
		return "", errors.Join(interfaces.ErrPayoutNotSentRetryLater, err)
	}
	return status.Status, err
}
