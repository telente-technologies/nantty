package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/payments/src/constants"
	"zudomart/modules/payments/src/generated/ent"
	"zudomart/modules/payments/src/generated/ent/connectedaccount"
	"zudomart/modules/payments/src/interfaces"
)

type ConnectedAccountView struct {
	ReadyToAcceptPayments   bool              `json:"readyToAcceptPayments"`
	ReadyForPayouts         bool              `json:"readyForPayouts"`
	ReadyForTransfers       bool              `json:"readyForTransfers"`
	Capabilities            map[string]string `json:"capabilities"`
	OutstandingRequirements []string          `json:"outstandingRequirements"`
	RequirementsDeadlineAt  *time.Time        `json:"requirementsDeadlineAt"`
	PayoutsOnHold           bool              `json:"payoutsOnHold"`
	VirtualAccountNumber    string            `json:"virtualAccountNumber,omitempty"`
	VirtualAccountBankName  string            `json:"virtualAccountBankName,omitempty"`
}

func (gateway *PaymentGateway) FindConnectedAccountForUser(ctx context.Context, executor databases.ExecutorQuerier, userId string) (*ent.ConnectedAccount, error) {
	account, err := gateway.Container.Client(executor).ConnectedAccount.Query().
		Where(connectedaccount.UserID(userId), connectedaccount.Provider(gateway.Container.Settings.DefaultProvider)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, ErrConnectedAccountMissing
	}
	return account, err
}

func (gateway *PaymentGateway) EnsureConnectedAccountForUser(ctx context.Context, userId string, acceptPayments bool) (*ent.ConnectedAccount, error) {
	existing, err := gateway.FindConnectedAccountForUser(ctx, gateway.Container.Resources.Database, userId)
	if err == nil || !errors.Is(err, ErrConnectedAccountMissing) {
		return existing, err
	}
	contact, err := gateway.requireVerifiedContact(ctx, userId)
	if err != nil {
		return nil, err
	}
	provider, err := gateway.Container.DefaultProvider()
	if err != nil {
		return nil, err
	}
	state, err := provider.CreateConnectedAccount(ctx, interfaces.ConnectedAccountRequest{
		ContactEmail: contact.Email, DisplayName: contact.Name, Country: gateway.Container.Settings.ConnectedAccountCountry,
		EntityType: "individual", AcceptPayments: acceptPayments, IdempotencyKey: "connected-account:" + userId,
	})
	if err != nil {
		return nil, convertProviderError(err)
	}
	manualSchedule := false
	if acceptPayments {
		if err := provider.UseManualPayoutSchedule(ctx, state.AccountId, "NGN"); err != nil {
			return nil, convertProviderError(err)
		}
		manualSchedule = true
	}
	capabilities, _ := json.Marshal(state.CapabilityStatuses)
	requirements, _ := json.Marshal(state.OutstandingRequirements)
	err = gateway.Container.Client(gateway.Container.Resources.Database).ConnectedAccount.Create().
		SetUserID(userId).SetProvider(provider.Name()).SetProviderAccountID(state.AccountId).SetAcceptsPayments(acceptPayments).
		SetCapabilityStatuses(capabilities).SetOutstandingRequirements(requirements).SetNillableRequirementsDeadlineAt(state.CurrentDeadline).
		SetManualPayoutScheduleConfirmed(manualSchedule).SetCreatedAt(gateway.Container.Now()).
		OnConflictColumns(connectedaccount.FieldUserID, connectedaccount.FieldProvider).DoNothing().Exec(ctx)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	return gateway.FindConnectedAccountForUser(ctx, gateway.Container.Resources.Database, userId)
}

func (gateway *PaymentGateway) CreateOnboardingLinkForUser(ctx context.Context, userId string) (interfaces.OnboardingLink, error) {
	account, err := gateway.FindConnectedAccountForUser(ctx, gateway.Container.Resources.Database, userId)
	if err != nil {
		return interfaces.OnboardingLink{}, err
	}
	provider, err := gateway.Container.Provider(account.Provider)
	if err != nil {
		return interfaces.OnboardingLink{}, err
	}
	link, err := provider.CreateOnboardingLink(ctx, interfaces.OnboardingLinkRequest{
		ConnectedAccountId: account.ProviderAccountID, LinkType: "onboarding",
		RefreshUrl: gateway.Container.Settings.OnboardingRefreshUrl, ReturnUrl: gateway.Container.Settings.OnboardingReturnUrl,
	})
	return link, convertProviderError(err)
}

