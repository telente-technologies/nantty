package auth

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/auth/src/configs"
	"nantty/platform/identityports"
	"nantty/platform/jwtauth"
	"nantty/platform/secretbox"
)

func (harness *authTestHarness) callWithDevice(method, path, deviceId string, body any) (int, map[string]any) {
	harness.t.Helper()
	encoded, _ := json.Marshal(body)
	request, _ := http.NewRequest(method, harness.server.URL+path, bytes.NewReader(encoded))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Device-Id", deviceId)
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		harness.t.Fatal(err)
	}
	defer response.Body.Close()
	decoded := map[string]any{}
	_ = json.NewDecoder(response.Body).Decode(&decoded)
	return response.StatusCode, decoded
}

func (harness *authTestHarness) enforcement() identityports.AccountEnforcement {
	port, err := identityports.Default.AccountEnforcement()
	if err != nil {
		harness.t.Fatal(err)
	}
	return port
}

func TestSuspendedAccountsCanSignInAsSuspendedAndBannedOnesCannot(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	email := "suspend.me@example.com"
	registered := harness.registerAccountAndLogIn(email, "firstpass1")
	accountId := uuid.MustParse(registered["user"].(map[string]any)["id"].(string))
	ctx := context.Background()

	if err := harness.enforcement().SuspendAccountAndRevokeSessions(ctx, accountId); err != nil {
		t.Fatal(err)
	}
	harness.expect("POST", "/api/v1/auth/refresh", "", map[string]string{"refreshToken": registered["refreshToken"].(string)}, http.StatusUnauthorized)
	login := harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": email, "password": "firstpass1"}, http.StatusOK)
	if login["user"].(map[string]any)["accountStatus"] != "suspended" {
		t.Fatalf("a suspended user signs in to see the suspension notice: %v", login)
	}
	verifier, err := jwtauth.NewAccessTokenVerifierFromRemoteJwks(ctx, harness.server.URL+"/.well-known/jwks.json", harness.settings.TokenIssuer, harness.settings.TokenAudience)
	if err != nil {
		t.Fatal(err)
	}
	principal, err := verifier.VerifyAccessTokenAndExtractPrincipal(ctx, login["accessToken"].(string))
	if err != nil || !contains(principal.Roles, "suspended") {
		t.Fatalf("the token carries the suspended role so services can deny actions: %v %+v", err, principal)
	}
	harness.expect("POST", "/api/v1/auth/refresh", "", map[string]string{"refreshToken": login["refreshToken"].(string)}, http.StatusOK)

	if err := harness.enforcement().BanAccountAndRevokeSessions(ctx, accountId, identityports.BanDetails{Reason: "fraud", BlockedBy: "staff-1"}); err != nil {
		t.Fatal(err)
	}
	banned := harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": email, "password": "firstpass1"}, http.StatusForbidden)
	if banned["code"] != "ACCOUNT_BANNED" {
		t.Fatalf("unexpected %v", banned)
	}
	if err := harness.enforcement().LiftBan(ctx, accountId); err != nil {
		t.Fatal(err)
	}
	harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": email, "password": "firstpass1"}, http.StatusOK)
	waitForPublishedEventTypes(t, harness.publisher, "accountStatus.changed")
}

func contains(values []string, wanted string) bool {
	for _, value := range values {
		if value == wanted {
			return true
		}
	}
	return false
}

