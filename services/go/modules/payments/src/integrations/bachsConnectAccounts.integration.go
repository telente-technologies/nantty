package integrations

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"zudomart/modules/payments/src/interfaces"
)

type bachsAccountResponse struct {
	Id           string `json:"id"`
	Capabilities map[string]struct {
		Status    string `json:"status"`
		Requested bool   `json:"requested"`
	} `json:"capabilities"`
	Requirements *struct {
		CurrentlyDue    []string `json:"currently_due"`
		PastDue         []string `json:"past_due"`
		CurrentDeadline *string  `json:"current_deadline"`
	} `json:"requirements"`
}

func (account bachsAccountResponse) toState() interfaces.ConnectedAccountState {
	state := interfaces.ConnectedAccountState{AccountId: account.Id, CapabilityStatuses: map[string]string{}, OutstandingRequirements: []string{}}
	for name, capability := range account.Capabilities {
		state.CapabilityStatuses[name] = capability.Status
	}
	if account.Requirements != nil {
		state.OutstandingRequirements = append(append(state.OutstandingRequirements, account.Requirements.PastDue...), account.Requirements.CurrentlyDue...)
		state.CurrentDeadline = optionalTime(account.Requirements.CurrentDeadline)
	}
	return state
}

func (provider *BachsConnectProvider) CreateConnectedAccount(ctx context.Context, request interfaces.ConnectedAccountRequest) (interfaces.ConnectedAccountState, error) {
	configuration := map[string]any{
		"recipient": map[string]any{"capabilities": map[string]any{"payouts": map[string]any{"requested": true}, "transfers": map[string]any{"requested": true}}},
	}
	if request.AcceptPayments {
		configuration["merchant"] = map[string]any{"capabilities": map[string]any{
			"ngn_card_collection": map[string]any{"requested": true}, "bank_transfer": map[string]any{"requested": true},
		}}
	}
	entityType := request.EntityType
	if entityType == "" {
		entityType = "individual"
	}
	body := map[string]any{
		"contact_email": request.ContactEmail, "display_name": request.DisplayName, "country": request.Country, "entity_type": entityType,
		"configuration": configuration, "responsibilities": map[string]any{"fees": map[string]any{"collector": "bachs"}},
	}
	var response bachsAccountResponse
	if err := provider.http.send(ctx, bachsRequest{method: http.MethodPost, path: "/v1/accounts", body: body, idempotencyKey: request.IdempotencyKey}, &response); err != nil {
		return interfaces.ConnectedAccountState{}, err
	}
	if response.Id == "" {
		return interfaces.ConnectedAccountState{}, fmt.Errorf("%w: bachs returned no account id", interfaces.ErrProviderUnavailable)
	}
	if request.AcceptPayments {
		balanceBody := map[string]any{"balance_currencies": map[string]any{"NGN": true}}
		if err := provider.http.send(ctx, bachsRequest{method: http.MethodPost, path: "/v1/accounts/" + url.PathEscape(response.Id), body: balanceBody, idempotencyKey: request.IdempotencyKey + ":currencies"}, nil); err != nil {
			return interfaces.ConnectedAccountState{}, err
		}
	}
	return response.toState(), nil
}

func (provider *BachsConnectProvider) ReadConnectedAccount(ctx context.Context, connectedAccountId string) (interfaces.ConnectedAccountState, error) {
	var response bachsAccountResponse
	if err := provider.http.send(ctx, bachsRequest{method: http.MethodGet, path: "/v1/accounts/" + url.PathEscape(connectedAccountId)}, &response); err != nil {
		return interfaces.ConnectedAccountState{}, err
	}
	return response.toState(), nil
}

func (provider *BachsConnectProvider) CreateOnboardingLink(ctx context.Context, request interfaces.OnboardingLinkRequest) (interfaces.OnboardingLink, error) {
	linkType := request.LinkType
	if linkType == "" {
		linkType = "onboarding"
	}
	var response struct {
		Url       string  `json:"url"`
		ExpiresAt *string `json:"expires_at"`
	}
	body := map[string]any{"type": linkType, "refresh_url": request.RefreshUrl, "return_url": request.ReturnUrl}
	idempotencyKey := fmt.Sprintf("account-link:%s:%d", request.ConnectedAccountId, provider.Now().UnixNano())
	if err := provider.http.send(ctx, bachsRequest{method: http.MethodPost, path: "/v1/accounts/" + url.PathEscape(request.ConnectedAccountId) + "/account-links", body: body, idempotencyKey: idempotencyKey}, &response); err != nil {
		return interfaces.OnboardingLink{}, err
	}
	link := interfaces.OnboardingLink{Url: response.Url, ExpiresAt: provider.Now().Add(time.Hour)}
	if expires := optionalTime(response.ExpiresAt); expires != nil {
		link.ExpiresAt = *expires
	}
	return link, nil
}

func (provider *BachsConnectProvider) SubmitRepresentativePerson(ctx context.Context, submission interfaces.RepresentativePersonSubmission) error {
	person := map[string]any{"first_name": submission.FirstName, "last_name": submission.LastName, "relationship": map[string]any{"representative": true}}
	if submission.DateOfBirth != "" {
		person["dob"] = submission.DateOfBirth
	}
	if submission.BankVerificationNumber != "" {
		person["id_numbers"] = []map[string]any{{"type": "bvn", "value": submission.BankVerificationNumber}}
	}
	path := "/v1/accounts/" + url.PathEscape(submission.ConnectedAccountId) + "/persons"
	return provider.http.send(ctx, bachsRequest{method: http.MethodPost, path: path, body: person, idempotencyKey: submission.IdempotencyKey}, nil)
}

func (provider *BachsConnectProvider) UseManualPayoutSchedule(ctx context.Context, connectedAccountId, currency string) error {
	body := map[string]any{"schedule_by_currency": map[string]any{currency: map[string]any{"interval": "manual"}}}
	return provider.http.send(ctx, bachsRequest{method: http.MethodPost, path: "/v1/balance_settings", body: body, connectedAccountId: connectedAccountId, idempotencyKey: "manual-schedule:" + connectedAccountId + ":" + currency}, nil)
}

func (provider *BachsConnectProvider) CreateVirtualAccount(ctx context.Context, connectedAccountId, currency string) (interfaces.VirtualAccount, error) {
	var response struct {
		Id            string `json:"id"`
		AccountNumber string `json:"account_number"`
		BankName      string `json:"bank_name"`
		Currency      string `json:"currency"`
	}
	err := provider.http.send(ctx, bachsRequest{method: http.MethodPost, path: "/v1/virtual-accounts", body: map[string]any{"currency": currency}, connectedAccountId: connectedAccountId, idempotencyKey: "virtual-account:" + connectedAccountId + ":" + currency}, &response)
	if err != nil {
		return interfaces.VirtualAccount{}, err
	}
	return interfaces.VirtualAccount{ProviderVirtualAccountId: response.Id, AccountNumber: response.AccountNumber, BankName: response.BankName, Currency: response.Currency}, nil
}
