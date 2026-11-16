package auth_test

import (
	"net/http"
	"testing"
)

const messengerAuthorizationsPath = "/api/v1/auth/messenger/authorizations"

func createMessengerAuthorization(t *testing.T, harness *authTestHarness, email, password, installationID string) map[string]any {
	t.Helper()
	return harness.expect("POST", messengerAuthorizationsPath, "", map[string]string{
		"identifier": email, "password": password, "platform": "android", "deviceName": "Pixel 9", "installationId": installationID,
	}, http.StatusAccepted)
}

func TestMessengerAuthorizationWithholdsSessionUntilAuthenticatedApprovalAndSupportsTrustedReuse(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	email, password, installationID := "messenger.approval@example.com", "messengerpass1", "pixel-install-0001"
	mainSession := harness.registerAccountAndLogIn(email, password)
	challenge := createMessengerAuthorization(t, harness, email, password, installationID)
	if challenge["status"] != "pending" || challenge["accessToken"] != nil || challenge["refreshToken"] != nil {
		t.Fatalf("pending Messenger authorization must not issue session tokens: %#v", challenge)
	}
	device := challenge["device"].(map[string]any)
	if device["name"] != "Pixel 9" || device["platform"] != "android" || device["requestedAt"] == "" || device["approximateLocation"] != nil {
		t.Fatalf("missing server-derived device context: %#v", device)
	}
	authorizationID, proof := challenge["authorizationId"].(string), challenge["proof"].(string)
	if status, _ := harness.call("GET", "/api/v1/auth/messenger/authorizations", "", nil); status != http.StatusUnauthorized {
		t.Fatalf("authorization list must require existing session, got %d", status)
	}
	listed := harness.expect("GET", messengerAuthorizationsPath, mainSession["accessToken"].(string), nil, http.StatusOK)
	if len(listed["authorizations"].([]any)) != 1 {
		t.Fatalf("expected one pending authorization: %#v", listed)
	}
	status := harness.expect("GET", messengerAuthorizationsPath+"/"+authorizationID, proof, nil, http.StatusOK)
	if status["status"] != "pending" || status["device"].(map[string]any)["name"] != "Pixel 9" {
		t.Fatalf("status must return request context: %#v", status)
	}
	if statusCode, _ := harness.call("GET", messengerAuthorizationsPath+"/"+authorizationID+"?proof="+proof, "", nil); statusCode != http.StatusUnauthorized {
		t.Fatalf("proof must not be accepted in query strings, got %d", statusCode)
	}
	if statusCode, _ := harness.call("POST", messengerAuthorizationsPath+"/"+authorizationID+"/approve", "", nil); statusCode != http.StatusUnauthorized {
		t.Fatalf("approval must require an existing authenticated session, got %d", statusCode)
	}
	harness.expect("POST", messengerAuthorizationsPath+"/"+authorizationID+"/approve", mainSession["accessToken"].(string), nil, http.StatusNoContent)
	completed := harness.expect("POST", messengerAuthorizationsPath+"/"+authorizationID+"/complete", proof, map[string]any{}, http.StatusOK)
	if completed["accessToken"] == nil || completed["refreshToken"] == nil || completed["trustedDevice"] == nil {
		t.Fatalf("completion must return ordinary session tokens and trusted credential: %#v", completed)
	}
	trusted := completed["trustedDevice"].(map[string]any)
	trustedLogin := harness.expect("POST", messengerAuthorizationsPath, "", map[string]string{
		"identifier": email, "password": password, "platform": "android", "deviceName": "Pixel 9", "installationId": installationID,
		"trustedDeviceToken": trusted["token"].(string),
	}, http.StatusOK)
	if trustedLogin["accessToken"] == nil || trustedLogin["trustedDevice"].(map[string]any)["token"] == trusted["token"] {
		t.Fatalf("trusted login should issue a session and rotate the device token: %#v", trustedLogin)
	}
	harness.expect("DELETE", "/api/v1/auth/messenger/devices/"+trusted["id"].(string), mainSession["accessToken"].(string), nil, http.StatusNoContent)
	revokedTokenLogin := harness.expect("POST", messengerAuthorizationsPath, "", map[string]string{
		"identifier": email, "password": password, "platform": "android", "deviceName": "Pixel 9", "installationId": installationID,
		"trustedDeviceToken": trustedLogin["trustedDevice"].(map[string]any)["token"].(string),
	}, http.StatusAccepted)
	if revokedTokenLogin["status"] != "pending" || revokedTokenLogin["accessToken"] != nil {
		t.Fatalf("revoked remembered device must require authorization again: %#v", revokedTokenLogin)
	}
}

