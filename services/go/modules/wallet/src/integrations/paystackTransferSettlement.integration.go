package integrations

import (
	"context"

	paymentconstants "zudomart/modules/payments/src/constants"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
	paymentservices "zudomart/modules/payments/src/modules/gateway/services"
	"zudomart/modules/wallet/src/interfaces"
)

type PaystackTransferSettlement struct {
	Payments *paymentservices.PaymentGateway
}

func (settlement PaystackTransferSettlement) Name() string { return "paystackTransfer" }

func (settlement PaystackTransferSettlement) SettleSellerPayout(ctx context.Context, instruction interfaces.SellerPayoutInstruction) (string, error) {
	status, err := settlement.Payments.InitiatePayoutTransfer(ctx, paymentmodels.PayoutTransferInstruction{
		Purpose: paymentconstants.PurposeWithdrawal, SubjectId: instruction.WithdrawalId, Provider: instruction.Provider, Reference: instruction.Reference,
		AmountMinor: instruction.AmountMinor, Currency: instruction.Currency, BankCode: instruction.BankCode, AccountNumber: instruction.AccountNumber,
		AccountName: instruction.AccountName, Narration: "Zudomart payout",
	})
	return status.Status, err
}
