package services

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strings"
	"time"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/connectedaccountjob"
	"zudomart/modules/payments/src/generated/ent/customervalidation"
	"zudomart/modules/payments/src/generated/ent/payoutonboarding"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/platform/httpserver"
)

const customerValidationRetryAfter = 10 * time.Minute

var (
	ErrBvnRequired                = httpserver.NewApiError(http.StatusUnprocessableEntity, "BVN_REQUIRED", "Add your BVN in payout setup so we can verify your bank account.")
	ErrBankAccountRequired        = httpserver.NewApiError(http.StatusConflict, "BANK_ACCOUNT_REQUIRED", "Add the bank account you want to be paid into first.")
	ErrBankValidationUnavailable  = httpserver.NewApiError(http.StatusServiceUnavailable, "BANK_VALIDATION_UNAVAILABLE", "We couldn't start bank verification. Try again in a moment.")
	ErrBankValidationNotSupported = httpserver.NewApiError(http.StatusUnprocessableEntity, "BANK_VALIDATION_NOT_SUPPORTED", "Bank account verification is not available with the current payment provider.")
)

type sealedOnboardingIdentity struct {
	IdType   string `json:"idType"`
	IdNumber string `json:"idNumber"`
}

func (gateway *PaymentGateway) StartBankAccountValidation(ctx context.Context, userId string) (string, error) {
	if gateway.customerValidationMode() == models.CustomerValidationOff {
		return "not_required", nil
	}
	provider, err := gateway.Container.DefaultProvider()
	if err != nil {
		return "", err
	}
	verifier, supported := provider.(interfaces.PayoutIdentityVerifier)
	if !supported {
		return "", ErrBankValidationNotSupported
	}
	database := gateway.Container.Resources.Database
	onboarding, err := gateway.Container.Client(database).PayoutOnboarding.Query().Where(payoutonboarding.UserID(userId)).Only(ctx)
	if ent.IsNotFound(err) || (err == nil && onboarding.LegalName == "") {
		return "", ErrOnboardingStepOrder
	}
	if err != nil {
		return "", err
	}
	var identity sealedOnboardingIdentity
	if onboarding.SealedIdentity != nil {
		if err := gateway.openSensitivePayload(*onboarding.SealedIdentity, &identity); err != nil {
			return "", err
		}
	}
	if identity.IdType != "bvn" || len(identity.IdNumber) != 11 {
		return "", ErrBvnRequired
	}
	bank, err := gateway.latestPayeeBankAccount(ctx, userId)
	if err != nil {
		return "", err
	}
	existing, err := gateway.Container.Client(database).CustomerValidation.Query().Where(customervalidation.UserID(userId)).Only(ctx)
	if err != nil && !ent.IsNotFound(err) {
		return "", err
	}
	sameBank := existing != nil && existing.BankCode == bank.BankCode && existing.AccountLast4 == lastFour(bank.AccountNumber)
	if sameBank && (existing.Status == customervalidation.StatusVerified || (existing.Status == customervalidation.StatusPending && gateway.Container.Now().Sub(existing.RequestedAt) < customerValidationRetryAfter)) {
		return string(existing.Status), nil
	}
	existingSubject, err := gateway.FindProviderCustomerId(ctx, userId)
	if err != nil {
		return "", err
	}
	email := ""
	if existingSubject == "" {
		contact, found, err := gateway.Container.Accounts.FindAccountContact(ctx, userId)
		if err != nil || !found || contact.Email == "" {
			return "", ErrBankValidationUnavailable
		}
		email = contact.Email
	}
	firstName, lastName := splitLegalName(onboarding.LegalName)
	customerId, err := verifier.RequestPayoutIdentityCheck(ctx, interfaces.PayoutIdentityRequest{
		UserId: userId, Email: email, FirstName: firstName, LastName: lastName, Country: "NG", Bvn: identity.IdNumber,
		BankCode: bank.BankCode, AccountNumber: bank.AccountNumber, SubjectId: existingSubject,
	})
	if err != nil || customerId == "" {
		gateway.Container.Resources.Logger.WarnContext(ctx, "payout identity check request failed", "userId", userId, "error", err)
		return "", ErrBankValidationUnavailable
	}
	if err := gateway.recordProviderCustomerInTransaction(ctx, gateway.Container.Client(database), userId, gateway.Container.Settings.DefaultProvider, customerId); err != nil {
		return "", err
	}
	return string(customervalidation.StatusPending), gateway.recordPendingValidation(ctx, userId, customerId, bank)
}

