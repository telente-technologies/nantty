package ads_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/lestrrat-go/jwx/v3/jwa"
	"github.com/lestrrat-go/jwx/v3/jwt"

	src "nantty/modules/ads/src"
	"nantty/modules/ads/src/configs"
	"nantty/modules/ads/src/integrations"
	"nantty/modules/ads/src/interfaces"
	"nantty/platform/jwtauth"
)

type richMoneyAccounts struct{ *fakeMoneyAccounts }

func (money richMoneyAccounts) FundAdAccountFromEarnings(_ context.Context, _, _, currency string, amountMinor int64, key string) (interfaces.EarningsFundingResult, error) {
	return interfaces.EarningsFundingResult{FundingId: "funding-" + key[len(key)-8:], AmountMinor: amountMinor, Currency: currency}, nil
}

type steppedUser struct {
	testUser
	sessionId string
}

func (h *harness) sign(subject, sessionId, audience string) string {
	h.t.Helper()
	now := time.Now()
	token, err := jwt.NewBuilder().Issuer(testIssuer).Audience([]string{audience}).Subject(subject).IssuedAt(now).Expiration(now.Add(5*time.Minute)).
		JwtID(uuid.NewString()).Claim("sid", sessionId).Claim("roles", []string{}).Build()
	if err != nil {
		h.t.Fatal(err)
	}
	signed, err := jwt.Sign(token, jwt.WithKey(jwa.EdDSA(), h.signer))
	if err != nil {
		h.t.Fatal(err)
	}
	return string(signed)
}

func (h *harness) newSteppableUser(username string) steppedUser {
	identifier, sessionId := uuid.New(), uuid.NewString()
	h.users.register(identifier, username)
	return steppedUser{testUser: testUser{id: identifier, token: h.sign(identifier.String(), sessionId, testAudience)}, sessionId: sessionId}
}

func (h *harness) stepUpFor(user steppedUser) string {
	return h.sign(user.id.String(), user.sessionId, jwtauth.UserStepUpAudience)
}

func (h *harness) callWithStepUp(path string, user steppedUser, key, stepUp string, body any) (int, map[string]any) {
	h.t.Helper()
	encoded, _ := json.Marshal(body)
	request, _ := http.NewRequest(http.MethodPost, h.server.URL+path, bytes.NewReader(encoded))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Client-Region", "NG")
	request.Header.Set("Authorization", "Bearer "+user.token)
	request.Header.Set("Idempotency-Key", key)
	if stepUp != "" {
		request.Header.Set(jwtauth.UserStepUpHeader, stepUp)
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		h.t.Fatal(err)
	}
	defer response.Body.Close()
	decoded := map[string]any{}
	_ = json.NewDecoder(response.Body).Decode(&decoded)
	return response.StatusCode, decoded
}

func TestAdsMoneyAboveTheThresholdNeedsASingleUseStepUp(t *testing.T) {
	money := newFakeMoneyAccounts()
	h := startAdsAgainstFreshSchema(t, func(collaborators *src.Collaborators, settings *configs.AdsSettings) {
		withMoneyAccounts(money, &fakeTopUps{status: "pending"})(collaborators, settings)
		collaborators.Earnings = richMoneyAccounts{money}
		collaborators.StepUps = integrations.NewInMemoryStepUpConsumer()
	})
	owner := h.newSteppableUser("bola")
	money.levels[owner.id.String()] = 1
	account := h.expect("POST", "/api/v1/ads/accounts", &owner.testUser, "stepup-account-1", map[string]any{"name": "Bola Ads", "kind": "personal", "storeId": nil, "countryCode": "NG", "timezone": "Africa/Lagos"}, http.StatusCreated)
	path := "/api/v1/ads/accounts/" + account["id"].(string) + "/billing/fund-from-earnings"
	large := func(amount int64) map[string]any {
		return map[string]any{"amount": map[string]any{"amountMinor": amount, "currency": "NGN"}}
	}
	if status, _ := h.callWithStepUp(path, owner, "stepup-fund-edge-1", "", large(5_000_000)); status != http.StatusCreated {
		t.Fatalf("exactly the threshold needs no step-up, got %d", status)
	}
	status, refused := h.callWithStepUp(path, owner, "stepup-fund-0001", "", large(5_000_001))
	details, _ := refused["details"].(map[string]any)
	if status != http.StatusForbidden || refused["code"] != "STEP_UP_REQUIRED" || details["stepUpAbove"] == nil {
		t.Fatalf("one kobo above the threshold needs a step-up: %d %v", status, refused)
	}
	stepUp := h.stepUpFor(owner)
	if status, body := h.callWithStepUp(path, owner, "stepup-fund-0002", stepUp, large(6_000_000)); status != http.StatusCreated {
		t.Fatalf("a fresh step-up must be accepted: %d %v", status, body)
	}
	if status, body := h.callWithStepUp(path, owner, "stepup-fund-0003", stepUp, large(6_000_000)); status != http.StatusUnauthorized || body["code"] != "STEP_UP_REUSED" {
		t.Fatalf("a replayed step-up must be refused: %d %v", status, body)
	}
	other := h.newSteppableUser("seyi")
	if status, _ := h.callWithStepUp(path, owner, "stepup-fund-0004", h.stepUpFor(other), large(6_000_000)); status != http.StatusForbidden {
		t.Fatalf("another user's step-up must not count, got %d", status)
	}
	boost := boostBody("balance", 2_000_000, 3)
	if status, body := h.callWithStepUp("/api/v1/ads/boosts", owner, "stepup-boost-0001", "", boost); status != http.StatusForbidden || body["code"] != "STEP_UP_REQUIRED" {
		t.Fatalf("a boost paid from the balance above the threshold needs a step-up: %d %v", status, body)
	}
	if status, body := h.callWithStepUp("/api/v1/ads/boosts", owner, "stepup-boost-0002", h.stepUpFor(owner), boost); status != http.StatusCreated {
		t.Fatalf("a stepped-up boost must be created: %d %v", status, body)
	}
}
