package services

import (
	"context"
	"errors"
	"slices"
	"time"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/payments/src/constants"
	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/connectedaccount"
)

type ConnectedAccountView struct {
	ReadyToAcceptPayments bool       `json:"readyToAcceptPayments"`
	ReadyForPayouts       bool       `json:"readyForPayouts"`
	Roles                 []string   `json:"roles"`
	Status                string     `json:"status"`
	VerificationStatus    string     `json:"verificationStatus"`
	BankCode              string     `json:"bankCode,omitempty"`
	AccountLast4          string     `json:"accountLast4,omitempty"`
	AccountName           string     `json:"accountName,omitempty"`
	PayoutsOnHold         bool       `json:"payoutsOnHold"`
	LastError             string     `json:"lastError,omitempty"`
	UpdatedAt             *time.Time `json:"updatedAt,omitempty"`
}

func (gateway *PaymentGateway) FindConnectedAccountForUser(ctx context.Context, executor databases.ExecutorQuerier, userId string) (*ent.ConnectedAccount, error) {
	account, err := gateway.FindConnectedAccountRowForUser(ctx, executor, userId)
	if err != nil {
		return nil, err
	}
	if account.Status != connectedaccount.StatusCreated || account.RecipientCode == "" {
		return nil, ErrConnectedAccountMissing
	}
	return account, nil
}

func (gateway *PaymentGateway) EnsureConnectedAccountForUser(ctx context.Context, userId string, acceptPayments bool) (*ent.ConnectedAccount, error) {
	role := constants.ConnectedAccountRoleCreator
	if acceptPayments {
		role = constants.ConnectedAccountRoleSeller
	}
	return gateway.EnsureConnectedAccountForRole(ctx, userId, role)
}

func (gateway *PaymentGateway) SetConnectedAccountPayoutsFrozen(ctx context.Context, executor databases.ExecutorQuerier, userId string, frozen bool, reason string) error {
	return gateway.Container.Client(executor).ConnectedAccount.Update().Where(connectedaccount.UserID(userId)).
		SetPayoutsFrozen(frozen).SetPayoutsFrozenReason(truncate(reason, 300)).AddVersion(1).Exec(ctx)
}

func ConnectedAccountCanAcceptPayments(account *ent.ConnectedAccount) bool {
	return account.Status == connectedaccount.StatusCreated && account.SettlementSubaccountCode != "" && slices.Contains(account.Roles, constants.ConnectedAccountRoleSeller) && !account.PayoutsFrozen
}

func ConnectedAccountReadyForPayouts(account *ent.ConnectedAccount) bool {
	return account.Status == connectedaccount.StatusCreated && account.RecipientCode != "" && account.VerificationStatus == connectedaccount.VerificationStatusVerified
}

func ConvertConnectedAccountToView(account *ent.ConnectedAccount) ConnectedAccountView {
	updated := account.UpdatedAt
	return ConnectedAccountView{
		ReadyToAcceptPayments: ConnectedAccountCanAcceptPayments(account), ReadyForPayouts: ConnectedAccountReadyForPayouts(account), Roles: account.Roles,
		Status: string(account.Status), VerificationStatus: string(account.VerificationStatus), BankCode: account.BankCode, AccountLast4: account.AccountLast4,
		AccountName: account.AccountName, PayoutsOnHold: account.PayoutsFrozen, LastError: account.LastError, UpdatedAt: &updated,
	}
}

func (gateway *PaymentGateway) HandleCreatorApproved(ctx context.Context, accountId string) error {
	_, err := gateway.EnsureConnectedAccountForRole(ctx, accountId, constants.ConnectedAccountRoleCreator)
	if errors.Is(err, ErrVerifyEmailRequired) {
		return nil
	}
	return err
}

func (gateway *PaymentGateway) RequestPayoutAccountWhenMissing(ctx context.Context, userId string) error {
	_, err := gateway.FindConnectedAccountRowForUser(ctx, gateway.Container.Resources.Database, userId)
	if !errors.Is(err, ErrConnectedAccountMissing) {
		return err
	}
	_, err = gateway.EnsureConnectedAccountForRole(ctx, userId, constants.ConnectedAccountRoleCreator)
	return err
}