func TestMessengerAuthorizationCodeAndEmailRecoveryBothRequireCompletion(t *testing.T) {
	harness := startAuthModuleAgainstFreshSchema(t)
	email, password, installationID := "messenger.recovery@example.com", "messengerpass2", "pixel-install-0002"
	mainSession := harness.registerAccountAndLogIn(email, password)
	challenge := createMessengerAuthorization(t, harness, email, password, installationID)
	authorizationID, proof := challenge["authorizationId"].(string), challenge["proof"].(string)
	issued := harness.expect("POST", messengerAuthorizationsPath+"/"+authorizationID+"/code", mainSession["accessToken"].(string), nil, http.StatusOK)
	if issued["code"] == nil || issued["authorizationId"] != authorizationID {
		t.Fatalf("expected authorization-bound code response, got %#v", issued)
	}
	harness.expect("POST", messengerAuthorizationsPath+"/"+authorizationID+"/verify-code", proof, map[string]string{"code": issued["code"].(string)}, http.StatusOK)
	completed := harness.expect("POST", messengerAuthorizationsPath+"/"+authorizationID+"/complete", proof, map[string]any{}, http.StatusOK)
	harness.expect("POST", messengerAuthorizationsPath+"/"+authorizationID+"/complete", proof, map[string]any{}, http.StatusConflict)
	if completed["accessToken"] == nil {
		t.Fatal("approved code flow did not issue a session on completion")
	}

	wrongCodeChallenge := createMessengerAuthorization(t, harness, email, password, "pixel-install-0004")
	wrongID, wrongProof := wrongCodeChallenge["authorizationId"].(string), wrongCodeChallenge["proof"].(string)
	wrongCode := harness.expect("POST", messengerAuthorizationsPath+"/"+wrongID+"/code", mainSession["accessToken"].(string), nil, http.StatusOK)
	for attempt := 1; attempt <= 5; attempt++ {
		wantStatus := http.StatusUnauthorized
		if attempt == 5 {
			wantStatus = http.StatusTooManyRequests
		}
		status, _ := harness.call("POST", messengerAuthorizationsPath+"/"+wrongID+"/verify-code", wrongProof, map[string]string{"code": "000000"})
		if status != wantStatus {
			t.Fatalf("wrong code attempt %d returned %d, want %d", attempt, status, wantStatus)
		}
	}
	if wrongCode["code"] == nil {
		t.Fatal("expected one-time code response")
	}
	denied := harness.expect("GET", messengerAuthorizationsPath+"/"+wrongID, wrongProof, nil, http.StatusOK)
	if denied["status"] != "denied" {
		t.Fatalf("fifth failed code attempt must durably deny challenge: %#v", denied)
	}

	recoveryChallenge := createMessengerAuthorization(t, harness, email, password, "pixel-install-0003")
	recoveryID, recoveryProof := recoveryChallenge["authorizationId"].(string), recoveryChallenge["proof"].(string)
	recovery := harness.expect("POST", messengerAuthorizationsPath+"/"+recoveryID+"/recovery/email", recoveryProof, map[string]any{}, http.StatusAccepted)
	if recovery["status"] != "sent" || recovery["destinationHint"] == email {
		t.Fatalf("recovery must send to and mask the existing verified account email: %#v", recovery)
	}
	code := harness.lastLoggedOneTimeCode()
	harness.expect("POST", messengerAuthorizationsPath+"/"+recoveryID+"/recovery/verify", recoveryProof, map[string]string{"code": code}, http.StatusOK)
	if status, _ := harness.call("GET", "/api/v1/auth/sessions", "", nil); status != http.StatusUnauthorized {
		t.Fatalf("email verification alone must not create an authenticated session, got %d", status)
	}
	recovered := harness.expect("POST", messengerAuthorizationsPath+"/"+recoveryID+"/complete", recoveryProof, map[string]any{}, http.StatusOK)
	if recovered["accessToken"] == nil {
		t.Fatal("recovery-approved authorization did not issue session at completion")
	}
}
