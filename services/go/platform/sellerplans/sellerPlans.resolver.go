package sellerplans

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/google/uuid"

	platformconfig "zudomart/platform/config"
)

type Plan string

const (
	Free     Plan = "free"
	Pro      Plan = "pro"
	Business Plan = "business"
)

func (plan Plan) rank() int {
	switch plan {
	case Business:
		return 2
	case Pro:
		return 1
	}
	return 0
}

func (plan Plan) AtLeast(required Plan) bool { return plan.rank() >= required.rank() }

var minimumPlanByFeature = map[string]Plan{
	"shipping_rules": Free, "advanced_inventory": Pro, "bulk_tools": Pro, "advanced_analytics": Pro, "advanced_reports": Pro, "customer_segments": Pro,
	"team": Pro, "advanced_promotions": Pro, "ads_tools": Pro, "multiple_warehouses": Pro, "automated_alerts": Pro, "api_webhooks": Pro,
	"multiple_stores": Business, "advanced_permissions": Business, "accounting_integrations": Business,
}

func MinimumPlanFor(feature string) Plan {
	if plan, known := minimumPlanByFeature[feature]; known {
		return plan
	}
	return Business
}

type Limits struct {
	MaxActiveProducts int
	MaxLocations      int
}

var limitsByPlan = map[Plan]Limits{Free: {100, 1}, Pro: {2000, 3}, Business: {0, 10}}

func LimitsFor(plan Plan) Limits { return limitsByPlan[plan] }

type Resolver struct {
	BaseUrl       string
	Token         string
	Timeout       time.Duration
	CacheDuration time.Duration
	Now           func() time.Time
	AllowAll      bool
	mutex         sync.Mutex
	cache         map[uuid.UUID]cachedPlan
}

type cachedPlan struct {
	plan      Plan
	expiresAt time.Time
}

var (
	configureOnce sync.Once
	Default       = &Resolver{Timeout: 2 * time.Second, CacheDuration: time.Minute, Now: time.Now, AllowAll: true}
)

func ConfigureFromEnvironment(reader *platformconfig.EnvironmentReader, production bool) {
	configureOnce.Do(func() {
		Default.BaseUrl = reader.ReadStringOrDefault("SELLER_PLAN_ENTITLEMENTS_URL", "")
		Default.Token = reader.ReadStringOrDefault("SELLER_PLAN_ENTITLEMENTS_TOKEN", "")
		Default.AllowAll = Default.BaseUrl == "" && !production
	})
}

func (resolver *Resolver) PlanOf(ctx context.Context, ownerAccountId uuid.UUID) Plan {
	if resolver.AllowAll {
		return Business
	}
	resolver.mutex.Lock()
	if hit, found := resolver.cache[ownerAccountId]; found && hit.expiresAt.After(resolver.Now()) {
		resolver.mutex.Unlock()
		return hit.plan
	}
	resolver.mutex.Unlock()
	plan, err := resolver.fetch(ctx, ownerAccountId)
	if err != nil {
		return Free
	}
	resolver.mutex.Lock()
	if resolver.cache == nil {
		resolver.cache = map[uuid.UUID]cachedPlan{}
	}
	resolver.cache[ownerAccountId] = cachedPlan{plan: plan, expiresAt: resolver.Now().Add(resolver.CacheDuration)}
	resolver.mutex.Unlock()
	return plan
}

func (resolver *Resolver) fetch(ctx context.Context, ownerAccountId uuid.UUID) (Plan, error) {
	target, err := url.JoinPath(resolver.BaseUrl, "/api/v1/internal/entitlements/", ownerAccountId.String())
	if err != nil {
		return Free, err
	}
	ctx, cancel := context.WithTimeout(ctx, resolver.Timeout)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return Free, err
	}
	request.Header.Set("x-internal-token", resolver.Token)
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return Free, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return Free, http.ErrNotSupported
	}
	var body struct {
		SellerPlan Plan `json:"sellerPlan"`
	}
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		return Free, err
	}
	if body.SellerPlan != Pro && body.SellerPlan != Business {
		return Free, nil
	}
	return body.SellerPlan, nil
}