func (gateway *PaymentGateway) CreateVirtualAccountForUser(ctx context.Context, userId string) (ConnectedAccountView, error) {
	account, err := gateway.FindConnectedAccountForUser(ctx, gateway.Container.Resources.Database, userId)
	if err != nil {
		return ConnectedAccountView{}, err
	}
	if account.VirtualAccountNumber == "" {
		provider, err := gateway.Container.Provider(account.Provider)
		if err != nil {
			return ConnectedAccountView{}, err
		}
		virtual, err := provider.CreateVirtualAccount(ctx, account.ProviderAccountID, "NGN")
		if err != nil {
			return ConnectedAccountView{}, convertProviderError(err)
		}
		if account, err = account.Update().SetVirtualAccountNumber(virtual.AccountNumber).SetVirtualAccountBankName(virtual.BankName).Save(ctx); err != nil {
			return ConnectedAccountView{}, err
		}
	}
	return ConvertConnectedAccountToView(account), nil
}

func (gateway *PaymentGateway) RefreshConnectedAccountFromProvider(ctx context.Context, providerAccountId string, capability, status string) error {
	client := gateway.Container.Client(gateway.Container.Resources.Database)
	account, err := client.ConnectedAccount.Query().Where(connectedaccount.ProviderAccountID(providerAccountId)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	provider, err := gateway.Container.Provider(account.Provider)
	if err != nil {
		return err
	}
	state, err := provider.ReadConnectedAccount(ctx, providerAccountId)
	if err != nil {
		return err
	}
	if capability != "" && state.CapabilityStatuses[capability] == "" {
		state.CapabilityStatuses[capability] = status
	}
	capabilities, _ := json.Marshal(state.CapabilityStatuses)
	requirements, _ := json.Marshal(state.OutstandingRequirements)
	update := account.Update().SetCapabilityStatuses(capabilities).SetOutstandingRequirements(requirements).AddVersion(1)
	if state.CurrentDeadline != nil {
		update.SetRequirementsDeadlineAt(*state.CurrentDeadline)
	} else {
		update.ClearRequirementsDeadlineAt()
	}
	return update.Exec(ctx)
}

func (gateway *PaymentGateway) SetConnectedAccountPayoutsFrozen(ctx context.Context, executor databases.ExecutorQuerier, connectedAccountId string, frozen bool, reason string) error {
	return gateway.Container.Client(executor).ConnectedAccount.Update().Where(connectedaccount.ProviderAccountID(connectedAccountId)).
		SetPayoutsFrozen(frozen).SetPayoutsFrozenReason(truncate(reason, 300)).AddVersion(1).Exec(ctx)
}

func ConnectedAccountCapabilities(account *ent.ConnectedAccount) map[string]string {
	statuses := map[string]string{}
	_ = json.Unmarshal(account.CapabilityStatuses, &statuses)
	return statuses
}

func ConnectedAccountCanAcceptPayments(account *ent.ConnectedAccount) bool {
	statuses := ConnectedAccountCapabilities(account)
	merchantActive := statuses[constants.CapabilityNairaCardCharges] == constants.CapabilityStatusActive || statuses[constants.CapabilityBankTransfers] == constants.CapabilityStatusActive
	return account.AcceptsPayments && account.ManualPayoutScheduleConfirmed && merchantActive
}

func ConnectedAccountCapabilityActive(account *ent.ConnectedAccount, capability string) bool {
	return ConnectedAccountCapabilities(account)[capability] == constants.CapabilityStatusActive
}

func ConvertConnectedAccountToView(account *ent.ConnectedAccount) ConnectedAccountView {
	requirements := []string{}
	_ = json.Unmarshal(account.OutstandingRequirements, &requirements)
	return ConnectedAccountView{
		ReadyToAcceptPayments: ConnectedAccountCanAcceptPayments(account), ReadyForPayouts: ConnectedAccountCapabilityActive(account, constants.CapabilityPayouts),
		ReadyForTransfers: ConnectedAccountCapabilityActive(account, constants.CapabilityTransfers), Capabilities: ConnectedAccountCapabilities(account),
		OutstandingRequirements: requirements, RequirementsDeadlineAt: account.RequirementsDeadlineAt, PayoutsOnHold: account.PayoutsFrozen,
		VirtualAccountNumber: account.VirtualAccountNumber, VirtualAccountBankName: account.VirtualAccountBankName,
	}
}
