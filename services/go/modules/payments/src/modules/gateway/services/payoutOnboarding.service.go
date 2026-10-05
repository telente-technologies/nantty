package services

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"slices"
	"strings"
	"time"

	"zudomart/modules/ledger/src/databases"
	ledgermodels "zudomart/modules/ledger/src/modules/journal/models"
	"zudomart/modules/payments/src/constants"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/connectedaccountjob"
	"zudomart/modules/payments/src/generated/ent/payoutonboarding"
	"zudomart/modules/payments/src/interfaces"
	"zudomart/modules/payments/src/modules/gateway/models"
	"zudomart/platform/httpserver"
)

var (
	ErrOnboardingNameMismatch   = httpserver.NewApiError(http.StatusUnprocessableEntity, "NAME_MISMATCH", "The name on this bank account does not match your legal name.")
	ErrDocumentLinkNotReady     = httpserver.NewApiError(http.StatusConflict, "ACCOUNT_NOT_READY", "ID verification is not needed yet.")
	ErrDocumentLinkUnavailable  = httpserver.NewApiError(http.StatusServiceUnavailable, "LINK_UNAVAILABLE", "Try again in a moment.")
	ErrOnboardingStepOrder      = httpserver.NewApiError(http.StatusConflict, "IDENTITY_REQUIRED", "Tell us who you are first.")
	ErrPayoutAccountNotVerified = httpserver.NewApiError(http.StatusForbidden, "PAYOUT_ACCOUNT_NOT_VERIFIED", "Finish payout setup before withdrawing.")
)

type OnboardingIdentityInput struct {
	Role               string
	LegalName          string `json:"legalName"`
	DateOfBirth        string `json:"dateOfBirth"`
	AddressLine1       string `json:"addressLine1"`
	City               string `json:"city"`
	State              string `json:"state"`
	IdType             string `json:"idType"`
	IdNumber           string `json:"idNumber"`
	RegisteredBusiness bool   `json:"registeredBusiness"`
}

type BusinessDetails struct {
	CacNumber    string `json:"cacNumber"`
	BusinessType string `json:"businessType"`
}

type OnboardingBankInput struct {
	BankCode      string
	BankName      string
	AccountNumber string
}

func (gateway *PaymentGateway) ReadPayoutOnboardingState(ctx context.Context, userId, role string) (models.PayoutOnboardingState, error) {
	executor := gateway.Container.Resources.Database
	client := gateway.Container.Client(executor)
	onboarding, err := client.PayoutOnboarding.Query().Where(payoutonboarding.UserID(userId)).Only(ctx)
	if err != nil && !ent.IsNotFound(err) {
		return models.PayoutOnboardingState{}, err
	}
	inputs := models.PayoutOnboardingInputs{Role: role}
	if onboarding != nil {
		inputs.Role, inputs.CompletedSteps, inputs.RegisteredBusiness = firstNonEmpty(role, onboarding.Role), onboarding.CompletedSteps, onboarding.RegisteredBusiness
	}
	account, err := gateway.FindConnectedAccountRowForUser(ctx, executor, userId)
	if err != nil && !errors.Is(err, ErrConnectedAccountMissing) {
		return models.PayoutOnboardingState{}, err
	}
	if account != nil {
		inputs.AccountRowStatus, inputs.VerificationStatus, inputs.AccountRoles = string(account.Status), string(account.VerificationStatus), account.Roles
		inputs.PayoutsActive = ConnectedAccountReadyForPayouts(account)
		if IsDuplicateBankAccountJobError(account.LastError) {
			inputs.VerificationReasons = append(inputs.VerificationReasons, models.OnboardingReason{Step: "bank", Code: duplicateBankAccountCode, Message: ErrBankAccountAlreadyLinked.Message})
		} else if account.LastError != "" && account.Status != "created" {
			inputs.VerificationReasons = append(inputs.VerificationReasons, models.OnboardingReason{Step: "bank", Code: "ACCOUNT_SETUP_FAILED", Message: "We could not finish setting up your payout account. Tap Try again."})
		}
	}
	if inputs.LatestJobs, err = gateway.latestOnboardingJobs(ctx, client, userId); err != nil {
		return models.PayoutOnboardingState{}, err
	}
	state := models.BuildPayoutOnboardingState(inputs)
	state.ReviewEstimate = gateway.Container.Settings.VerificationReviewEstimate
	if onboarding != nil {
		state.LegalName, state.IdType, state.IdLast4 = onboarding.LegalName, onboarding.IDType, onboarding.IDLast4
		if onboarding.AccountLast4 != "" {
			state.BankSummary = &models.OnboardingBankSummary{BankName: onboarding.BankName, AccountLast4: onboarding.AccountLast4, AccountName: onboarding.ResolvedAccountName}
		}
	}
	balances, err := gateway.Container.Ledger.ReadAccountBalances(ctx, executor, []ledgermodels.AccountRef{
		ledgermodels.CreatorEarningsPayableAccount(userId, "NGN"), ledgermodels.SellerAvailableAccount(userId, "NGN"),
	})
	if err != nil {
		return models.PayoutOnboardingState{}, err
	}
	state.EarningsPendingTransfer = models.MoneyView{AmountMinor: balances[ledgermodels.CreatorEarningsPayableAccount(userId, "NGN").Key()], Currency: "NGN"}
	state.PendingWithdrawable = models.MoneyView{AmountMinor: max(balances[ledgermodels.SellerAvailableAccount(userId, "NGN").Key()], 0), Currency: "NGN"}
	return state, nil
}

