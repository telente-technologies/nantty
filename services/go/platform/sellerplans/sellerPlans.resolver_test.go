package sellerplans

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestPlanLookupUsesInternalTokenAndCaches(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		calls.Add(1)
		if request.Header.Get("x-internal-token") != "secret" {
			writer.WriteHeader(http.StatusUnauthorized)
			return
		}
		_, _ = writer.Write([]byte(`{"sellerPlan":"pro"}`))
	}))
	defer server.Close()
	resolver := &Resolver{BaseUrl: server.URL, Token: "secret", Timeout: time.Second, CacheDuration: time.Minute, Now: time.Now}
	owner := uuid.New()
	for attempt := 0; attempt < 3; attempt++ {
		if plan := resolver.PlanOf(context.Background(), owner); plan != Pro {
			t.Fatalf("plan = %s, want pro", plan)
		}
	}
	if calls.Load() != 1 {
		t.Fatalf("calls = %d, want one cached lookup", calls.Load())
	}
}

func TestUnreachableEntitlementsFailClosedToFree(t *testing.T) {
	resolver := &Resolver{BaseUrl: "http://127.0.0.1:1", Timeout: 200 * time.Millisecond, CacheDuration: time.Minute, Now: time.Now}
	if resolver.PlanOf(context.Background(), uuid.New()) != Free {
		t.Fatal("an unreachable entitlements service must not grant paid features")
	}
}

func TestFeatureGateReturns402WithRequiredPlan(t *testing.T) {
	resolver := &Resolver{AllowAll: false, Now: time.Now, BaseUrl: "http://127.0.0.1:1", Timeout: 100 * time.Millisecond}
	recorder := httptest.NewRecorder()
	if resolver.RequireFeature(recorder, httptest.NewRequest(http.MethodGet, "/", nil), uuid.New(), "bulk_tools") {
		t.Fatal("free plan must not pass a pro feature")
	}
	if recorder.Code != http.StatusPaymentRequired || !contains(recorder.Body.String(), `"requiredPlan":"pro"`) || !contains(recorder.Body.String(), "PLAN_FEATURE_REQUIRED") {
		t.Fatalf("unexpected response %d %s", recorder.Code, recorder.Body.String())
	}
}

func TestMinimumPlans(t *testing.T) {
	if MinimumPlanFor("shipping_rules") != Free || MinimumPlanFor("advanced_inventory") != Pro || MinimumPlanFor("multiple_stores") != Business || MinimumPlanFor("logistics_dashboard") != Pro {
		t.Fatal("seller plan feature minimums are inconsistent")
	}
	if !Business.AtLeast(Pro) || Free.AtLeast(Pro) {
		t.Fatal("plan ordering broken")
	}
}

func contains(text, part string) bool {
	for index := 0; index+len(part) <= len(text); index++ {
		if text[index:index+len(part)] == part {
			return true
		}
	}
	return false
}

func TestFreePlanIsRecheckedSoonSoAnUpgradeShowsQuickly(t *testing.T) {
	plan := "free"
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		_, _ = writer.Write([]byte(`{"sellerPlan":"` + plan + `"}`))
	}))
	defer server.Close()
	clock := time.Date(2026, 10, 6, 10, 0, 0, 0, time.UTC)
	resolver := &Resolver{BaseUrl: server.URL, Timeout: time.Second, CacheDuration: time.Minute, Now: func() time.Time { return clock }}
	owner := uuid.New()
	if got := resolver.PlanOf(context.Background(), owner); got != Free {
		t.Fatalf("plan = %s, want free", got)
	}
	plan = "business"
	clock = clock.Add(6 * time.Second)
	if got := resolver.PlanOf(context.Background(), owner); got != Business {
		t.Fatalf("plan = %s, want business after the short free-plan cache", got)
	}
}

func TestUnconfiguredDefaultResolverDoesNotGrantEveryPlan(t *testing.T) {
	if Default.AllowAll {
		t.Fatal("the package default must not allow every feature before it is configured")
	}
}

func TestEntitlementFailuresAreCachedBrieflyDuringAnOutage(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		calls.Add(1)
		writer.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer server.Close()
	resolver := &Resolver{BaseUrl: server.URL, Timeout: time.Second, CacheDuration: time.Minute, Now: time.Now}
	owner := uuid.New()
	for attempt := 0; attempt < 3; attempt++ {
		if resolver.PlanOf(context.Background(), owner) != Free {
			t.Fatal("a failed lookup must resolve to free")
		}
	}
	if calls.Load() != 1 {
		t.Fatalf("calls = %d, want the failure cached", calls.Load())
	}
}
