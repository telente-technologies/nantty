package jobs_test

import (
	"context"
	"errors"
	"testing"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/modules/suspensionCases/jobs"
	platformevents "nantty/platform/events"
)

func TestVerificationFraudHandlerIgnoresOtherEventsAndNonAdvisorySignals(t *testing.T) {
	handler := jobs.VerificationFraudEnvelopeHandler(&container.Container{})
	for _, body := range []string{
		`{"id":"1","type":"report.created","data":{}}`,
		`{"id":"2","type":"verification.fraudSignalDetected","data":{"accountId":"a","signals":["spoof_attempt"],"advisoryOnly":false}}`,
		`{"id":"3","type":"verification.fraudSignalDetected","data":{"accountId":"a","signals":[],"advisoryOnly":true}}`,
	} {
		if err := handler(context.Background(), []byte(body)); err != nil {
			t.Fatalf("%s: %v", body, err)
		}
	}
	if err := handler(context.Background(), []byte(`{"id":"4","type":"verification.fraudSignalDetected","data":"oops"}`)); !errors.Is(err, platformevents.ErrPoisonMessage) {
		t.Fatalf("malformed data is poison, got %v", err)
	}
}
