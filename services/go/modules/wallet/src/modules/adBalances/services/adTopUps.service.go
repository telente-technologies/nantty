package services

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"

	"github.com/google/uuid"

	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	paymentconstants "zudomart/modules/payments/src/constants"
	paymentmodels "zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/modules/wallet/src/container"
	"zudomart/modules/wallet/src/generated/ent"
	"zudomart/modules/wallet/src/generated/ent/adbalanceearningstransfer"
	"zudomart/modules/wallet/src/generated/ent/adbalancetopup"
	"zudomart/modules/wallet/src/modules/adBalances/dtos"
	"zudomart/platform/httpserver"
)

var (
	ErrTopUpNotFound      = httpserver.NewApiError(http.StatusNotFound, "AD_TOP_UP_NOT_FOUND", "Top-up was not found.")
	ErrInsufficientFunds  = httpserver.NewApiError(http.StatusConflict, "INSUFFICIENT_FUNDS", "Your ad balance is too low.")
	ErrRefundsDisabled    = httpserver.NewApiError(http.StatusForbidden, "AD_BALANCE_REFUNDS_DISABLED", "Unused ad balance is not refundable.")
	ErrAdAccountNotFunded = httpserver.NewApiError(http.StatusNotFound, "AD_BALANCE_NOT_FOUND", "You have not funded this ad account.")
)

type AdBalances struct {
	Container *container.Container
}

func (balances AdBalances) StartTopUpInTransaction(ctx context.Context, transaction *sql.Tx, userId string, request dtos.StartTopUpRequestDto) (dtos.TopUpDto, uuid.UUID, error) {
	topUpId := uuid.Must(uuid.NewV7())
	intent, err := balances.Container.Payments.CreatePendingPaymentIntentInTransaction(ctx, transaction, paymentmodels.CreatePaymentIntentRequest{
		Purpose: paymentconstants.PurposeAdBalanceTopUp, OwnerUserId: userId, SubjectId: topUpId.String(), AmountMinor: request.Amount.AmountMinor,
		Currency: request.Amount.Currency, ReturnTo: request.ReturnTo, Metadata: map[string]string{"adAccountId": request.AdAccountId, "adTopUpId": topUpId.String()},
	})
	if err != nil {
		return dtos.TopUpDto{}, uuid.Nil, err
	}
	created, err := balances.Container.Client(transaction).AdBalanceTopUp.Create().SetID(topUpId).SetAdAccountID(request.AdAccountId).SetFundedByUserID(userId).
		SetReference(intent.Reference).SetPaymentIntentID(intent.Id).SetAmountMinor(request.Amount.AmountMinor).SetCurrency(request.Amount.Currency).
		SetCreatedAt(balances.Container.Now()).Save(ctx)
	if err != nil {
		return dtos.TopUpDto{}, uuid.Nil, err
	}
	return ConvertTopUp(created), intent.Id, nil
}

func (balances AdBalances) HandleSucceededPayment(ctx context.Context, transaction *sql.Tx, payment paymentmodels.SettledPayment) error {
	topUp, err := balances.lockTopUp(ctx, transaction, payment.SubjectId)
	if err != nil || topUp.Status != adbalancetopup.StatusPending {
		return err
	}
	if topUp.AmountMinor != payment.AmountMinor || topUp.Currency != payment.Currency {
		return fmt.Errorf("ad top-up %s expects %d %s but %d %s settled", topUp.ID, topUp.AmountMinor, topUp.Currency, payment.AmountMinor, payment.Currency)
	}
	now := balances.Container.Now().UTC()
	if err := topUp.Update().SetStatus(adbalancetopup.StatusSucceeded).SetCreditedAt(now).Exec(ctx); err != nil {
		return err
	}
	if _, err := balances.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "ad-top-up-" + topUp.ID.String(), Kind: "adBalance.toppedUp", ExternalReference: payment.Reference, Description: "Prepaid ad balance funded",
		Lines: []ledgermodels.JournalLineRequest{
			{Account: ledgermodels.PaymentsAwaitingApplicationAccount(topUp.Currency), Direction: ledgermodels.Debit, AmountMinor: topUp.AmountMinor},
			{Account: ledgermodels.AdvertiserPrepaidBalanceAccount(topUp.AdAccountID, topUp.Currency), Direction: ledgermodels.Credit, AmountMinor: topUp.AmountMinor},
		},
	}); err != nil {
		return err
	}
	return balances.Container.Outbox.EnqueueInTransaction(ctx, transaction, "adBalance.toppedUp", topUp.AdAccountID, now, map[string]any{
		"adAccountId": topUp.AdAccountID, "topUpId": topUp.ID.String(), "fundedByUserId": topUp.FundedByUserID, "source": "paystack",
		"amount": map[string]any{"amountMinor": topUp.AmountMinor, "currency": topUp.Currency},
	})
}

