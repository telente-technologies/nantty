package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"sync"

	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/interfaces"
)

type HttpAdBalanceWithdrawalGateway struct {
	BaseUrl string
	Token   string
	Http    *http.Client
}

func (gateway HttpAdBalanceWithdrawalGateway) MoveAdBalanceToWallet(ctx context.Context, request interfaces.AdBalanceWithdrawalRequest) error {
	encoded, err := json.Marshal(map[string]any{
		"userId": request.UserId, "currency": request.Currency, "grossMinor": request.GrossMinor, "feeMinor": request.FeeMinor, "idempotencyKey": request.IdempotencyKey,
	})
	if err != nil {
		return err
	}
	address := strings.TrimRight(gateway.BaseUrl, "/") + "/api/v1/internal/ads/accounts/" + url.PathEscape(request.AdAccountId) + "/withdrawals"
	outgoing, err := http.NewRequestWithContext(ctx, http.MethodPost, address, bytes.NewReader(encoded))
	if err != nil {
		return err
	}
	outgoing.Header.Set("Content-Type", "application/json")
	outgoing.Header.Set("X-Internal-Token", gateway.Token)
	response, err := gateway.Http.Do(outgoing)
	if err != nil {
		return adserrors.UpstreamUnavailable
	}
	defer response.Body.Close()
	if response.StatusCode >= 200 && response.StatusCode < 300 {
		return nil
	}
	var failure struct {
		Code string `json:"code"`
	}
	_ = json.NewDecoder(response.Body).Decode(&failure)
	switch {
	case failure.Code == "INSUFFICIENT_FUNDS" || failure.Code == "WITHDRAWAL_ABOVE_AVAILABLE":
		return adserrors.WithdrawalAboveAvailable
	case failure.Code == "IDEMPOTENCY_KEY_REUSED":
		return adserrors.IdempotencyKeyReused
	case response.StatusCode >= 400 && response.StatusCode < 500:
		return adserrors.WithdrawalRefused
	}
	return adserrors.UpstreamUnavailable
}

type InMemoryAdBalanceWithdrawals struct {
	mutex sync.Mutex
	Moved map[string]interfaces.AdBalanceWithdrawalRequest
	Fail  error
}

func NewInMemoryAdBalanceWithdrawals() *InMemoryAdBalanceWithdrawals {
	return &InMemoryAdBalanceWithdrawals{Moved: map[string]interfaces.AdBalanceWithdrawalRequest{}}
}

func (gateway *InMemoryAdBalanceWithdrawals) MoveAdBalanceToWallet(_ context.Context, request interfaces.AdBalanceWithdrawalRequest) error {
	gateway.mutex.Lock()
	defer gateway.mutex.Unlock()
	if gateway.Fail != nil {
		return gateway.Fail
	}
	if existing, found := gateway.Moved[request.IdempotencyKey]; found && existing != request {
		return adserrors.IdempotencyKeyReused
	}
	gateway.Moved[request.IdempotencyKey] = request
	return nil
}

type UnconfiguredAdBalanceWithdrawals struct{}

func (UnconfiguredAdBalanceWithdrawals) MoveAdBalanceToWallet(context.Context, interfaces.AdBalanceWithdrawalRequest) error {
	return adserrors.UpstreamUnavailable
}
