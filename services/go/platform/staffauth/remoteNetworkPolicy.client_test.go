package staffauth

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

type fixedNetworkPolicy struct {
	allowed bool
	err     error
}

func (policy fixedNetworkPolicy) IsStaffAddressAllowed(context.Context, string, string) (bool, error) {
	return policy.allowed, policy.err
}

func TestRemoteNetworkPolicyAsksIdentityOnceAndCachesTheAnswerBriefly(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		calls.Add(1)
		if request.Header.Get("X-Internal-Token") != "internal-token" || request.URL.Path != "/api/v1/internal/admins/staff-1/network-policy" {
			writer.WriteHeader(http.StatusUnauthorized)
			return
		}
		if request.URL.Query().Get("address") == "203.0.113.40" {
			_, _ = writer.Write([]byte(`{"allowed":true}`))
			return
		}
		_, _ = writer.Write([]byte(`{"allowed":false}`))
	}))
	defer server.Close()
	policy := NewRemoteNetworkPolicy(server.URL+"/", "internal-token")
	clock := time.Now()
	policy.now = func() time.Time { return clock }
	ctx := context.Background()
	for range 3 {
		if allowed, err := policy.IsStaffAddressAllowed(ctx, "staff-1", "203.0.113.40"); err != nil || !allowed {
			t.Fatalf("office address: %v %v", allowed, err)
		}
	}
	if allowed, err := policy.IsStaffAddressAllowed(ctx, "staff-1", "198.51.100.9"); err != nil || allowed {
		t.Fatalf("other address: %v %v", allowed, err)
	}
	if calls.Load() != 2 {
		t.Fatalf("answers must be cached, identity was asked %d times", calls.Load())
	}
	clock = clock.Add(networkPolicyCacheTtl + time.Second)
	_, _ = policy.IsStaffAddressAllowed(ctx, "staff-1", "203.0.113.40")
	if calls.Load() != 3 {
		t.Fatalf("an expired answer must be asked again, calls %d", calls.Load())
	}
	if _, err := NewRemoteNetworkPolicy(server.URL, "wrong").IsStaffAddressAllowed(ctx, "staff-1", "203.0.113.40"); err == nil {
		t.Fatal("a refused policy call must be an error, never an allow")
	}
}

func TestNetworkGateFailsClosedInProductionAndRefusesDisallowedAddresses(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/api/v1/admin/reports", nil)
	cases := []struct {
		name string
		gate NetworkGate
		want int
	}{
		{"unconfigured outside production", NetworkGate{}, 0},
		{"unconfigured in production", NetworkGate{FailClosed: true}, http.StatusServiceUnavailable},
		{"policy unreachable", NetworkGate{Policy: fixedNetworkPolicy{err: errors.New("down")}}, http.StatusServiceUnavailable},
		{"address not allowed", NetworkGate{Policy: fixedNetworkPolicy{allowed: false}, FailClosed: true}, http.StatusForbidden},
		{"address allowed", NetworkGate{Policy: fixedNetworkPolicy{allowed: true}, FailClosed: true}, 0},
	}
	for _, testCase := range cases {
		failure := testCase.gate.Refuse(request, "staff-1")
		status := 0
		if failure != nil {
			status = failure.Status
		}
		if status != testCase.want {
			t.Fatalf("%s: status %d, want %d", testCase.name, status, testCase.want)
		}
	}
	restore := UseNetworkGate(NetworkGate{Policy: fixedNetworkPolicy{allowed: false}})
	if failure := RefuseDisallowedStaffNetwork(request, "staff-1"); failure == nil || failure.Code != "IP_NOT_ALLOWED" {
		t.Fatalf("the process gate must refuse: %+v", failure)
	}
	restore()
}

func TestNetworkGateFromEnvironmentFailsClosedInProductionWithoutAPolicy(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("STAFF_NETWORK_POLICY_URL", "")
	t.Setenv("ADMIN_INTERNAL_URL", "")
	t.Setenv("MODERATION_USERS_INTERNAL_URL", "")
	gate := NetworkGateFromEnvironment()
	if gate.Policy != nil || !gate.FailClosed {
		t.Fatalf("production without a policy must fail closed: %+v", gate)
	}
	t.Setenv("ADMIN_INTERNAL_URL", "http://go-identity:8080")
	t.Setenv("ADMIN_INTERNAL_API_TOKEN", "internal-token")
	if gate := NetworkGateFromEnvironment(); gate.Policy == nil {
		t.Fatal("the admin internal url and token configure the policy")
	}
}
