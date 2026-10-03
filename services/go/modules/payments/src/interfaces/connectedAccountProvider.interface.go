package interfaces

import (
	"context"
	"time"
)

type ConnectedAccountRequest struct {
	ContactEmail   string
	DisplayName    string
	Country        string
	EntityType     string
	AcceptPayments bool
	IdempotencyKey string
}

type ConnectedAccountState struct {
	AccountId               string
	CapabilityStatuses      map[string]string
	OutstandingRequirements []string
	CurrentDeadline         *time.Time
}

type OnboardingLinkRequest struct {
	ConnectedAccountId string
	LinkType           string
	RefreshUrl         string
	ReturnUrl          string
}

type OnboardingLink struct {
	Url       string
	ExpiresAt time.Time
}

type RepresentativePersonSubmission struct {
	ConnectedAccountId     string
	FirstName              string
	LastName               string
	DateOfBirth            string
	BankVerificationNumber string
	IdempotencyKey         string
}

type VirtualAccount struct {
	ProviderVirtualAccountId string
	AccountNumber            string
	BankName                 string
	Currency                 string
}

type ConnectedAccountProvider interface {
	CreateConnectedAccount(ctx context.Context, request ConnectedAccountRequest) (ConnectedAccountState, error)
	ReadConnectedAccount(ctx context.Context, connectedAccountId string) (ConnectedAccountState, error)
	CreateOnboardingLink(ctx context.Context, request OnboardingLinkRequest) (OnboardingLink, error)
	SubmitRepresentativePerson(ctx context.Context, submission RepresentativePersonSubmission) error
	UseManualPayoutSchedule(ctx context.Context, connectedAccountId, currency string) error
	CreateVirtualAccount(ctx context.Context, connectedAccountId, currency string) (VirtualAccount, error)
}
