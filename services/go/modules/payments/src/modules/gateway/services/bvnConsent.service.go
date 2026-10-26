package services

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/customervalidation"
	"nantty/modules/payments/src/generated/ent/payoutonboarding"
	"nantty/modules/payments/src/interfaces"
	"nantty/modules/payments/src/utils"
)

type BankValidationStart struct {
	Status     string `json:"status"`
	ConsentUrl string `json:"consentUrl,omitempty"`
	Reference  string `json:"reference,omitempty"`
}

func (gateway *PaymentGateway) bvnConsentVerifier() (interfaces.BvnConsentVerifier, bool) {
	provider, err := gateway.Container.DefaultProvider()
	if err != nil {
		return nil, false
	}
	verifier, supported := provider.(interfaces.BvnConsentVerifier)
	return verifier, supported
}

func (gateway *PaymentGateway) StartPayoutIdentityValidation(ctx context.Context, userId, returnTo string) (BankValidationStart, error) {
	verifier, consentFlow := gateway.bvnConsentVerifier()
	if !consentFlow {
		status, err := gateway.StartBankAccountValidation(ctx, userId)
		return BankValidationStart{Status: status}, err
	}
	database := gateway.Container.Resources.Database
	onboarding, err := gateway.Container.Client(database).PayoutOnboarding.Query().Where(payoutonboarding.UserID(userId)).Only(ctx)
	if ent.IsNotFound(err) || (err == nil && onboarding.LegalName == "") {
		return BankValidationStart{}, ErrOnboardingStepOrder
	}
	if err != nil {
		return BankValidationStart{}, err
	}
	var identity sealedOnboardingIdentity
	if onboarding.SealedIdentity != nil {
		if err := gateway.openSensitivePayload(*onboarding.SealedIdentity, &identity); err != nil {
			return BankValidationStart{}, err
		}
	}
	if identity.IdType != "bvn" || len(identity.IdNumber) != 11 {
		return BankValidationStart{}, ErrBvnRequired
	}
	existing, err := gateway.Container.Client(database).CustomerValidation.Query().Where(customervalidation.UserID(userId)).Only(ctx)
	if err != nil && !ent.IsNotFound(err) {
		return BankValidationStart{}, err
	}
	if existing != nil && existing.Status == customervalidation.StatusVerified {
		return BankValidationStart{Status: string(existing.Status)}, nil
	}
	firstName, lastName := splitLegalName(onboarding.LegalName)
	if returnTo == "" || !gateway.IsAllowedReturnUrl(returnTo) {
		returnTo = gateway.Container.Settings.OnboardingReturnUrl
	}
	session, err := verifier.StartBvnConsent(ctx, interfaces.BvnConsentRequest{Bvn: identity.IdNumber, FirstName: firstName, LastName: lastName, RedirectUrl: returnTo})
	if err != nil {
		gateway.Container.Resources.Logger.WarnContext(ctx, "BVN consent could not start", "userId", userId, "error", err)
		return BankValidationStart{}, ErrBankValidationUnavailable
	}
	bank := interfaces.PayeeBankAccount{BankCode: onboarding.BankCode}
	if err := gateway.recordPendingValidation(ctx, userId, session.Reference, bank); err != nil {
		return BankValidationStart{}, err
	}
	if session.ConsentUrl == "" {
		status, err := gateway.decideBvnConsent(ctx, session.Reference)
		return BankValidationStart{Status: status, Reference: session.Reference}, err
	}
	return BankValidationStart{Status: string(customervalidation.StatusPending), ConsentUrl: session.ConsentUrl, Reference: session.Reference}, nil
}

func (gateway *PaymentGateway) RefreshPayoutIdentityValidation(ctx context.Context, userId string) (BankValidationStart, error) {
	validation, err := gateway.Container.Client(gateway.Container.Resources.Database).CustomerValidation.Query().Where(customervalidation.UserID(userId)).Only(ctx)
	if ent.IsNotFound(err) {
		return BankValidationStart{Status: "not_started"}, nil
	}
	if err != nil {
		return BankValidationStart{}, err
	}
	if _, consentFlow := gateway.bvnConsentVerifier(); !consentFlow || validation.Status != customervalidation.StatusPending {
		return BankValidationStart{Status: string(validation.Status)}, nil
	}
	status, err := gateway.decideBvnConsent(ctx, validation.ProviderCustomerID)
	return BankValidationStart{Status: status}, err
}

func (gateway *PaymentGateway) HandleBvnConsentNotification(ctx context.Context, reference string) error {
	if reference == "" {
		return nil
	}
	_, err := gateway.decideBvnConsent(ctx, reference)
	return err
}

func (gateway *PaymentGateway) decideBvnConsent(ctx context.Context, reference string) (string, error) {
	verifier, consentFlow := gateway.bvnConsentVerifier()
	if !consentFlow {
		return "", ErrBankValidationNotSupported
	}
	identity, err := verifier.ReadBvnResult(ctx, reference)
	if err != nil {
		return "", convertProviderError(err)
	}
	if identity.Status != "COMPLETED" {
		return string(customervalidation.StatusPending), nil
	}
	var userId string
	var decided customervalidation.Status
	err = databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := gateway.Container.Client(transaction)
		validation, err := client.CustomerValidation.Query().Where(customervalidation.Provider(gateway.walletProviderName()), customervalidation.ProviderCustomerID(reference)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			gateway.Container.Resources.Logger.WarnContext(ctx, "BVN result for an unknown consent")
			return nil
		}
		if err != nil {
			return err
		}
		userId, decided = validation.UserID, validation.Status
		if validation.Status != customervalidation.StatusPending {
			return nil
		}
		onboarding, err := client.PayoutOnboarding.Query().Where(payoutonboarding.UserID(validation.UserID)).Only(ctx)
		if err != nil {
			return err
		}
		reason := bvnRejectionReason(identity, onboarding.LegalName, onboarding.ResolvedAccountName)
		update := validation.Update().SetDecidedAt(gateway.Container.Now().UTC()).AddVersion(1)
		decided = customervalidation.StatusVerified
		if reason != "" {
			decided = customervalidation.StatusFailed
		}
		if err := update.SetStatus(decided).SetFailureReason(reason).Exec(ctx); err != nil {
			return err
		}
		return gateway.refreshVerificationLevelInTransaction(ctx, transaction, validation.UserID)
	})
	if err != nil || userId == "" {
		return string(decided), err
	}
	if decided == customervalidation.StatusVerified {
		if _, err := gateway.EnsureProviderWalletAtLevelOne(ctx, userId); err != nil && !errors.Is(err, ErrVerificationRequired) {
			gateway.Container.Resources.Logger.WarnContext(ctx, "wallet provisioning after verification failed; the worker retries", "userId", userId, "error", err)
		}
	}
	return string(decided), nil
}

func bvnRejectionReason(identity interfaces.BvnIdentity, legalName, bankAccountName string) string {
	bvnName := strings.TrimSpace(identity.FirstName + " " + identity.MiddleName + " " + identity.LastName)
	switch {
	case identity.Watchlisted:
		return "This BVN needs a manual review before payouts. Our team will contact you."
	case !utils.NamesMatch(bvnName, legalName):
		return "The name on your BVN does not match the name you entered."
	case bankAccountName != "" && !utils.NamesMatch(bvnName, bankAccountName):
		return "The bank account must be in the same name as your BVN."
	}
	return ""
}
