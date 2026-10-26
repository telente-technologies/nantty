package applysmileresult

import (
	"context"
	"errors"
	"testing"
	"time"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/integrations"
)

func TestCallbackSignatureIsVerifiedBeforeAnythingIsRead(t *testing.T) {
	timestamp := "2026-10-04T10:00:00.000Z"
	valid := integrations.ComputeSmileIdSignature("api-key", "partner-1", timestamp)
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
	handler := Handler{Container: &container.Container{}, Verify: func(string, string) bool { return false }}
	body := []byte(`{"signature":"forged","timestamp":"` + timestamp + `","PartnerParams":{"job_id":"job-1"}}`)
	if _, err := handler.Execute(context.Background(), Command{RawBody: body}); !errors.Is(err, ErrCallbackSignatureInvalid) {
		t.Fatalf("forged callback must be rejected, got %v", err)
	}
	if _, err := handler.Execute(context.Background(), Command{RawBody: []byte("not json")}); !errors.Is(err, ErrCallbackMalformed) {
		t.Fatalf("malformed callback must be rejected, got %v", err)
	}
}