func (balances AdBalances) HandleFailedPayment(ctx context.Context, transaction *sql.Tx, payment paymentmodels.SettledPayment) error {
	topUp, err := balances.lockTopUp(ctx, transaction, payment.SubjectId)
	if err != nil || topUp.Status != adbalancetopup.StatusPending {
		return err
	}
	if err := topUp.Update().SetStatus(adbalancetopup.StatusFailed).Exec(ctx); err != nil {
		return err
	}
	return balances.Container.Outbox.EnqueueInTransaction(ctx, transaction, "adBalance.topUpFailed", topUp.AdAccountID, balances.Container.Now().UTC(), map[string]any{
		"adAccountId": topUp.AdAccountID, "topUpId": topUp.ID.String(), "reference": topUp.Reference, "fundedByUserId": topUp.FundedByUserID,
		"amount": map[string]any{"amountMinor": topUp.AmountMinor, "currency": topUp.Currency}, "failureReason": payment.FailureReason,
	})
}

func (balances AdBalances) lockTopUp(ctx context.Context, transaction *sql.Tx, subjectId string) (*ent.AdBalanceTopUp, error) {
	identifier, err := uuid.Parse(subjectId)
	if err != nil {
		return nil, ErrTopUpNotFound
	}
	topUp, err := balances.Container.Client(transaction).AdBalanceTopUp.Query().Where(adbalancetopup.ID(identifier)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil, ErrTopUpNotFound
	}
	return topUp, err
}

func (balances AdBalances) ReadBalance(ctx context.Context, userId, adAccountId, currency string) (dtos.AdBalanceDto, error) {
	client := balances.Container.Client(balances.Container.Resources.Database)
	funded, err := client.AdBalanceTopUp.Query().Where(adbalancetopup.AdAccountID(adAccountId), adbalancetopup.FundedByUserID(userId)).Exist(ctx)
	if err != nil {
		return dtos.AdBalanceDto{}, err
	}
	if !funded {
		if funded, err = client.AdBalanceEarningsTransfer.Query().Where(adbalanceearningstransfer.AdAccountID(adAccountId), adbalanceearningstransfer.UserID(userId)).Exist(ctx); err != nil {
			return dtos.AdBalanceDto{}, err
		}
	}
	if !funded && adAccountId != BoostAdAccountId(userId) {
		return dtos.AdBalanceDto{}, ErrAdAccountNotFunded
	}
	balance, err := balances.Container.Ledger.ReadAccountBalance(ctx, balances.Container.Resources.Database, ledgermodels.AdvertiserPrepaidBalanceAccount(adAccountId, currency))
	return dtos.AdBalanceDto{AdAccountId: adAccountId, Balance: dtos.MoneyDto{AmountMinor: balance, Currency: currency}}, err
}

func BoostAdAccountId(userId string) string { return "user-" + userId }

func ConvertTopUp(topUp *ent.AdBalanceTopUp) dtos.TopUpDto {
	return dtos.TopUpDto{Id: topUp.ID.String(), AdAccountId: topUp.AdAccountID, Reference: topUp.Reference, Status: string(topUp.Status), Amount: dtos.MoneyDto{AmountMinor: topUp.AmountMinor, Currency: topUp.Currency}}
}

func (balances AdBalances) ReadTopUpStatus(ctx context.Context, adAccountId, reference string) (dtos.TopUpStatusDto, error) {
	client := balances.Container.Client(balances.Container.Resources.Database)
	topUp, err := client.AdBalanceTopUp.Query().Where(adbalancetopup.AdAccountID(adAccountId), adbalancetopup.Reference(reference)).Only(ctx)
	if ent.IsNotFound(err) {
		return dtos.TopUpStatusDto{}, ErrTopUpNotFound
	}
	if err != nil {
		return dtos.TopUpStatusDto{}, err
	}
	provider := balances.Container.Payments.Container.Settings.DefaultProvider
	if topUp.Status == adbalancetopup.StatusPending {
		intent, err := balances.Container.Payments.VerifyAndSettlePaymentIntentByReference(ctx, reference)
		if err != nil {
			return dtos.TopUpStatusDto{}, err
		}
		provider = intent.Provider
		if topUp, err = client.AdBalanceTopUp.Get(ctx, topUp.ID); err != nil {
			return dtos.TopUpStatusDto{}, err
		}
	}
	return dtos.TopUpStatusDto{
		Id: topUp.ID.String(), AdAccountId: topUp.AdAccountID, Reference: topUp.Reference, Amount: dtos.MoneyDto{AmountMinor: topUp.AmountMinor, Currency: topUp.Currency},
		Status: string(topUp.Status), Provider: provider, FundedByUserId: topUp.FundedByUserID, CreatedAt: topUp.CreatedAt, CompletedAt: topUp.CreditedAt,
	}, nil
}
