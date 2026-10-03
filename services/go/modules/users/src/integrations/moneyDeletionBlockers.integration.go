package integrations

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
)

type DeletionBlockers struct {
	PendingWithdrawals int `json:"pendingWithdrawals"`
	NonZeroBalances    []struct {
		Currency string `json:"currency"`
		Kind     string `json:"kind"`
		Amount   int64  `json:"amountMinor"`
	} `json:"nonZeroBalances"`
	CanDelete bool `json:"canDelete"`
}

type HttpPendingWithdrawalChecker struct {
	BaseUrl string
	Token   string
	Client  *http.Client
}

func NewHttpPendingWithdrawalChecker(baseUrl, token string) HttpPendingWithdrawalChecker {
	return HttpPendingWithdrawalChecker{BaseUrl: baseUrl, Token: token, Client: &http.Client{Timeout: 10 * time.Second}}
}

func (checker HttpPendingWithdrawalChecker) Blockers(ctx context.Context, accountId uuid.UUID) (DeletionBlockers, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, checker.BaseUrl+"/api/v1/internal/accounts/"+accountId.String()+"/deletion-blockers", nil)
	if err != nil {
		return DeletionBlockers{}, err
	}
	request.Header.Set("X-Internal-Token", checker.Token)
	response, err := checker.Client.Do(request)
	if err != nil {
		return DeletionBlockers{}, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return DeletionBlockers{}, fmt.Errorf("money service answered %d", response.StatusCode)
	}
	var blockers DeletionBlockers
	return blockers, json.NewDecoder(response.Body).Decode(&blockers)
}

func (checker HttpPendingWithdrawalChecker) HasPendingWithdrawals(ctx context.Context, accountId uuid.UUID) (bool, error) {
	blockers, err := checker.Blockers(ctx, accountId)
	return !blockers.CanDelete, err
}