func (gateway *PaymentGateway) latestOnboardingJobs(ctx context.Context, client *ent.Client, userId string) ([]models.OnboardingJobSnapshot, error) {
	jobs, err := client.ConnectedAccountJob.Query().Where(connectedaccountjob.UserID(userId)).Order(ent.Desc(connectedaccountjob.FieldVersion)).All(ctx)
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	snapshots := []models.OnboardingJobSnapshot{}
	for _, job := range jobs {
		if seen[string(job.Step)] {
			continue
		}
		seen[string(job.Step)] = true
		snapshots = append(snapshots, models.OnboardingJobSnapshot{Step: string(job.Step), Status: string(job.Status), AttemptCount: job.AttemptCount, LastError: job.LastError})
	}
	return snapshots, nil
}

func (gateway *PaymentGateway) SavePayoutOnboardingIdentity(ctx context.Context, userId string, input OnboardingIdentityInput) error {
	role := input.Role
	if role != constants.ConnectedAccountRoleSeller {
		role = constants.ConnectedAccountRoleCreator
	}
	if _, err := gateway.EnsureConnectedAccountForRole(ctx, userId, role); err != nil {
		return err
	}
	sealedIdentity, err := gateway.sealSensitivePayload(map[string]string{
		"dateOfBirth": input.DateOfBirth, "addressLine1": input.AddressLine1, "city": input.City, "state": input.State, "idType": input.IdType, "idNumber": input.IdNumber,
	})
	if err != nil {
		return err
	}
	return gateway.saveOnboardingStep(ctx, userId, "identity", nil, func(update *ent.PayoutOnboardingUpdateOne) {
		update.SetRole(role).SetLegalName(strings.TrimSpace(input.LegalName)).SetSealedIdentity(sealedIdentity).SetIDType(input.IdType).
			SetIDLast4(lastFour(input.IdNumber)).SetRegisteredBusiness(input.RegisteredBusiness)
	})
}

func (gateway *PaymentGateway) SavePayoutOnboardingBusiness(ctx context.Context, userId string, business BusinessDetails) error {
	return gateway.saveOnboardingStep(ctx, userId, "business", nil, func(update *ent.PayoutOnboardingUpdateOne) {
		update.SetCacNumber(business.CacNumber).SetBusinessType(business.BusinessType)
	})
}

func (gateway *PaymentGateway) SavePayoutOnboardingBank(ctx context.Context, userId string, input OnboardingBankInput) error {
	onboarding, err := gateway.Container.Client(gateway.Container.Resources.Database).PayoutOnboarding.Query().Where(payoutonboarding.UserID(userId)).Only(ctx)
	if ent.IsNotFound(err) || (err == nil && onboarding.LegalName == "") {
		return ErrOnboardingStepOrder
	}
	if err != nil {
		return err
	}
	accountName, err := gateway.ResolveOnboardingBankAccount(ctx, input.BankCode, input.AccountNumber)
	if err != nil {
		return err
	}
	if !models.NamesMatchIgnoringOrderAndCase(accountName, onboarding.LegalName) {
		return ErrOnboardingNameMismatch
	}
	bank := interfaces.PayeeBankAccount{UserId: userId, AccountName: accountName, BankCode: input.BankCode, AccountNumber: input.AccountNumber, Currency: "NGN"}
	if err := gateway.ClaimSettlementAccount(ctx, userId, bank); err != nil {
		return err
	}
	return gateway.saveOnboardingStep(ctx, userId, "bank", &bank, func(update *ent.PayoutOnboardingUpdateOne) {
		update.SetBankCode(input.BankCode).SetBankName(input.BankName).SetAccountLast4(lastFour(input.AccountNumber)).SetResolvedAccountName(accountName)
	})
}