func TestPermanentBanBlocksReSignupByEmailAndDeviceButTemporaryDoesNot(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	ctx := context.Background()
	email := "banned.person@example.com"
	registered := harness.registerAccountAndLogIn(email, "firstpass1")
	accountId := uuid.MustParse(registered["user"].(map[string]any)["id"].(string))
	if status, _ := harness.callWithDevice("POST", "/api/v1/auth/login", "device-banned-0001", map[string]string{"identifier": email, "password": "firstpass1"}); status != http.StatusOK {
		t.Fatalf("login with a device id failed: %d", status)
	}
	if err := harness.enforcement().BanAccountAndRevokeSessions(ctx, accountId, identityports.BanDetails{Reason: "ban evasion", BlockedBy: "staff-1", BlockFutureSignup: true}); err != nil {
		t.Fatal(err)
	}
	if err := harness.enforcement().MarkAccountDeleted(ctx, accountId, "deleted_abcd1234"); err != nil {
		t.Fatal(err)
	}

	harness.expect("POST", "/api/v1/auth/otp/send", "", map[string]string{"destination": email, "purpose": "signup"}, http.StatusOK)
	token := harness.expect("POST", "/api/v1/auth/otp/verify", "", map[string]string{"destination": email, "code": harness.lastLoggedOneTimeCode(), "purpose": "signup"}, http.StatusOK)["otpToken"].(string)
	blocked := harness.expect("POST", "/api/v1/auth/register", "", map[string]string{"email": email, "birthday": "1990-01-01", "password": "firstpass1", "otpToken": token}, http.StatusForbidden)
	if blocked["code"] != "SIGNUP_BLOCKED" {
		t.Fatalf("a banned email cannot sign up again: %v", blocked)
	}

	fresh := "fresh.address@example.com"
	harness.expect("POST", "/api/v1/auth/otp/send", "", map[string]string{"destination": fresh, "purpose": "signup"}, http.StatusOK)
	freshToken := harness.expect("POST", "/api/v1/auth/otp/verify", "", map[string]string{"destination": fresh, "code": harness.lastLoggedOneTimeCode(), "purpose": "signup"}, http.StatusOK)["otpToken"].(string)
	status, body := harness.callWithDevice("POST", "/api/v1/auth/register", "device-banned-0001", map[string]string{"email": fresh, "birthday": "1990-01-01", "password": "firstpass1", "otpToken": freshToken})
	if status != http.StatusForbidden || body["code"] != "SIGNUP_BLOCKED" {
		t.Fatalf("a banned device cannot sign up with a new email: %d %v", status, body)
	}
	if status, body := harness.callWithDevice("POST", "/api/v1/auth/register", "device-clean-00002", map[string]string{"email": fresh, "birthday": "1990-01-01", "password": "firstpass1", "otpToken": freshToken}); status != http.StatusCreated {
		t.Fatalf("an unrelated device may sign up: %d %v", status, body)
	}

	other := harness.registerAccountAndLogIn("temp.banned@example.com", "firstpass1")
	otherId := uuid.MustParse(other["user"].(map[string]any)["id"].(string))
	if err := harness.enforcement().BanAccountAndRevokeSessions(ctx, otherId, identityports.BanDetails{Reason: "cool off", BlockedBy: "staff-1"}); err != nil {
		t.Fatal(err)
	}
	if err := harness.enforcement().MarkAccountDeleted(ctx, otherId, "deleted_efgh5678"); err != nil {
		t.Fatal(err)
	}
	harness.registerAccountAndLogIn("temp.banned@example.com", "firstpass1")
}

func TestAdminCreatedAccountsMustChangeTheirPasswordAndOtpEventsCarryTheDestination(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t, func(settings *configs.AuthSettings) {
		settings.OneTimeCodeDeliveryMode = "event"
		settings.OtpEventKey = bytes.Repeat([]byte{9}, 32)
	})
	ctx := context.Background()
	if _, err := harness.enforcement().CreateAccountOnBehalf(ctx, identityports.CreateAccountRequest{Username: "official.account", Name: "Official", Email: "official@example.com", Password: "TemporaryPass-12"}); err != nil {
		t.Fatal(err)
	}
	if _, err := harness.enforcement().CreateAccountOnBehalf(ctx, identityports.CreateAccountRequest{Username: "official.account", Name: "Again", Email: "again@example.com", Password: "TemporaryPass-12"}); !errors.Is(err, identityports.ErrUsernameAlreadyTaken) {
		t.Fatalf("a taken username is refused: %v", err)
	}
	if _, err := harness.enforcement().CreateAccountOnBehalf(ctx, identityports.CreateAccountRequest{Username: "another.account", Name: "Again", Email: "official@example.com", Password: "TemporaryPass-12"}); !errors.Is(err, identityports.ErrEmailAlreadyTaken) {
		t.Fatalf("a taken email is refused: %v", err)
	}
	login := harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": "official.account", "password": "TemporaryPass-12"}, http.StatusOK)
	if login["user"].(map[string]any)["mustChangePassword"] != true {
		t.Fatalf("admin-created accounts are forced to change the password: %v", login)
	}
	harness.expect("POST", "/api/v1/auth/password/change", login["accessToken"].(string), map[string]string{"currentPassword": "TemporaryPass-12", "newPassword": "ChosenByOwner-34"}, http.StatusNoContent)
	again := harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": "official.account", "password": "ChosenByOwner-34"}, http.StatusOK)
	if again["user"].(map[string]any)["mustChangePassword"] != false {
		t.Fatalf("changing the password clears the flag: %v", again)
	}

	harness.expect("POST", "/api/v1/auth/otp/send", "", map[string]string{"destination": "newcomer@example.com", "purpose": "signup"}, http.StatusOK)
	waitForPublishedEventTypes(t, harness.publisher, "otp.issued")
	for _, event := range harness.publisher.Published {
		if event.EventType != "otp.issued" {
			continue
		}
		var data map[string]any
		_ = json.Unmarshal(event.Payload, &data)
		if payload, nested := data["data"].(map[string]any); nested {
			data = payload
		}
		sealed, err := base64.StdEncoding.DecodeString(data["codeSealed"].(string))
		if err != nil {
			t.Fatal(err)
		}
		plain, err := secretbox.OpenWithAesGcm(bytes.Repeat([]byte{9}, 32), sealed)
		if err != nil || len(plain) != 6 {
			t.Fatalf("the sealed code opens with the shared key: %v", err)
		}
		if data["destination"] != "newcomer@example.com" || data["code"] != nil || data["keyId"] != "otp-1" || data["expiresAt"] == nil || bytes.Contains(event.Payload, plain) {
			t.Fatalf("the published payload must not contain the plaintext code: %s", event.Payload)
		}
		if strings.Contains(harness.logs.String(), string(plain)) {
			t.Fatal("the code must not be logged")
		}
	}
}