func (gateway *PaymentGateway) recordPendingValidation(ctx context.Context, userId, customerId string, bank interfaces.PayeeBankAccount) error {
	return databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client, now := gateway.Container.Client(transaction), gateway.Container.Now().UTC()
		err := client.CustomerValidation.Create().SetUserID(userId).SetProvider(gateway.Container.Settings.DefaultProvider).SetRequestedAt(now).
			OnConflictColumns(customervalidation.FieldUserID).DoNothing().Exec(ctx)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		if err := client.CustomerValidation.Update().Where(customervalidation.UserID(userId)).SetProviderCustomerID(customerId).SetStatus(customervalidation.StatusPending).
			SetBankCode(bank.BankCode).SetAccountLast4(lastFour(bank.AccountNumber)).SetFailureReason("").SetRequestedAt(now).ClearDecidedAt().AddVersion(1).Exec(ctx); err != nil {
			return err
		}
		return gateway.refreshVerificationLevelInTransaction(ctx, transaction, userId)
	})
}

func (gateway *PaymentGateway) latestPayeeBankAccount(ctx context.Context, userId string) (interfaces.PayeeBankAccount, error) {
	latest, err := gateway.Container.Client(gateway.Container.Resources.Database).ConnectedAccountJob.Query().
		Where(connectedaccountjob.UserID(userId), connectedaccountjob.StepEQ(connectedaccountjob.StepCreateRecipient)).
		Order(ent.Desc(connectedaccountjob.FieldVersion)).First(ctx)
	if ent.IsNotFound(err) || (err == nil && latest.SealedPayload == nil) {
		return interfaces.PayeeBankAccount{}, ErrBankAccountRequired
	}
	if err != nil {
		return interfaces.PayeeBankAccount{}, err
	}
	var bank interfaces.PayeeBankAccount
	if err := gateway.openSensitivePayload(*latest.SealedPayload, &bank); err != nil {
		return interfaces.PayeeBankAccount{}, err
	}
	if bank.AccountNumber == "" || bank.BankCode == "" {
		return interfaces.PayeeBankAccount{}, ErrBankAccountRequired
	}
	return bank, nil
}

func (gateway *PaymentGateway) HandleCustomerIdentificationNotification(ctx context.Context, notification interfaces.WebhookNotification) error {
	if notification.ProviderCustomerId == "" {
		return nil
	}
	succeeded := strings.HasSuffix(notification.EventType, ".success")
	return databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := gateway.Container.Client(transaction)
		validation, err := client.CustomerValidation.Query().
			Where(customervalidation.Provider(gateway.Container.Settings.DefaultProvider), customervalidation.ProviderCustomerID(notification.ProviderCustomerId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			gateway.Container.Resources.Logger.WarnContext(ctx, "identification result for an unknown customer", "customer", notification.ProviderCustomerId)
			return nil
		}
		if err != nil {
			return err
		}
		if validation.Status != customervalidation.StatusPending {
			return nil
		}
		update := validation.Update().SetDecidedAt(gateway.Container.Now().UTC()).AddVersion(1)
		if succeeded {
			update.SetStatus(customervalidation.StatusVerified).SetFailureReason("")
		} else {
			update.SetStatus(customervalidation.StatusFailed).SetFailureReason(truncate(firstNonEmpty(notification.FailureReason, "The bank account and BVN did not match."), 300))
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		return gateway.refreshVerificationLevelInTransaction(ctx, transaction, validation.UserID)
	})
}

func splitLegalName(legalName string) (string, string) {
	parts := strings.Fields(legalName)
	switch len(parts) {
	case 0:
		return "", ""
	case 1:
		return parts[0], parts[0]
	}
	return parts[0], parts[len(parts)-1]
}