func (gateway *PaymentGateway) ResolveOnboardingBankAccount(ctx context.Context, bankCode, accountNumber string) (string, error) {
	provider, err := gateway.Container.DefaultProvider()
	if err != nil {
		return "", err
	}
	accountName, err := provider.ResolveBankAccountName(ctx, bankCode, accountNumber)
	if errors.Is(err, interfaces.ErrBankAccountNotFound) {
		return "", ErrRefundBankAccountNotFound
	}
	if err != nil {
		return "", convertProviderError(err)
	}
	return accountName, nil
}

func (gateway *PaymentGateway) saveOnboardingStep(ctx context.Context, userId, step string, bank *interfaces.PayeeBankAccount, apply func(*ent.PayoutOnboardingUpdateOne)) error {
	return databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := gateway.Container.Client(transaction)
		err := client.PayoutOnboarding.Create().SetUserID(userId).SetCreatedAt(gateway.Container.Now()).OnConflictColumns(payoutonboarding.FieldUserID).DoNothing().Exec(ctx)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		onboarding, err := client.PayoutOnboarding.Query().Where(payoutonboarding.UserID(userId)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		update := onboarding.Update()
		apply(update)
		if !slices.Contains(onboarding.CompletedSteps, step) {
			update.SetCompletedSteps(append(append([]string{}, onboarding.CompletedSteps...), step))
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		account, err := gateway.FindConnectedAccountRowForUser(ctx, transaction, userId)
		if err != nil || bank == nil {
			return err
		}
		if account.RecipientCode != "" {
			if err := account.Update().SetRecipientCode("").SetSettlementSubaccountCode("").SetEscrowSubaccountCode("").AddVersion(1).Exec(ctx); err != nil {
				return err
			}
		}
		if _, err := gateway.enqueueConnectedAccountStepInTransaction(ctx, transaction, userId, models.JobStepCreateRecipient, bank); err != nil {
			return err
		}
		if slices.Contains(account.Roles, constants.ConnectedAccountRoleSeller) {
			return gateway.enqueueSellerSubaccountJobsInTransaction(ctx, transaction, userId, *bank)
		}
		return nil
	})
}

func (gateway *PaymentGateway) RetryPayoutOnboarding(ctx context.Context, userId string) error {
	client := gateway.Container.Client(gateway.Container.Resources.Database)
	now := gateway.Container.Now().UTC()
	_, err := client.ConnectedAccountJob.Update().Where(connectedaccountjob.UserID(userId), connectedaccountjob.StatusEQ(connectedaccountjob.StatusFailed)).
		SetStatus(connectedaccountjob.StatusQueued).SetAttemptCount(0).SetNextAttemptAt(now).Save(ctx)
	if err != nil {
		return err
	}
	_, err = client.ConnectedAccountJob.Update().Where(connectedaccountjob.UserID(userId), connectedaccountjob.StatusEQ(connectedaccountjob.StatusQueued), connectedaccountjob.NextAttemptAtGT(now.Add(time.Minute))).
		SetNextAttemptAt(now).Save(ctx)
	return err
}

func (gateway *PaymentGateway) CreatePayoutVerificationLink(ctx context.Context, userId string) error {
	account, err := gateway.FindConnectedAccountRowForUser(ctx, gateway.Container.Resources.Database, userId)
	if err != nil || models.MapPayoutAccountStatus(string(account.Status), string(account.VerificationStatus)) != "documentsRequired" {
		return ErrDocumentLinkNotReady
	}
	return ErrDocumentLinkUnavailable
}

func (gateway *PaymentGateway) RequirePayoutAccountVerified(ctx context.Context, userId string) error {
	account, err := gateway.FindConnectedAccountForUser(ctx, gateway.Container.Resources.Database, userId)
	if err != nil || !ConnectedAccountReadyForPayouts(account) || account.PayoutsFrozen {
		return ErrPayoutAccountNotVerified
	}
	return nil
}

type PayoutDestinationDetails struct {
	BankCode      string `json:"bankCode"`
	AccountNumber string `json:"accountNumber"`
	Currency      string `json:"currency"`
}
