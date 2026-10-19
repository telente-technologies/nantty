package services

import (
	"context"
	"database/sql"
	"errors"
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/paymentintent"
	"zudomart/modules/payments/src/generated/ent/paymentrefund"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/utils"
	"zudomart/platform/httpserver"
)

var (
	ErrRefundNotFound            = httpserver.NewApiError(http.StatusNotFound, "REFUND_NOT_FOUND", "Refund was not found.")
	ErrRefundNotAwaitingBank     = httpserver.NewApiError(http.StatusConflict, "REFUND_NOT_AWAITING_BANK_DETAILS", "This refund does not need bank details.")
	ErrRefundBankAccountNotFound = httpserver.NewApiError(http.StatusUnprocessableEntity, "BANK_ACCOUNT_NOT_FOUND", "We could not find that bank account. Check the number and bank.")
	ErrRefundBankNameMismatch    = httpserver.NewApiError(http.StatusUnprocessableEntity, "REFUND_BANK_NAME_MISMATCH", "Refunds can only go to a bank account in your own name.")
	ErrRefundBankNameUnverified  = httpserver.NewApiError(http.StatusConflict, "REFUND_BANK_NAME_UNVERIFIED", "Verify your identity before we can send this refund to a bank account.")
)

type RefundBankDestination struct {
	UserId        string
	RefundId      uuid.UUID
	BankCode      string
	AccountNumber string
}

type RefundBankPayoutView struct {
	RefundId    string `json:"refundId"`
	Status      string `json:"status"`
	AccountName string `json:"accountName"`
	Last4       string `json:"accountLast4"`
}

func (gateway *PaymentGateway) markRefundAwaitingBankDetails(ctx context.Context, refundId uuid.UUID, reason string) error {
	client := gateway.Container.Client(gateway.Container.Resources.Database)
	refund, err := client.PaymentRefund.Get(ctx, refundId)
	if err != nil {
		return err
	}
	intent, err := client.PaymentIntent.Get(ctx, refund.PaymentIntentID)
	if err != nil {
		return err
	}
	return databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		updated, err := gateway.Container.Client(transaction).PaymentRefund.Update().
			Where(paymentrefund.ID(refundId), paymentrefund.StatusIn(paymentrefund.StatusProcessing, paymentrefund.StatusPending)).
			SetStatus(paymentrefund.StatusAwaitingBankDetails).SetRefundMethod(paymentrefund.RefundMethodBankPayout).SetFailureReason(truncateReason(reason)).Save(ctx)
		if err != nil || updated == 0 {
			return err
		}
		data := refundEventData(refund)
		data["ownerUserId"] = intent.OwnerUserID
		return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "paymentRefund.bankDetailsRequired", refund.ID.String(), gateway.Container.Now().UTC(), data)
	})
}

func (gateway *PaymentGateway) SubmitRefundBankDestination(ctx context.Context, destination RefundBankDestination) (RefundBankPayoutView, error) {
	client := gateway.Container.Client(gateway.Container.Resources.Database)
	refund, err := client.PaymentRefund.Get(ctx, destination.RefundId)
	if ent.IsNotFound(err) {
		return RefundBankPayoutView{}, ErrRefundNotFound
	}
	if err != nil {
		return RefundBankPayoutView{}, err
	}
	owned, err := client.PaymentIntent.Query().Where(paymentintent.ID(refund.PaymentIntentID), paymentintent.OwnerUserID(destination.UserId)).Exist(ctx)
	if err != nil {
		return RefundBankPayoutView{}, err
	}
	if !owned {
		return RefundBankPayoutView{}, ErrRefundNotFound
	}
	if refund.Status != paymentrefund.StatusAwaitingBankDetails || refund.ProviderRefundID == "" {
		return RefundBankPayoutView{}, ErrRefundNotAwaitingBank
	}
	identity, err := gateway.Container.Identity(refund.Provider)
	if err != nil {
		return RefundBankPayoutView{}, err
	}
	bankDetails, err := gateway.Container.RefundBankDetails(refund.Provider)
	if err != nil {
		return RefundBankPayoutView{}, err
	}
	accountName, err := identity.ResolveBankAccountName(ctx, destination.BankCode, destination.AccountNumber)
	if errors.Is(err, interfaces.ErrBankAccountNotFound) {
		return RefundBankPayoutView{}, ErrRefundBankAccountNotFound
	}
	if err != nil {
		return RefundBankPayoutView{}, convertProviderError(err)
	}
	if err := gateway.requireRefundAccountInOwnersName(ctx, destination.UserId, accountName); err != nil {
		return RefundBankPayoutView{}, err
	}
	claimed, err := client.PaymentRefund.Update().Where(paymentrefund.ID(refund.ID), paymentrefund.StatusEQ(paymentrefund.StatusAwaitingBankDetails)).
		SetStatus(paymentrefund.StatusProcessing).SetFailureReason("").Save(ctx)
	if err != nil {
		return RefundBankPayoutView{}, err
	}
	if claimed == 0 {
		return RefundBankPayoutView{}, ErrRefundNotAwaitingBank
	}
	if err := bankDetails.RetryRefundWithCustomerBankAccount(ctx, refund.ProviderRefundID, interfaces.PayeeBankAccount{
		UserId: destination.UserId, AccountName: accountName, BankCode: destination.BankCode, AccountNumber: destination.AccountNumber, Currency: refund.Currency,
	}); err != nil {
		if revertErr := client.PaymentRefund.Update().Where(paymentrefund.ID(refund.ID), paymentrefund.StatusEQ(paymentrefund.StatusProcessing)).
			SetStatus(paymentrefund.StatusAwaitingBankDetails).SetFailureReason(truncateReason(err.Error())).Exec(ctx); revertErr != nil {
			return RefundBankPayoutView{}, errors.Join(convertProviderError(err), revertErr)
		}
		return RefundBankPayoutView{}, convertProviderError(err)
	}
	return RefundBankPayoutView{RefundId: refund.ID.String(), Status: string(paymentrefund.StatusProcessing), AccountName: accountName, Last4: lastFour(destination.AccountNumber)}, nil
}

func (gateway *PaymentGateway) requireRefundAccountInOwnersName(ctx context.Context, userId, accountName string) error {
	wallet, err := gateway.FindActiveProviderWallet(ctx, gateway.Container.Resources.Database, userId)
	if err != nil || wallet.AccountName == "" {
		return ErrRefundBankNameUnverified
	}
	if !utils.NamesMatch(wallet.AccountName, accountName) {
		return ErrRefundBankNameMismatch
	}
	return nil
}

func lastFour(value string) string {
	if len(value) > 4 {
		return value[len(value)-4:]
	}
	return value
}
