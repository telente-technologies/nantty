package ads_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/lestrrat-go/jwx/v3/jwa"
	"github.com/lestrrat-go/jwx/v3/jwt"

	src "nantty/modules/ads/src"
	"nantty/modules/ads/src/configs"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adcreditlot"
	"nantty/modules/ads/src/services"
	"nantty/platform/staffaudit"
	"nantty/platform/staffauth"
)

type recordingAudit struct {
	mutex   sync.Mutex
	records []staffaudit.Record
}

func (audit *recordingAudit) Record(_ context.Context, record staffaudit.Record) error {
	audit.mutex.Lock()
	defer audit.mutex.Unlock()
	audit.records = append(audit.records, record)
	return nil
}

func (audit *recordingAudit) actions() []string {
	audit.mutex.Lock()
	defer audit.mutex.Unlock()
	actions := []string{}
	for _, record := range audit.records {
		actions = append(actions, record.Action)
	}
	return actions
}

type staffMember struct {
	id, sessionId, token string
}

func (h *harness) signWithRoles(subject, sessionId, audience string, roles []string) string {
	h.t.Helper()
	now := time.Now()
	token, err := jwt.NewBuilder().Issuer(testIssuer).Audience([]string{audience}).Subject(subject).IssuedAt(now).Expiration(now.Add(5*time.Minute)).
		JwtID(uuid.NewString()).Claim("sid", sessionId).Claim("roles", roles).Build()
	if err != nil {
		h.t.Fatal(err)
	}
	signed, err := jwt.Sign(token, jwt.WithKey(jwa.EdDSA(), h.signer))
	if err != nil {
		h.t.Fatal(err)
	}
	return string(signed)
}

func (h *harness) newStaff(name string, permissions ...string) staffMember {
	member := staffMember{id: uuid.NewString(), sessionId: uuid.NewString()}
	roles := []string{"name:" + name, "admin"}
	for _, permission := range permissions {
		roles = append(roles, "perm:"+permission)
	}
	member.token = h.signWithRoles(member.id, member.sessionId, testAudience, roles)
	return member
}

func (h *harness) staffCall(method, path string, staff staffMember, key string, steppedUp bool, body any) (int, map[string]any) {
	h.t.Helper()
	encoded, _ := json.Marshal(body)
	request, _ := http.NewRequest(method, h.server.URL+path, bytes.NewReader(encoded))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+staff.token)
	if key != "" {
		request.Header.Set("Idempotency-Key", key)
	}
	if steppedUp {
		request.Header.Set(staffauth.StepUpHeader, h.signWithRoles(staff.id, staff.sessionId, staffauth.StepUpAudience, []string{}))
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

func withAuditAndWithdrawalFees(audit *recordingAudit) harnessOption {
	return func(collaborators *src.Collaborators, settings *configs.AdsSettings) {
		collaborators.Audit = audit
		settings.WithdrawalFeeBps, settings.WithdrawalFeeCapMinor, settings.WithdrawalMinimumMinor = 150, map[string]int64{"NGN": 200_000}, map[string]int64{"NGN": 10_000}
	}
}

func ngn(amount int64) map[string]any {
	return map[string]any{"amountMinor": amount, "currency": "NGN"}
}

func (h *harness) issueCredit(staff staffMember, key string, userId uuid.UUID, amount int64, expiresAt *time.Time) map[string]any {
	h.t.Helper()
	body := map[string]any{"userId": userId.String(), "amount": ngn(amount), "expiresAt": nil, "reason": "Launch promotion credit"}
	if expiresAt != nil {
		body["expiresAt"] = expiresAt.UTC().Format(time.RFC3339)
	}
	status, issued := h.staffCall("POST", "/api/v1/admin/ads/credits", staff, key, true, body)
	if status != http.StatusCreated {
		h.t.Fatalf("issue credit = %d %v", status, issued)
	}
	return issued
}

func (h *harness) settleSpend() {
	h.t.Helper()
	if _, err := (services.AdSettlement{Client: h.module.Container.Client, Now: h.module.Container.Now}).SettlePendingCharges(context.Background()); err != nil {
		h.t.Fatal(err)
	}
}

func (h *harness) lotByReference(reference string) *ent.AdCreditLot {
	return h.module.Container.Client.AdCreditLot.Query().Where(adcreditlot.Reference(reference)).OnlyX(context.Background())
}
