package applysmileresult_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/integrations"
	applysmileresult "nantty/modules/users/src/modules/identityVerification/commands/applySmileResult"
)

func TestCallbackSignatureIsVerifiedBeforeAnythingIsRead(t *testing.T) {
	timestamp := "2026-10-04T10:00:00.000Z"
	const documentedHmacVector = "5KInpepaxVpg8L5KA+3vIe9Ofn4DFUIcJIEAddHzehc="
	valid := integrations.ComputeSmileIdSignature("api-key", "partner-1", timestamp)
	if valid != documentedHmacVector {
		t.Fatalf("Smile ID signature must match the documented HMAC-SHA256 input and base64 encoding: got %q", valid)
	}
	valid = documentedHmacVector
	if !integrations.VerifySmileIdSignature("api-key", "partner-1", timestamp, valid) {
		t.Fatal("a correctly signed callback verifies")
	}
	for _, tampered := range [][3]string{{"other-key", "partner-1", timestamp}, {"api-key", "partner-2", timestamp}, {"api-key", "partner-1", time.Now().String()}} {
		if integrations.VerifySmileIdSignature(tampered[0], tampered[1], tampered[2], valid) {
			t.Fatalf("signature accepted for %v", tampered)
		}
	}
	if integrations.VerifySmileIdSignature("", "", timestamp, "") {
		t.Fatal("an unconfigured key never verifies")
	}
	handler := applysmileresult.Handler{Container: &container.Container{}, Verify: func(string, string) bool { return false }}
	body := []byte(`{"signature":"forged","timestamp":"` + timestamp + `","PartnerParams":{"job_id":"job-1"}}`)
	if _, err := handler.Execute(context.Background(), applysmileresult.Command{RawBody: body}); !errors.Is(err, applysmileresult.ErrCallbackSignatureInvalid) {
		t.Fatalf("forged callback must be rejected, got %v", err)
	}
	if _, err := handler.Execute(context.Background(), applysmileresult.Command{RawBody: []byte("not json")}); !errors.Is(err, applysmileresult.ErrCallbackMalformed) {
		t.Fatalf("malformed callback must be rejected, got %v", err)
	}
}
