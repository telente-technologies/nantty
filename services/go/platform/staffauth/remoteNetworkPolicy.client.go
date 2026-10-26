package staffauth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"nantty/platform/httpserver"
	"nantty/platform/identityports"
)

const (
	networkPolicyCacheTtl     = 30 * time.Second
	networkPolicyCacheMaximum = 10_000
)

type cachedNetworkDecision struct {
	allowed   bool
	expiresAt time.Time
}

type RemoteNetworkPolicy struct {
	baseUrl string
	token   string
	client  *http.Client
	ttl     time.Duration
	now     func() time.Time
	mutex   sync.Mutex
	cache   map[string]cachedNetworkDecision
}

func NewRemoteNetworkPolicy(baseUrl, token string) *RemoteNetworkPolicy {
	return &RemoteNetworkPolicy{
		baseUrl: strings.TrimRight(baseUrl, "/"), token: token, client: &http.Client{Timeout: 3 * time.Second},
		ttl: networkPolicyCacheTtl, now: time.Now, cache: map[string]cachedNetworkDecision{},
	}
}

func (policy *RemoteNetworkPolicy) IsStaffAddressAllowed(ctx context.Context, staffId, address string) (bool, error) {
	key := staffId + "|" + address
	policy.mutex.Lock()
	cached, found := policy.cache[key]
	policy.mutex.Unlock()
	if found && policy.now().Before(cached.expiresAt) {
		return cached.allowed, nil
	}
	target := policy.baseUrl + "/api/v1/internal/admins/" + url.PathEscape(staffId) + "/network-policy?address=" + url.QueryEscape(address)
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return false, err
	}
	request.Header.Set("X-Internal-Token", policy.token)
	response, err := policy.client.Do(request)
	if err != nil {
		return false, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return false, fmt.Errorf("staff network policy answered %d", response.StatusCode)
	}
	var decision struct {
		Allowed *bool `json:"allowed"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 4096)).Decode(&decision); err != nil || decision.Allowed == nil {
		return false, fmt.Errorf("unreadable staff network policy answer")
	}
	policy.mutex.Lock()
	if len(policy.cache) >= networkPolicyCacheMaximum {
		policy.cache = map[string]cachedNetworkDecision{}
	}
	policy.cache[key] = cachedNetworkDecision{allowed: *decision.Allowed, expiresAt: policy.now().Add(policy.ttl)}
	policy.mutex.Unlock()
	return *decision.Allowed, nil
}

type NetworkGate struct {
	Policy     identityports.StaffNetworkPolicy
	FailClosed bool
}

func NetworkGateFromEnvironment() NetworkGate {
	environment := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	gate := NetworkGate{FailClosed: environment == "production" || environment == "staging"}
	baseUrl := firstNonEmptyEnvironment("STAFF_NETWORK_POLICY_URL", "ADMIN_INTERNAL_URL", "MODERATION_USERS_INTERNAL_URL")
	if token := strings.TrimSpace(os.Getenv("ADMIN_INTERNAL_API_TOKEN")); baseUrl != "" && token != "" {
		gate.Policy = NewRemoteNetworkPolicy(baseUrl, token)
	}
	return gate
}

func firstNonEmptyEnvironment(names ...string) string {
	for _, name := range names {
		if value := strings.TrimSpace(os.Getenv(name)); value != "" {
			return value
		}
	}
	return ""
}

var errStaffNetworkPolicyUnavailable = httpserver.NewApiError(http.StatusServiceUnavailable, "UNAVAILABLE", "Staff authentication is unavailable.")

func (gate NetworkGate) Refuse(request *http.Request, staffId string) *httpserver.ApiError {
	if gate.Policy == nil {
		if gate.FailClosed {
			return errStaffNetworkPolicyUnavailable
		}
		return nil
	}
	allowed, err := gate.Policy.IsStaffAddressAllowed(request.Context(), staffId, ClientAddress(request))
	if err != nil {
		return errStaffNetworkPolicyUnavailable
	}
	if !allowed {
		return IpNotAllowed
	}
	return nil
}

var (
	defaultNetworkGateOnce sync.Once
	defaultNetworkGateLock sync.RWMutex
	defaultNetworkGate     NetworkGate
)

func currentNetworkGate() NetworkGate {
	defaultNetworkGateOnce.Do(func() {
		gate := NetworkGateFromEnvironment()
		defaultNetworkGateLock.Lock()
		defaultNetworkGate = gate
		defaultNetworkGateLock.Unlock()
	})
	defaultNetworkGateLock.RLock()
	defer defaultNetworkGateLock.RUnlock()
	return defaultNetworkGate
}

func UseNetworkGate(gate NetworkGate) (restore func()) {
	previous := currentNetworkGate()
	defaultNetworkGateLock.Lock()
	defaultNetworkGate = gate
	defaultNetworkGateLock.Unlock()
	return func() {
		defaultNetworkGateLock.Lock()
		defaultNetworkGate = previous
		defaultNetworkGateLock.Unlock()
	}
}

func RefuseDisallowedStaffNetwork(request *http.Request, staffId string) *httpserver.ApiError {
	return currentNetworkGate().Refuse(request, staffId)
}
