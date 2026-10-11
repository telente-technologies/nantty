package middlewares_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/constants"
	"zudomart/modules/ledger/src/middlewares"
	"zudomart/platform/identityports"
	"zudomart/platform/identityports/identitytest"
	"zudomart/platform/jwtauth"
	"zudomart/platform/staffauth"
)

func priceTableMux(verifiers middlewares.StaffTokenVerifiers) *http.ServeMux {
	ok := http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) { writer.WriteHeader(http.StatusOK) })
	read := middlewares.RequireStaffWithAnyPermission(verifiers, []string{constants.PermissionReadMonetization, constants.PermissionManageMonetization}, false)
	write := middlewares.RequireStaffPermission(verifiers, constants.PermissionManageMonetization, true)
	mux := http.NewServeMux()
	mux.Handle("GET /api/v1/admin/coins/price-table", read(ok))
	mux.Handle("PUT /api/v1/admin/coins/price-table/{packageId}", write(ok))
	return mux
}

func signStaff(t *testing.T, tokens *identitytest.FakeTokenService, adminPermissions []string) (string, string) {
	t.Helper()
	claims := identityports.StaffTokenClaims{StaffId: uuid.NewString(), SessionId: uuid.NewString(), Roles: staffauth.RolesClaimForStaff(staffauth.AdminRole, staffauth.ExpandPermissionsWithAliases(adminPermissions))}
	access, _, err := tokens.SignStaffAccessToken(claims)
	if err != nil {
		t.Fatal(err)
	}
	stepUp, err := tokens.SignStaffStepUpToken(claims, 300_000_000_000)
	if err != nil {
		t.Fatal(err)
	}
	return access, stepUp
}

func call(mux *http.ServeMux, method, path, access, stepUp string) int {
	request := httptest.NewRequest(method, path, nil)
	request.Header.Set("Authorization", "Bearer "+access)
	if stepUp != "" {
		request.Header.Set(staffauth.StepUpHeader, stepUp)
	}
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, request)
	return response.Code
}

func TestReadOnlyConfigStaffCanViewButNotSavePriceTables(t *testing.T) {
	tokens := identitytest.NewFakeTokenService(t)
	verifiers := middlewares.StaffTokenVerifiers{
		Access: jwtauth.NewAccessTokenVerifierFromKeySetProvider(tokens.PublishedKeySet, tokens.StaffTokenIssuer(), staffauth.AccessAudience),
		StepUp: jwtauth.NewAccessTokenVerifierFromKeySetProvider(tokens.PublishedKeySet, tokens.StaffTokenIssuer(), staffauth.StepUpAudience),
	}
	mux := priceTableMux(verifiers)

	viewer, viewerStepUp := signStaff(t, tokens, []string{"config:read"})
	if status := call(mux, http.MethodGet, "/api/v1/admin/coins/price-table", viewer, ""); status != http.StatusOK {
		t.Fatalf("config:read viewing got %d", status)
	}
	if status := call(mux, http.MethodPut, "/api/v1/admin/coins/price-table/pack_1", viewer, viewerStepUp); status != http.StatusForbidden {
		t.Fatalf("config:read saving got %d", status)
	}

	editor, editorStepUp := signStaff(t, tokens, []string{"config:plans"})
	if status := call(mux, http.MethodPut, "/api/v1/admin/coins/price-table/pack_1", editor, ""); status != http.StatusForbidden {
		t.Fatalf("editor without step-up got %d", status)
	}
	if status := call(mux, http.MethodPut, "/api/v1/admin/coins/price-table/pack_1", editor, editorStepUp); status != http.StatusOK {
		t.Fatalf("editor with step-up got %d", status)
	}

	outsider, _ := signStaff(t, tokens, []string{"config:rules"})
	if status := call(mux, http.MethodGet, "/api/v1/admin/coins/price-table", outsider, ""); status != http.StatusForbidden {
		t.Fatalf("config:rules viewing got %d", status)
	}
}
