package sellingeligibility

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"sync"
	"time"

	platformconfig "nantty/platform/config"
	"nantty/platform/httpserver"
)

type Eligibility struct {
	CanSell   bool   `json:"canSell"`
	Country   string `json:"country"`
	Level     int    `json:"level"`
	Reason    string `json:"reason"`
	VerifyUrl string `json:"verifyUrl"`
	BlockedBy string `json:"blockedBy,omitempty"`
}

const BlockedByDebt = "debt"

var ErrSellerDebtLimit = httpserver.NewApiError(http.StatusForbidden, "SELLER_DEBT_LIMIT", "You owe more than the limit allowed. Clear what you owe before selling again.")

func RefusalFor(eligibility Eligibility) error {
	if eligibility.CanSell {
		return nil
	}
	if eligibility.BlockedBy == BlockedByDebt {
		return ErrSellerDebtLimit
	}
	return ErrVerificationRequired(eligibility.VerifyUrl)
}

var ErrVerificationUnavailable = httpserver.NewApiError(http.StatusServiceUnavailable, "VERIFICATION_UNAVAILABLE", "We couldn't confirm the seller's verification. Try again in a moment.")

func ErrVerificationRequired(verifyUrl string) *httpserver.ApiError {
	failure := httpserver.NewApiError(http.StatusForbidden, "VERIFICATION_REQUIRED", "Verify your identity and add a payout account in your own name before selling.")
	failure.VerifyUrl = verifyUrl
	return failure
}

type Resolver struct {
	BaseUrl  string
	Token    string
	Timeout  time.Duration
	AllowAll bool
	Now      func() time.Time
	mutex    sync.Mutex
	cache    map[string]cachedEligibility
}

type cachedEligibility struct {
	value     Eligibility
	expiresAt time.Time
}

var (
	configureOnce sync.Once
	Default       = &Resolver{Timeout: 2 * time.Second, Now: time.Now}
)

func ConfigureFromEnvironment(reader *platformconfig.EnvironmentReader, production bool) {
	configureOnce.Do(func() {
		Default.BaseUrl = reader.ReadStringOrDefault("SELLING_ELIGIBILITY_URL", reader.ReadStringOrDefault("SELLER_PLAN_ENTITLEMENTS_URL", ""))
		Default.Token = reader.ReadStringOrDefault("SELLING_ELIGIBILITY_TOKEN", reader.ReadStringOrDefault("SELLER_PLAN_ENTITLEMENTS_TOKEN", ""))
		Default.AllowAll = Default.BaseUrl == "" && !production
	})
}

func (resolver *Resolver) RequireCanSell(ctx context.Context, sellerUserId string) error {
	if resolver.AllowAll {
		return nil
	}
	eligibility, err := resolver.Read(ctx, sellerUserId)
	if err != nil {
		return ErrVerificationUnavailable
	}
	return RefusalFor(eligibility)
}

func (resolver *Resolver) Read(ctx context.Context, sellerUserId string) (Eligibility, error) {
	resolver.mutex.Lock()
	if hit, found := resolver.cache[sellerUserId]; found && hit.expiresAt.After(resolver.Now()) {
		resolver.mutex.Unlock()
		return hit.value, nil
	}
	resolver.mutex.Unlock()
	target, err := url.JoinPath(resolver.BaseUrl, "/api/v1/internal/sellers/", sellerUserId, "selling-eligibility")
	if err != nil {
		return Eligibility{}, err
	}
	ctx, cancel := context.WithTimeout(ctx, resolver.Timeout)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return Eligibility{}, err
	}
	request.Header.Set("x-internal-token", resolver.Token)
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return Eligibility{}, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return Eligibility{}, http.ErrNotSupported
	}
	var eligibility Eligibility
	if err := json.NewDecoder(response.Body).Decode(&eligibility); err != nil {
		return Eligibility{}, err
	}
	if eligibility.CanSell {
		resolver.mutex.Lock()
		if resolver.cache == nil {
			resolver.cache = map[string]cachedEligibility{}
		}
		resolver.cache[sellerUserId] = cachedEligibility{value: eligibility, expiresAt: resolver.Now().Add(time.Minute)}
		resolver.mutex.Unlock()
	}
	return eligibility, nil
}