type recordingDeletionCanceller struct {
	executed  bool
	pending   bool
	cancelled []uuid.UUID
}

func (canceller *recordingDeletionCanceller) AccountDeletionExecuted(context.Context, uuid.UUID) (bool, error) {
	return canceller.executed, nil
}

func (canceller *recordingDeletionCanceller) CancelPendingDeletionOnLogin(_ context.Context, accountId uuid.UUID) (bool, error) {
	if !canceller.pending {
		return false, nil
	}
	canceller.pending = false
	canceller.cancelled = append(canceller.cancelled, accountId)
	return true, nil
}

func TestLoggingInDuringTheDeletionGraceCancelsTheDeletionAndShowsANotice(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	email := "grace.leaver@example.com"
	registered := harness.registerAccountAndLogIn(email, "firstpass1")
	accountId := uuid.MustParse(registered["user"].(map[string]any)["id"].(string))
	canceller := &recordingDeletionCanceller{pending: true}
	identityports.Default.RegisterDeletionGraceCanceller(canceller)
	t.Cleanup(func() { identityports.Default.RegisterDeletionGraceCanceller(nil) })

	login := harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": email, "password": "firstpass1"}, http.StatusOK)
	if login["notice"] != "Your account deletion has been cancelled" || len(canceller.cancelled) != 1 || canceller.cancelled[0] != accountId {
		t.Fatalf("login inside the grace period must cancel the deletion and say so: %v", login)
	}
	again := harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": email, "password": "firstpass1"}, http.StatusOK)
	if again["notice"] != nil {
		t.Fatalf("no notice when nothing was pending: %v", again)
	}
}

func TestADeactivatedAccountComesBackOnLoginButAnExecutedDeletionStaysClosed(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	email := "away.for.now@example.com"
	registered := harness.registerAccountAndLogIn(email, "firstpass1")
	accountId := uuid.MustParse(registered["user"].(map[string]any)["id"].(string))
	canceller := &recordingDeletionCanceller{}
	identityports.Default.RegisterDeletionGraceCanceller(canceller)
	t.Cleanup(func() { identityports.Default.RegisterDeletionGraceCanceller(nil) })
	directory, err := identityports.Default.AccountDirectory()
	if err != nil {
		t.Fatal(err)
	}
	if err := directory.DeactivateAccountAndRevokeSessions(context.Background(), accountId); err != nil {
		t.Fatal(err)
	}
	back := harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": email, "password": "firstpass1"}, http.StatusOK)
	if back["notice"] != "Welcome back. Your account is active again." {
		t.Fatalf("logging in after deactivating must reactivate and say so: %v", back)
	}
	if err := directory.DeactivateAccountAndRevokeSessions(context.Background(), accountId); err != nil {
		t.Fatal(err)
	}
	harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": email, "password": "wrongpass1"}, http.StatusUnauthorized)
	canceller.executed = true
	refused := harness.expect("POST", "/api/v1/auth/login", "", map[string]string{"identifier": email, "password": "firstpass1"}, http.StatusForbidden)
	if refused["code"] != "ACCOUNT_DELETED" {
		t.Fatalf("an executed deletion must say the account was deleted: %v", refused)
	}
}
